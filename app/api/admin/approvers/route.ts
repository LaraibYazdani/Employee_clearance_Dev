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

  // Build matrix ONLY from active template sections (not hardcoded defaults)
  const sections = activeSectionTemplates.map((template) => {
    const sectionKey = template.section_key
    const defaultItems = DEFAULT_SECTION_ITEMS[sectionKey] ?? []

    // Use custom items if they exist, otherwise use default items
    const itemsToUse = customItemsBySection[sectionKey] && customItemsBySection[sectionKey].length > 0
      ? customItemsBySection[sectionKey].map((item) => ({
          item_key: item.item_key,
          description: item.description,
        }))
      : defaultItems

    return {
      section_key: sectionKey,
      section_label: template.label,
      items: itemsToUse.length > 0 ? itemsToUse.map((item) => {
        // If there's a section-level assignment, use that for all items (section-level override)
        const sectionLevelAssignment = assignmentMap[`${sectionKey}::section`]
        const itemAssignment = sectionLevelAssignment ?? assignmentMap[`${sectionKey}::${item.item_key}`]
        
        return {
          item_key: item.item_key,
          description: item.description,
          assignment: itemAssignment ?? null,
        }
      }) : [
        // For sections with no items, create a section-level assignment
        {
          item_key: 'section',
          description: `${template.label} Section Approver`,
          assignment: assignmentMap[`${sectionKey}::section`] ?? null,
        }
      ],
    }
  })

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

  // If assigning at section level (item_key = 'section'), clear all individual item assignments for this section
  if (item_key === 'section') {
    await prisma.approverAssignment.deleteMany({
      where: {
        company_code: company_code,
        section_key: section_key,
        item_key: { not: 'section' }, // Delete all non-section items
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
  const { company_code, section_key, item_key } = body

  if (!company_code || !section_key || !item_key) {
    return NextResponse.json({ error: 'company_code, section_key, item_key are required' }, { status: 400 })
  }

  await removeApproverForItem(company_code, section_key, item_key)
  return NextResponse.json({ success: true })
})
