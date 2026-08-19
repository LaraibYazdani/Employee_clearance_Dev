import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setApproverForItem } from '@/lib/approver-resolver'

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

  // Delete ALL existing item assignments for this section (both individual and section-level)
  await prisma.approverAssignment.deleteMany({
    where: {
      company_code: company_code,
      section_key: section_key,
    },
  })

  // Create a section-level assignment (item_key = 'section')
  await setApproverForItem(company_code, section_key, 'section', approver_id)

  return NextResponse.json({
    success: true,
    message: `${approver.full_name} assigned to ${section_key} section`,
    approver: approver.full_name,
  })
})
