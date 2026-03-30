import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SECTION_2_KEYS,
  SECTION_3_KEYS,
  SECTION_ROLE_MAP,
  DEFAULT_SECTION_ITEMS,
  DEFAULT_FINANCE_ENTRIES,
} from '@/lib/clearance-config'
import { findApproverForSection } from '@/lib/clearance-workflow'
import { notifySection2Approvers } from '@/lib/notifications'

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
      // Find sections where this approver has a pending/denied task
      where.clearance_sections = {
        some: {
          approver_id: user.id,
          status: { in: ['PENDING', 'DENIED'] },
        },
      }
      // Also ensure the clearance itself is active
      where.status = { in: ['IN_PROGRESS', 'PENDING_HRBP'] }
    } else {
      // EMPLOYEE — can only see their own clearances
      where.employee_id = user.id
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

  if (!user.roles.includes('HRBP')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Only HRBP can create clearance requests' }, { status: 403 })
  }

  let body: {
    employeeId?: string
    dateOfLeaving?: string
    issuedBy?: string
    issuanceDate?: string
    receivingDate?: string
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

    // Enforce: HRBP can only initiate clearance for employees assigned to them in SF
    // SUPER_ADMIN bypasses this restriction
    if (!user.roles.includes('SUPER_ADMIN')) {
      if (!employee.hrbp_id) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `${employee.full_name} does not have an HRBP assigned in the system. They may need to log in once so their SuccessFactors data can sync.`,
          },
          { status: 403 }
        )
      }
      if (employee.hrbp_id !== user.id) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `You are not the assigned HRBP for ${employee.full_name}. Only their designated HRBP can initiate a clearance.`,
          },
          { status: 403 }
        )
      }
    }

    const companyCode = employee.company_code ?? null
    const now = nowPKT()

    // Build section data for all Section 2 keys
    const sectionCreateData: any[] = []

    for (const sectionKey of SECTION_2_KEYS) {
      const approverId = await findApproverForSection(sectionKey, body.employeeId, companyCode)
      let approverName: string | null = null

      if (approverId) {
        const approverUser = await prisma.user.findUnique({
          where: { id: approverId },
          select: { full_name: true },
        })
        approverName = approverUser?.full_name ?? null
      }

      const items = DEFAULT_SECTION_ITEMS[sectionKey] ?? []

      sectionCreateData.push({
        section_key: sectionKey,
        status: 'PENDING',
        approver_id: approverId,
        approver_name: approverName,
        clearance_items: {
          create: items.map((item) => ({
            item_key: item.item_key,
            description: item.description,
            status: 'PENDING',
          })),
        },
      })
    }

    // Build section data for all Section 3 keys (LOCKED initially)
    for (const sectionKey of SECTION_3_KEYS) {
      const approverId = await findApproverForSection(sectionKey, body.employeeId, companyCode)
      let approverName: string | null = null

      if (approverId) {
        const approverUser = await prisma.user.findUnique({
          where: { id: approverId },
          select: { full_name: true },
        })
        approverName = approverUser?.full_name ?? null
      }

      const items = DEFAULT_SECTION_ITEMS[sectionKey] ?? []

      sectionCreateData.push({
        section_key: sectionKey,
        status: 'LOCKED',
        approver_id: approverId,
        approver_name: approverName,
        clearance_items: {
          create: items.map((item) => ({
            item_key: item.item_key,
            description: item.description,
            status: 'PENDING',
          })),
        },
      })
    }

    // Create clearance request with all nested data in a transaction
    const clearance = await prisma.$transaction(async (tx) => {
      const newClearance = await tx.clearanceRequest.create({
        data: {
          employee_id: body.employeeId!,
          initiated_by_hrbp_id: user.id,
          status: 'IN_PROGRESS',
          date_of_leaving: body.dateOfLeaving ? new Date(body.dateOfLeaving) : null,
          issued_by: body.issuedBy ?? null,
          issuance_date: body.issuanceDate ? new Date(body.issuanceDate) : null,
          receiving_date: body.receivingDate ? new Date(body.receivingDate) : null,
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
    })

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
