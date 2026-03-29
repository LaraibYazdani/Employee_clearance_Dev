import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bulkAssignSection, checkApproverDepartmentConflict } from '@/lib/approver-resolver'
import { DEFAULT_SECTION_ITEMS } from '@/lib/clearance-config'

// POST /api/admin/approvers/bulk
// Body: { company_code, section_key, approver_id }
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { company_code, section_key, approver_id } = body

  if (!company_code || !section_key || !approver_id) {
    return NextResponse.json(
      { error: 'company_code, section_key, approver_id are required' },
      { status: 400 }
    )
  }

  const approver = await prisma.user.findUnique({
    where: { id: approver_id },
    select: { id: true, full_name: true },
  })
  if (!approver) {
    return NextResponse.json({ error: 'Approver not found' }, { status: 404 })
  }

  // Enforce: one user can only be assigned to one department
  const conflictingSection = await checkApproverDepartmentConflict(company_code, section_key, approver_id)
  if (conflictingSection) {
    return NextResponse.json(
      {
        error: 'Department conflict',
        message: `${approver.full_name} is already assigned to the ${conflictingSection} department. A user can only be an approver for one department.`,
      },
      { status: 409 }
    )
  }

  const items = DEFAULT_SECTION_ITEMS[section_key] ?? []
  if (items.length === 0) {
    return NextResponse.json({ error: 'No items found for section' }, { status: 400 })
  }

  const itemKeys = items.map((i) => i.item_key)
  await bulkAssignSection(company_code, section_key, itemKeys, approver_id)

  return NextResponse.json({
    success: true,
    assigned: itemKeys.length,
    approver: approver.full_name,
  })
})
