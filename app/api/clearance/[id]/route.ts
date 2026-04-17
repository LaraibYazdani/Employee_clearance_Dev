import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'
import { findApproverForSection } from '@/lib/clearance-workflow'

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id },
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
            company: true,
            company_code: true,
            hrbp_id: true,
            line_manager_id: true,
          },
        },
        initiated_by_hrbp: {
          select: { id: true, full_name: true, email: true, designation: true },
        },
        clearance_sections: {
          orderBy: { created_at: 'asc' },
          include: {
            clearance_items: {
              orderBy: { created_at: 'asc' },
              include: {
                attachments: {
                  orderBy: { created_at: 'asc' },
                  include: { uploaded_by: { select: { id: true, full_name: true } } },
                },
              },
            },
          },
        },
        finance_entries: { orderBy: { created_at: 'asc' } },
        activity_logs: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: {
            actor: { select: { id: true, full_name: true, email: true } },
          },
        },
      },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Access control
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
    const isSubjectEmployee = clearance.employee_id === user.id

    if (!isSuperAdmin && !isOwnerHRBP && !isDeptApprover && !isSubjectEmployee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Server-side can_act computation using fresh DB roles from withAuth
    const computeCanAct = (s: typeof clearance.clearance_sections[0]): boolean => {
      if (s.status === 'LOCKED' || s.status !== 'PENDING') return false
      if (isSuperAdmin) return true
      if (s.approver_id && s.approver_id === user.id) return true
      const requiredRole = SECTION_ROLE_MAP[s.section_key]
      if (requiredRole && user.roles.includes(requiredRole)) return true
      return false
    }

    // Fetch section labels from templates
    const companyCode = clearance.employee.company_code || '1000'
    const sectionLabelMap = new Map<string, string>()
    const templates = await prisma.clearanceSectionTemplate.findMany({
      where: { company_code: companyCode },
      select: { section_key: true, label: true },
    })
    templates.forEach((t) => {
      sectionLabelMap.set(t.section_key, t.label)
    })

    // Dynamically resolve current approver for each section
    const sections = await Promise.all(
      clearance.clearance_sections.map(async (s) => {
        const currentApproverId = await findApproverForSection(
          s.section_key,
          clearance.employee_id,
          companyCode
        )

        let currentApproverName: string | null = null
        if (currentApproverId) {
          const approver = await prisma.user.findUnique({
            where: { id: currentApproverId },
            select: { full_name: true },
          })
          currentApproverName = approver?.full_name ?? null
        }

        // Fetch item-level assignments for this section
        const itemAssignments = await prisma.approverAssignment.findMany({
          where: { 
            section_key: s.section_key,
            company_code: companyCode,
          },
          select: { item_key: true, approver_id: true },
        })

        const itemAssignmentMap = new Map<string, string>()
        itemAssignments.forEach((a) => {
          itemAssignmentMap.set(a.item_key, a.approver_id)
        })

        // Check if there's a section-level assignment (overrides individual item assignments)
        const sectionLevelAssignerId = itemAssignmentMap.get('section')

        // Enhance items with assignment info
        const itemsWithAssignments = await Promise.all(
          s.clearance_items.map(async (item) => {
            // Prefer section-level assignment if it exists, otherwise use item-level assignment
            const assignedApproverId = sectionLevelAssignerId ?? itemAssignmentMap.get(item.item_key)
            let assignedApproverName: string | null = null
            if (assignedApproverId) {
              const assignedApprover = await prisma.user.findUnique({
                where: { id: assignedApproverId },
                select: { full_name: true },
              })
              assignedApproverName = assignedApprover?.full_name ?? null
            }
            return {
              ...item,
              assigned_approver_id: assignedApproverId,
              assigned_approver_name: assignedApproverName,
            }
          })
        )

        // Compute can_act using the CURRENT (dynamically resolved) approver, not the cached one
        const canAct = (): boolean => {
          if (s.status === 'LOCKED' || s.status !== 'PENDING') return false
          if (isSuperAdmin) return true
          if (currentApproverId && currentApproverId === user.id) return true
          const requiredRole = SECTION_ROLE_MAP[s.section_key]
          if (requiredRole && user.roles.includes(requiredRole)) return true
          return false
        }

        return {
          ...s,
          label: sectionLabelMap.get(s.section_key),
          approver_id: currentApproverId || s.approver_id,
          approver_name: currentApproverName || s.approver_name,
          items: itemsWithAssignments,
          can_act: canAct(),
        }
      })
    )

    // Normalize Prisma relation names to match frontend types
    const normalized = {
      ...clearance,
      sections,
    }

    return NextResponse.json(normalized)
  } catch (error) {
    console.error('[GET /api/clearance/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Only SUPER_ADMIN can force update clearance status' }, { status: 403 })
  }

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 })
  }

  const allowedStatuses = ['IN_PROGRESS', 'PENDING_HRBP', 'COMPLETED', 'CANCELLED']
  if (!allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.clearanceRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    const updated = await prisma.clearanceRequest.update({
      where: { id },
      data: { status: body.status },
    })

    await prisma.activityLog.create({
      data: {
        clearance_request_id: id,
        actor_id: user.id,
        action: 'STATUS_UPDATED',
        details: JSON.stringify({
          message: `Status force-updated to ${body.status} by SUPER_ADMIN ${user.full_name}`,
          previous_status: existing.status,
          new_status: body.status,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/clearance/[id]
// Force delete a clearance and all related data
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  // Only SUPER_ADMIN can force delete clearances
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Only SUPER_ADMIN can delete clearances' }, { status: 403 })
  }

  try {
    // Verify clearance exists
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id },
      select: { id: true, employee_id: true },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Delete in cascade order (respecting foreign key constraints):
    // 1. Activity logs (references clearance_request_id)
    await prisma.activityLog.deleteMany({
      where: { clearance_request_id: id },
    })

    // 2. Notifications (references clearance_request_id)
    await prisma.notification.deleteMany({
      where: { clearance_request_id: id },
    })

    // 3. Finance entries (references clearance_request_id)
    await prisma.financeEntry.deleteMany({
      where: { clearance_request_id: id },
    })

    // 4. Clearance items (references clearance_section_id, which will be deleted next)
    const sections = await prisma.clearanceSection.findMany({
      where: { clearance_request_id: id },
      select: { id: true },
    })

    for (const section of sections) {
      await prisma.clearanceItem.deleteMany({
        where: { clearance_section_id: section.id },
      })
    }

    // 5. Clearance sections (references clearance_request_id)
    await prisma.clearanceSection.deleteMany({
      where: { clearance_request_id: id },
    })

    // 6. Finally, delete the clearance request itself
    const deleted = await prisma.clearanceRequest.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Clearance ${id} and all related data have been permanently deleted`,
      deleted_clearance: deleted.id,
    })
  } catch (error) {
    console.error('[DELETE /api/clearance/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: (error as any).message }, { status: 500 })
  }
})
