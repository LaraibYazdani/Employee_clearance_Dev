import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// POST /api/admin/templates/[id]/items  — add an item to a section template
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = context.params as { id: string }

  let body: { item_key?: string; description?: string; sort_order?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { item_key, description, sort_order = 0 } = body

  if (!item_key || !description) {
    return NextResponse.json(
      { error: 'item_key and description are required' },
      { status: 400 }
    )
  }

  // Look up the section to get company_code and section_key
  const section = await prisma.clearanceSectionTemplate.findUnique({ where: { id } })
  if (!section) {
    return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
  }

  try {
    const item = await prisma.clearanceItemTemplate.create({
      data: {
        company_code: section.company_code,
        section_key: section.section_key,
        item_key,
        description,
        sort_order,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: `Item '${item_key}' already exists in this section` },
        { status: 409 }
      )
    }
    console.error('[POST /api/admin/templates/[id]/items] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
