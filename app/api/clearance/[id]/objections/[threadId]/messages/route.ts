import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyObjectionMessage } from '@/lib/notifications'

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/objections/[threadId]/messages
// Add a message to an objection thread (PM or assigned approver only)
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, threadId } = context.params as { id: string; threadId: string }

  let body: { message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  try {
    const thread = await prisma.objectionThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        clearance_request_id: true,
        raised_by_id: true,
        assigned_approver_id: true,
        status: true,
        clearance_item: { select: { description: true } },
      },
    })

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    if (thread.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Thread does not belong to this clearance' }, { status: 400 })
    }
    if (thread.status === 'RESOLVED') {
      return NextResponse.json({ error: 'Cannot add messages to a resolved thread' }, { status: 409 })
    }

    const canPost =
      user.roles.includes('SUPER_ADMIN') ||
      user.id === thread.raised_by_id ||
      user.id === thread.assigned_approver_id

    if (!canPost) {
      return NextResponse.json({ error: 'You are not a participant in this objection thread' }, { status: 403 })
    }

    const message = await prisma.objectionMessage.create({
      data: {
        thread_id: threadId,
        sender_id: user.id,
        message: body.message.trim(),
        created_at: nowPKT(),
      },
      include: { sender: { select: { id: true, full_name: true } } },
    })

    // Notify the OTHER party in the thread
    const recipientId = user.id === thread.raised_by_id
      ? thread.assigned_approver_id
      : thread.raised_by_id

    try {
      await notifyObjectionMessage(
        clearanceId,
        threadId,
        user.id,
        user.full_name,
        recipientId,
        thread.clearance_item?.description ?? 'item',
        body.message.trim()
      )
    } catch (e) {
      console.error('[POST objection message] notifyObjectionMessage error:', e)
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('[POST objection message] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
