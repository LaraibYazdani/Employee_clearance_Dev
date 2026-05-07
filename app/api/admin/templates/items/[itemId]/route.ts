import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { removeApproverForItem } from '@/lib/approver-resolver'

// ---------------------------------------------------------------------------
// PATCH /api/admin/templates/items/[itemId]  — update an item
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { itemId } = context.params as { itemId: string }

  let body: { description?: string; sort_order?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const updated = await prisma.clearanceItemTemplate.update({
      where: { id: itemId },
      data: {
        ...(body.description !== undefined && { description: body.description }),
        ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
      },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    console.error('[PATCH /api/admin/templates/items/[itemId]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/templates/items/[itemId]  — delete an item
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { itemId } = context.params as { itemId: string }

  try {
    // Fetch the item first so we can clean up its approver assignment
    const item = await prisma.clearanceItemTemplate.findUnique({
      where: { id: itemId },
      select: { company_code: true, section_key: true, item_key: true },
    })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Remove any per-item approver assignment and revoke role if no longer needed
    await removeApproverForItem(item.company_code, item.section_key, item.item_key)

    await prisma.clearanceItemTemplate.delete({ where: { id: itemId } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    console.error('[DELETE /api/admin/templates/items/[itemId]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
