import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]/items/[itemId]
// Updates deductible_description and deductible_amount only.
// Callable by: the assigned approver for the item, HRBP, or SUPER_ADMIN.
// Blocked when clearance status is COMPLETED.
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, itemId } = context.params as { id: string; itemId: string }

  let body: { deductible_description?: string | null; deductible_amount?: number | string | null; comments?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const item = await prisma.clearanceItem.findUnique({
      where: { id: itemId },
      include: {
        clearance_section: {
          include: {
            clearance_request: {
              select: {
                id: true,
                status: true,
                employee_id: true,
                initiated_by_hrbp_id: true,
                employee: { select: { company_code: true } },
              },
            },
          },
        },
      },
    })

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const clearance = item.clearance_section.clearance_request
    if (clearance.id !== clearanceId) {
      return NextResponse.json({ error: 'Item does not belong to this clearance' }, { status: 400 })
    }

    if (clearance.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Clearance is completed and can no longer be edited' }, { status: 409 })
    }

    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
    const isPayrollManager = user.roles.includes('PAYROLL_MANAGER')

    // Check if user is the assigned approver for this item
    const companyCode = clearance.employee.company_code ?? '1000'
    const sectionKey = item.clearance_section.section_key

    const itemAssignments = await prisma.approverAssignment.findMany({
      where: { company_code: companyCode, section_key: sectionKey },
      select: { item_key: true, approver_id: true },
    })
    const sectionLevelApprovers = itemAssignments.filter((a) => a.item_key === 'section').map((a) => a.approver_id)
    const itemLevelApprovers = itemAssignments.filter((a) => a.item_key === item.item_key).map((a) => a.approver_id)
    const assignedApprovers = sectionLevelApprovers.length ? sectionLevelApprovers : itemLevelApprovers

    const isAssignedApprover = assignedApprovers.includes(user.id)

    // For LINE_MANAGER/DEPT_HEAD sections, the approver is the employee's line manager
    const isLineManagerSection = sectionKey === 'LINE_MANAGER' || sectionKey === 'DEPT_HEAD'
    let isLineManager = false
    if (isLineManagerSection) {
      const emp = await prisma.user.findUnique({
        where: { id: clearance.employee_id },
        select: { line_manager_id: true },
      })
      isLineManager = emp?.line_manager_id === user.id || item.clearance_section.approver_id === user.id
    }

    if (!isSuperAdmin && !isOwnerHRBP && !isPayrollManager && !isAssignedApprover && !isLineManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.clearanceItem.update({
      where: { id: itemId },
      data: {
        ...(body.deductible_description !== undefined
          ? { deductible_description: body.deductible_description }
          : {}),
        ...(body.deductible_amount !== undefined
          ? { deductible_amount: body.deductible_amount !== null ? String(body.deductible_amount) : null }
          : {}),
        ...(body.comments !== undefined ? { comments: body.comments } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]/items/[itemId]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
