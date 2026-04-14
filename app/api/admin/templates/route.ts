import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/admin/templates?companyCode=1000
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyCode = searchParams.get('companyCode')

  if (!companyCode) {
    return NextResponse.json({ error: 'companyCode is required' }, { status: 400 })
  }

  try {
    const [sections, items] = await Promise.all([
      prisma.clearanceSectionTemplate.findMany({
        where: { company_code: companyCode },
        orderBy: { sort_order: 'asc' },
      }),
      prisma.clearanceItemTemplate.findMany({
        where: { company_code: companyCode },
        orderBy: { sort_order: 'asc' },
      }),
    ])

    const result = sections.map((s) => ({
      ...s,
      items: items.filter((i) => i.section_key === s.section_key),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/admin/templates] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/templates  — add a section template
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    company_code?: string
    section_key?: string
    label?: string
    phase?: number
    sort_order?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_code, section_key, label, phase = 2, sort_order = 0 } = body

  if (!company_code || !section_key || !label) {
    return NextResponse.json(
      { error: 'company_code, section_key, and label are required' },
      { status: 400 }
    )
  }

  if (phase !== 2 && phase !== 3) {
    return NextResponse.json({ error: 'phase must be 2 or 3' }, { status: 400 })
  }

  try {
    const section = await prisma.clearanceSectionTemplate.create({
      data: { company_code, section_key, label, phase, sort_order },
    })
    return NextResponse.json({ ...section, items: [] }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: `Section '${section_key}' already exists for company ${company_code}` },
        { status: 409 }
      )
    }
    console.error('[POST /api/admin/templates] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
