import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'
import fs from 'fs'

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

    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
    const isSubjectEmployee = clearance.employee_id === user.id
    const companyCode = clearance.employee.company_code || '1000'
    const lineManagerId = clearance.employee.line_manager_id ?? null

    // Batch-fetch all approver assignments for this company (single query — no N+1)
    const allAssignments = await prisma.approverAssignment.findMany({
      where: { company_code: companyCode },
      select: { section_key: true, item_key: true, approver_id: true },
    })

    // Build section_key → Map<item_key, approver_id>
    const assignmentMap = new Map<string, Map<string, string>>()
    for (const a of allAssignments) {
      if (!assignmentMap.has(a.section_key)) assignmentMap.set(a.section_key, new Map())
      assignmentMap.get(a.section_key)!.set(a.item_key, a.approver_id)
    }

    // Payroll manager check
    const payrollAssignment = allAssignments.find(
      (a) => a.section_key === 'PAYROLL_MANAGER' && a.approver_id === user.id
    )
    const isPayrollManager = user.roles.includes('PAYROLL_MANAGER') || !!payrollAssignment

    // Access control — any of: super admin, initiating HRBP, subject employee,
    // assigned approver in ApproverAssignment, line manager, DEPT_APPROVER role, or payroll manager
    const isAssignedApprover = allAssignments.some((a) => a.approver_id === user.id)
    // Check both live line_manager_id and stored section.approver_id for DEPT_HEAD/LINE_MANAGER
    // This handles: line manager changed after creation, employee re-imported with new DB id, etc.
    const isLineManager =
      lineManagerId === user.id ||
      clearance.clearance_sections.some(
        (s) =>
          (s.section_key === 'LINE_MANAGER' || s.section_key === 'DEPT_HEAD') &&
          s.approver_id === user.id
      )
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))

    if (!isSuperAdmin && !isOwnerHRBP && !isSubjectEmployee && !isAssignedApprover && !isLineManager && !isDeptApprover && !isPayrollManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canComplete =
      isPayrollManager &&
      clearance.status === 'PENDING_PAYROLL'

    // Batch-fetch all approver names (single query)
    const approverIdSet = new Set(allAssignments.map((a) => a.approver_id))
    if (lineManagerId) approverIdSet.add(lineManagerId)
    const approverIdList = Array.from(approverIdSet)
    const approverUsers =
      approverIdList.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: approverIdList } },
            select: { id: true, full_name: true },
          })
        : []
    const approverNameMap = new Map(approverUsers.map((u) => [u.id, u.full_name]))

    // Fetch section labels
    const templates = await prisma.clearanceSectionTemplate.findMany({
      where: { company_code: companyCode },
      select: { section_key: true, label: true },
    })
    const sectionLabelMap = new Map(templates.map((t) => [t.section_key, t.label]))

    // Build sections with corrected can_act, live approver names, and item-level assignments
    const sections = clearance.clearance_sections.map((s) => {
      const sectionItems = assignmentMap.get(s.section_key) ?? new Map<string, string>()
      const sectionLevelApproverId = sectionItems.get('section') ?? null

      // Section-level display approver (shown in summary panel / section header)
      let displayApproverId: string | null = null
      let displayApproverName: string | null = null
      if (s.section_key === 'DEPT_HEAD' || s.section_key === 'LINE_MANAGER') {
        // For pending sections, show the current line manager who needs to approve
        // For approved/denied sections, show who actually approved/denied it
        if (s.status === 'PENDING') {
          displayApproverId = lineManagerId
          displayApproverName = lineManagerId ? (approverNameMap.get(lineManagerId) ?? null) : null
        } else {
          // Section is approved/denied/locked - show who actually acted on it
          displayApproverId = s.approver_id
          displayApproverName = s.approver_name
        }
      } else if (sectionLevelApproverId) {
        if (s.status !== 'PENDING') {
          displayApproverId = s.approver_id
          displayApproverName = s.approver_name
        } else {
          displayApproverId = sectionLevelApproverId
          displayApproverName = approverNameMap.get(sectionLevelApproverId) ?? null
        }
      }

      // Enhance items with live assignment info
      const items = s.clearance_items.map((item) => {
        const assignedApproverId =
          sectionLevelApproverId ?? sectionItems.get(item.item_key) ?? null
        const assignedApproverName = assignedApproverId
          ? (approverNameMap.get(assignedApproverId) ?? null)
          : null
        return {
          ...item,
          assigned_approver_id: assignedApproverId ?? undefined,
          assigned_approver_name: assignedApproverName ?? undefined,
        }
      })

      // Compute can_act from live ApproverAssignment data — NOT from stale section.approver_id
      const canAct = (): boolean => {
        if (s.status === 'LOCKED' || s.status !== 'PENDING') return false
        if (isSuperAdmin) return true

        // DEPT_HEAD and LINE_MANAGER: check both live line_manager_id and stored approver_id
        // Covers cases where line manager changed after creation or employee was re-imported
        if (s.section_key === 'DEPT_HEAD' || s.section_key === 'LINE_MANAGER') {
          return lineManagerId === user.id || s.approver_id === user.id
        }

        if (sectionItems.size === 0) {
          // No assignments configured → fall back to role-based check
          const requiredRole = SECTION_ROLE_MAP[s.section_key]
          return requiredRole ? user.roles.includes(requiredRole) : false
        }

        if (sectionLevelApproverId) {
          // Section-level assignment: only that specific user can approve the whole section
          return sectionLevelApproverId === user.id
        }

        // Item-level assignments: user can act if they are assigned to at least one item
        for (const approverId of Array.from(sectionItems.values())) {
          if (approverId === user.id) return true
        }
        return false
      }

      // LINE_MANAGER and DEPT_HEAD labels are always resolved regardless of template
      const resolvedLabel =
        s.section_key === 'DEPT_HEAD'
          ? 'Departmental Head'
          : s.section_key === 'LINE_MANAGER'
          ? 'Department Head'
          : (sectionLabelMap.get(s.section_key) ?? undefined)

      return {
        ...s,
        label: resolvedLabel,
        approver_id: displayApproverId ?? s.approver_id,
        approver_name: displayApproverName ?? s.approver_name,
        items,
        can_act: canAct(),
      }
    })

    // Determine which users can see deductible fields
    const canSeeDeductibles = isSuperAdmin || isOwnerHRBP || isSubjectEmployee || isPayrollManager

    // For each section's items, tag whether the current user can see/edit deductibles
    const sectionsWithDeductibleFlags = sections.map((s) => ({
      ...s,
      items: s.items.map((item: any) => ({
        ...item,
        show_deductibles: canSeeDeductibles || item.assigned_approver_id === user.id,
      })),
    }))

    return NextResponse.json({
      ...clearance,
      sections: sectionsWithDeductibleFlags,
      can_complete: canComplete,
      is_payroll_manager: isPayrollManager,
      is_subject_employee: isSubjectEmployee,
    })
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

  const allowedStatuses = ['IN_PROGRESS', 'PENDING_HRBP', 'PENDING_PAYROLL', 'COMPLETED', 'CANCELLED']
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

    // 4. Collect all attachment file paths, delete files from disk, then delete DB rows
    const sections = await prisma.clearanceSection.findMany({
      where: { clearance_request_id: id },
      select: { id: true },
    })

    for (const section of sections) {
      const items = await prisma.clearanceItem.findMany({
        where: { clearance_section_id: section.id },
        select: { id: true },
      })
      for (const item of items) {
        const attachments = await prisma.clearanceItemAttachment.findMany({
          where: { clearance_item_id: item.id },
          select: { stored_path: true },
        })
        for (const att of attachments) {
          try {
            if (fs.existsSync(att.stored_path)) fs.unlinkSync(att.stored_path)
          } catch (err) {
            console.error('[DELETE clearance] failed to delete file:', att.stored_path, err)
          }
        }
        await prisma.clearanceItemAttachment.deleteMany({ where: { clearance_item_id: item.id } })
      }
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
