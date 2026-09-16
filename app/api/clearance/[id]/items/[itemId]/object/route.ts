import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyApproverObjection } from '@/lib/notifications'

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/items/[itemId]/object
// Payroll Manager raises an objection on an approved item
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, itemId } = context.params as { id: string; itemId: string }

  if (!user.roles.includes('PAYROLL_MANAGER') && !user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Only the Payroll Manager can raise objections' }, { status: 403 })
  }

  let body: { comment: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.comment?.trim()) {
    return NextResponse.json({ error: 'A comment explaining the objection is required' }, { status: 400 })
  }

  try {
    const item = await prisma.clearanceItem.findUnique({
      where: { id: itemId },
      include: { clearance_section: true },
    })

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (item.clearance_section.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Item does not belong to this clearance' }, { status: 400 })
    }
    if (item.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Can only object to an approved item' }, { status: 409 })
    }
    if (!item.approver_id) {
      return NextResponse.json({ error: 'Item has no recorded approver to route the objection to' }, { status: 409 })
    }

    // Check there is no open objection thread for this item already
    const existing = await prisma.objectionThread.findFirst({
      where: { clearance_item_id: itemId, status: 'OPEN' },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'An open objection already exists for this item' }, { status: 409 })
    }

    const now = nowPKT()

    // Create thread + initial PM message in a transaction
    const thread = await prisma.$transaction(async (tx) => {
      // Mark item as OBJECTED
      await tx.clearanceItem.update({
        where: { id: itemId },
        data: { status: 'OBJECTED' },
      })

      // Mark section as OBJECTED
      await tx.clearanceSection.update({
        where: { id: item.clearance_section_id },
        data: {
          status: 'OBJECTED',
          note: `Objection on item: ${item.description}`,
        },
      })

      const t = await tx.objectionThread.create({
        data: {
          clearance_request_id: clearanceId,
          clearance_section_id: item.clearance_section_id,
          clearance_item_id: itemId,
          raised_by_id: user.id,
          assigned_approver_id: item.approver_id!,
          status: 'OPEN',
          messages: {
            create: {
              sender_id: user.id,
              message: body.comment.trim(),
              created_at: now,
            },
          },
        },
        include: {
          messages: {
            include: { sender: { select: { id: true, full_name: true } } },
          },
          raised_by: { select: { id: true, full_name: true } },
          assigned_approver: { select: { id: true, full_name: true } },
          clearance_item: { select: { id: true, description: true } },
        },
      })

      await tx.activityLog.create({
        data: {
          clearance_request_id: clearanceId,
          actor_id: user.id,
          action: 'ITEM_OBJECTED',
          details: JSON.stringify({
            item_id: itemId,
            item_description: item.description,
            section_key: item.clearance_section.section_key,
            comment: body.comment.trim(),
            timestamp: now.toISOString(),
          }),
        },
      })

      return t
    })

    // Notify the item's original approver
    try {
      await notifyApproverObjection(clearanceId, item.approver_id!, item.description, body.comment.trim())
    } catch (e) {
      console.error('[POST object] notifyApproverObjection error:', e)
    }

    return NextResponse.json(thread, { status: 201 })
  } catch (error) {
    console.error('[POST /api/clearance/[id]/items/[itemId]/object] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
