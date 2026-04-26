import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_FINANCE_ENTRIES } from '@/lib/clearance-config'
import { findApproverForSection } from '@/lib/clearance-workflow'
import { getTemplatesForCompany } from '@/lib/clearance-templates'
import { notifySection2Approvers } from '@/lib/notifications'
import { getHRBP } from '@/lib/successfactors'

// PKT = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// GET /api/clearance
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') ?? undefined
  const searchQuery = searchParams.get('search') ?? undefined

  try {
    // Build where clause
    const where: any = {}

    // Status filter
    if (statusFilter) {
      where.status = statusFilter
    }

    // Employee name search
    if (searchQuery) {
      where.employee = {
        full_name: { contains: searchQuery },
      }
    }

    // Role-based scoping
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))

    if (user.roles.includes('SUPER_ADMIN')) {
      // No additional filter — see all
    } else if (user.roles.includes('HRBP')) {
      where.initiated_by_hrbp_id = user.id
    } else if (isDeptApprover) {
      // Find company codes where this user has live ApproverAssignment rows
      const liveAssignments = await prisma.approverAssignment.findMany({
        where: { approver_id: user.id },
        select: { company_code: true },
        distinct: ['company_code'],
      })
      const assignedCompanyCodes = liveAssignments.map((a) => a.company_code)

      // Show clearances for:
      // 1. Companies where user has item/section assignments (live)
      // 2. Clearances where user is the employee's line manager (DEPT_HEAD)
      // 3. Legacy: stale section.approver_id match (for pre-assignment-table clearances)
      const orConditions: any[] = []
      if (assignedCompanyCodes.length > 0) {
        orConditions.push({ employee: { company_code: { in: assignedCompanyCodes } } })
      }
      orConditions.push({ employee: { line_manager_id: user.id } })
      orConditions.push({
        clearance_sections: {
          some: { approver_id: user.id, status: { in: ['PENDING', 'DENIED'] } },
        },
      })

      where.OR = orConditions
      where.status = { in: ['IN_PROGRESS', 'PENDING_HRBP'] }
    } else {
      // EMPLOYEE / unverified HRBP — default shows clearances they initiated;
      // ?view=mine shows clearances where they are the employee
      const view = searchParams.get('view')
      if (view === 'mine') {
        where.employee_id = user.id
      } else {
        where.initiated_by_hrbp_id = user.id
      }
    }

    const clearances = await prisma.clearanceRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            sf_employee_id: true,
            full_name: true,
            email: true,
            designation: true,
            department: true,
            grade: true,
            division: true,
          },
        },
        initiated_by_hrbp: {
          select: { id: true, full_name: true, email: true },
        },
        clearance_sections: {
          include: { clearance_items: true },
        },
      },
    })

    const normalized = clearances.map((c) => ({
      ...c,
      sections: c.clearance_sections.map((s) => ({
        ...s,
        items: s.clearance_items,
      })),
    }))

    return NextResponse.json(normalized)
  } catch (error) {
    console.error('[GET /api/clearance] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// POST /api/clearance
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  // Any authenticated user may attempt — SF is the source of truth for HRBP status

  let body: {
    employeeId?: string
    dateOfLeaving?: string
    issuedBy?: string
    laptopBuyback?: string
    vehicleLoan?: string
    simTransfer?: string
    otherQuery?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  try {
    // Validate employee exists in DB
    const employee = await prisma.user.findUnique({ where: { id: body.employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Verify via SF in real-time that the initiating user is the HRBP for this employee.
    // SUPER_ADMIN bypasses this check.
    if (!user.roles.includes('SUPER_ADMIN')) {
      let sfHrbpId: string | null = null
      try {
        const hrbpResult = await getHRBP(employee.sf_employee_id)
        sfHrbpId = hrbpResult?.hrbpId ?? null
      } catch (err) {
        console.error('[POST /api/clearance] SF HRBP check failed:', err)
        return NextResponse.json(
          {
            error: 'Service Unavailable',
            message: 'Unable to verify HRBP status. SuccessFactors is currently unavailable. Please try again later.',
          },
          { status: 503 }
        )
      }

      if (!sfHrbpId || sfHrbpId !== user.sf_employee_id) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `You are not the assigned HRBP for ${employee.full_name} in SuccessFactors.`,
          },
          { status: 403 }
        )
      }

      // SF verified — auto-upgrade role to HRBP if not already assigned
      if (!user.roles.includes('HRBP')) {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { roles: true },
          })
          const currentRoles = Array.isArray(currentUser?.roles) ? (currentUser.roles as string[]) : []
          if (!currentRoles.includes('HRBP')) {
            await prisma.user.update({
              where: { id: user.id },
              data: { roles: [...currentRoles, 'HRBP'] },
            })
          }
        } catch (err) {
          console.error('[POST /api/clearance] Failed to auto-upgrade HRBP role:', err)
          // Non-critical — clearance creation continues
        }
      }
    }

    const companyCode = employee.company_code ?? null
    const now = nowPKT()

    // Fetch sections/items from DB templates (falls back to PL 1000)
    const templates = await getTemplatesForCompany(companyCode)

    // Pre-fetch all approver data OUTSIDE the transaction to avoid timeout
    const approverData: Record<string, { id: string | null; name: string | null }> = {}
    for (const template of templates) {
      const approverId = await findApproverForSection(template.section_key, body.employeeId!, companyCode)
      let approverName: string | null = null

      if (approverId) {
        const approverUser = await prisma.user.findUnique({
          where: { id: approverId },
          select: { full_name: true },
        })
        approverName = approverUser?.full_name ?? null
      }

      approverData[template.section_key] = {
        id: approverId,
        name: approverName,
      }
    }

    const sectionCreateData: any[] = []

    for (const template of templates) {
      const approver = approverData[template.section_key]

      sectionCreateData.push({
        section_key: template.section_key,
        phase: template.phase,
        status: 'PENDING',
        approver_id: approver.id,
        approver_name: approver.name,
        clearance_items: {
          create: template.items.map((item) => ({
            item_key: item.item_key,
            description: item.description,
            status: 'PENDING',
          })),
        },
      })
    }

    // Create clearance request with all nested data in a transaction
    const clearance = await prisma.$transaction(
      async (tx) => {
        const newClearance = await tx.clearanceRequest.create({
          data: {
            employee_id: body.employeeId!,
            initiated_by_hrbp_id: user.id,
            status: 'IN_PROGRESS',
            date_of_leaving: body.dateOfLeaving ? new Date(body.dateOfLeaving) : null,
            issued_by: body.issuedBy ?? null,
            laptop_buyback: body.laptopBuyback ?? null,
            vehicle_loan: body.vehicleLoan ?? null,
            sim_transfer: body.simTransfer ?? null,
            other_query: body.otherQuery ?? null,
            clearance_sections: { create: sectionCreateData },
            finance_entries: {
              create: DEFAULT_FINANCE_ENTRIES.map((entry) => ({
                gl_account: entry.gl_account,
                particulars: entry.particulars,
                section_group: entry.section_group,
              })),
            },
          },
          include: {
            employee: true,
            initiated_by_hrbp: { select: { id: true, full_name: true, email: true } },
            clearance_sections: { include: { clearance_items: true } },
            finance_entries: true,
          },
        })

        // Activity log
        await tx.activityLog.create({
          data: {
            clearance_request_id: newClearance.id,
            actor_id: user.id,
            action: 'CLEARANCE_INITIATED',
            details: JSON.stringify({
              message: `Clearance initiated by HRBP ${user.full_name} for employee ${employee.full_name}`,
              timestamp: now.toISOString(),
            }),
          },
        })

        return newClearance
      },
      {
        timeout: 30000, // Increase timeout to 30 seconds
      }
    )

    // Notify Section 2 approvers (outside transaction — non-critical)
    try {
      await notifySection2Approvers(clearance.id)
    } catch (notifyErr) {
      console.error('[POST /api/clearance] notification error:', notifyErr)
    }

    return NextResponse.json(clearance, { status: 201 })
  } catch (error) {
    console.error('[POST /api/clearance] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
