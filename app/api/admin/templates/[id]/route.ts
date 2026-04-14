import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// PATCH /api/admin/templates/[id]  — update a section template
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = context.params as { id: string }

  let body: {
    label?: string
    phase?: number
    sort_order?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.phase !== undefined && body.phase !== 2 && body.phase !== 3) {
    return NextResponse.json({ error: 'phase must be 2 or 3' }, { status: 400 })
  }

  try {
    const updated = await prisma.clearanceSectionTemplate.update({
      where: { id },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.phase !== undefined && { phase: body.phase }),
        ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
      },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
    }
    console.error('[PATCH /api/admin/templates/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/templates/[id]  — delete a section template (cascades items)
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = context.params as { id: string }

  try {
    await prisma.clearanceSectionTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
    }
    console.error('[DELETE /api/admin/templates/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
