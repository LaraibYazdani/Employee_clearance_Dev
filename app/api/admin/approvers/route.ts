import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getApproverMatrix, setApproverForItem, removeApproverForItem } from '@/lib/approver-resolver'
import { DEFAULT_SECTION_ITEMS } from '@/lib/clearance-config'

// GET /api/admin/approvers?company=1000
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyCode = searchParams.get('company') ?? '1000'

  const assignments = await getApproverMatrix(companyCode)

  // Build a lookup map: section_key + item_key → assignments[]
  const assignmentMap: Record<string, any[]> = {}
  for (const a of assignments) {
    const key = `${a.section_key}::${a.item_key}`
    if (!assignmentMap[key]) assignmentMap[key] = []
    assignmentMap[key].push(a)
  }

  // Fetch ACTIVE sections from template for this company
  const activeSectionTemplates = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: companyCode },
    orderBy: { sort_order: 'asc' },
  })

  // Fetch custom items from database for this company
  const customItems = await prisma.clearanceItemTemplate.findMany({
    where: { company_code: companyCode },
    orderBy: [{ section_key: 'asc' }, { sort_order: 'asc' }],
  })

  // Build a lookup: section_key → custom items
  const customItemsBySection: Record<string, typeof customItems> = {}
  for (const item of customItems) {
    if (!customItemsBySection[item.section_key]) {
      customItemsBySection[item.section_key] = []
    }
    customItemsBySection[item.section_key].push(item)
  }

  // Build matrix ONLY from active template sections
  const sections = activeSectionTemplates.map((template) => {
    const sectionKey = template.section_key
    const defaultItems = DEFAULT_SECTION_ITEMS[sectionKey] ?? []

    const itemsToUse =
      customItemsBySection[sectionKey] && customItemsBySection[sectionKey].length > 0
        ? customItemsBySection[sectionKey].map((item) => ({
            item_key: item.item_key,
            description: item.description,
          }))
        : defaultItems

    return {
      section_key: sectionKey,
      section_label: template.label,
      items:
        itemsToUse.length > 0
          ? itemsToUse.map((item) => {
              // Section-level assignments override individual item assignments
              const sectionLevelAssignments = assignmentMap[`${sectionKey}::section`] ?? []
              const itemAssignments =
                sectionLevelAssignments.length > 0
                  ? sectionLevelAssignments
                  : (assignmentMap[`${sectionKey}::${item.item_key}`] ?? [])

              return {
                item_key: item.item_key,
                description: item.description,
                assignments: itemAssignments,
              }
            })
          : [
              {
                item_key: 'section',
                description: `${template.label} Section Approver`,
                assignments: assignmentMap[`${sectionKey}::section`] ?? [],
              },
            ],
    }
  })

  const payrollManager =
    assignments.find((a) => a.section_key === 'PAYROLL_MANAGER') ?? null

  const financeManagers =
    assignments.filter((a) => a.section_key === 'FINANCE_MANAGER')

  return NextResponse.json({ company_code: companyCode, sections, payrollManager, financeManagers })
})

// POST /api/admin/approvers — add one assignment (idempotent)
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { company_code, section_key, item_key, approver_id } = body

  if (!company_code || !section_key || !item_key || !approver_id) {
    return NextResponse.json(
      { error: 'company_code, section_key, item_key, approver_id are required' },
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

  // If assigning at section level (item_key = 'section'), clear all individual item assignments
  if (item_key === 'section') {
    await prisma.approverAssignment.deleteMany({
      where: {
        company_code: company_code,
        section_key: section_key,
        item_key: { not: 'section' },
      },
    })
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
  const { company_code, section_key, item_key, approver_id } = body

  if (!company_code || !section_key || !item_key) {
    return NextResponse.json(
      { error: 'company_code, section_key, item_key are required' },
      { status: 400 }
    )
  }

  await removeApproverForItem(company_code, section_key, item_key, approver_id)
  return NextResponse.json({ success: true })
})
