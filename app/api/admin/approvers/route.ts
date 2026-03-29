import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getApproverMatrix, setApproverForItem, removeApproverForItem, checkApproverDepartmentConflict } from '@/lib/approver-resolver'
import { DEFAULT_SECTION_ITEMS, SECTION_LABELS } from '@/lib/clearance-config'

// GET /api/admin/approvers?company=1000
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyCode = searchParams.get('company') ?? '1000'

  const assignments = await getApproverMatrix(companyCode)

  // Build a lookup map: section_key + item_key → assignment
  const assignmentMap: Record<string, any> = {}
  for (const a of assignments) {
    assignmentMap[`${a.section_key}::${a.item_key}`] = a
  }

  // Build full matrix from config
  const sections = Object.entries(DEFAULT_SECTION_ITEMS)
    .filter(([key]) => key !== 'FINANCE') // Finance has no sub-items
    .map(([sectionKey, items]) => ({
      section_key: sectionKey,
      section_label: SECTION_LABELS[sectionKey] ?? sectionKey,
      items: items.map((item) => ({
        item_key: item.item_key,
        description: item.description,
        assignment: assignmentMap[`${sectionKey}::${item.item_key}`] ?? null,
      })),
    }))

  return NextResponse.json({ company_code: companyCode, sections })
})

// POST /api/admin/approvers — upsert one assignment
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { company_code, section_key, item_key, approver_id } = body

  if (!company_code || !section_key || !item_key || !approver_id) {
    return NextResponse.json({ error: 'company_code, section_key, item_key, approver_id are required' }, { status: 400 })
  }

  const approver = await prisma.user.findUnique({ where: { id: approver_id }, select: { id: true, full_name: true } })
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

  const result = await setApproverForItem(company_code, section_key, item_key, approver_id)
  return NextResponse.json(result)
})

// DELETE /api/admin/approvers — remove one assignment
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { company_code, section_key, item_key } = body

  if (!company_code || !section_key || !item_key) {
    return NextResponse.json({ error: 'company_code, section_key, item_key are required' }, { status: 400 })
  }

  await removeApproverForItem(company_code, section_key, item_key)
  return NextResponse.json({ success: true })
})
