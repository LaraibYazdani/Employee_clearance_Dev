import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndCompleteClearance } from '@/lib/clearance-workflow'
import { notifyObjectionResolved } from '@/lib/notifications'

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/objections/[threadId]/resolve
// Payroll Manager resolves an objection — item + section revert to APPROVED
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, threadId } = context.params as { id: string; threadId: string }

  if (!user.roles.includes('PAYROLL_MANAGER') && !user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Only the Payroll Manager can resolve objections' }, { status: 403 })
  }

  try {
    const thread = await prisma.objectionThread.findUnique({
      where: { id: threadId },
      include: {
        clearance_item: {
          include: { clearance_section: true },
        },
      },
    })

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    if (thread.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Thread does not belong to this clearance' }, { status: 400 })
    }
    if (thread.status === 'RESOLVED') {
      return NextResponse.json({ error: 'Thread is already resolved' }, { status: 409 })
    }

    const now = nowPKT()
    const section = thread.clearance_item.clearance_section
    const sectionId = section.id

    await prisma.$transaction(async (tx) => {
      // Resolve the thread
      await tx.objectionThread.update({
        where: { id: threadId },
        data: { status: 'RESOLVED', resolved_at: now },
      })

      // Restore item to APPROVED
      await tx.clearanceItem.update({
        where: { id: thread.clearance_item_id },
        data: { status: 'APPROVED' },
      })

      // Check if any OTHER items in this section are still objected
      const remainingObjections = await tx.objectionThread.findFirst({
        where: {
          clearance_section_id: sectionId,
          status: 'OPEN',
          id: { not: threadId },
        },
        select: { id: true, clearance_item: { select: { description: true } } },
      })

      if (remainingObjections) {
        // Another item is still objected — keep section OBJECTED with updated note
        await tx.clearanceSection.update({
          where: { id: sectionId },
          data: {
            note: `Objection on item: ${remainingObjections.clearance_item.description}`,
          },
        })
      } else {
        // All items resolved — check if section can go back to APPROVED
        const allItems = await tx.clearanceItem.findMany({
          where: { clearance_section_id: sectionId },
          select: { status: true },
        })
        const allApproved = allItems.every((i) => i.status === 'APPROVED' || i.status === 'NA')
        await tx.clearanceSection.update({
          where: { id: sectionId },
          data: {
            status: allApproved ? 'APPROVED' : 'PENDING',
            note: null,
            ...(allApproved
              ? { approver_id: user.id, approver_name: user.full_name, decision_at: now }
              : {}),
          },
        })
      }

      await tx.activityLog.create({
        data: {
          clearance_request_id: clearanceId,
          actor_id: user.id,
          action: 'OBJECTION_RESOLVED',
          details: JSON.stringify({
            thread_id: threadId,
            item_id: thread.clearance_item_id,
            item_description: thread.clearance_item.description,
            timestamp: now.toISOString(),
          }),
        },
      })
    })

    // Notify assigned approver (email + in-app) and HRBP (in-app) of resolution
    try {
      await notifyObjectionResolved(
        clearanceId,
        thread.assigned_approver_id,
        thread.clearance_item.description,
        user.full_name
      )
    } catch (e) {
      console.error('[resolve objection] notifyObjectionResolved error:', e)
    }

    // In case this unlocks clearance completion
    try {
      await checkAndCompleteClearance(clearanceId)
    } catch (e) {
      console.error('[resolve objection] checkAndCompleteClearance error:', e)
    }

    const updatedThread = await prisma.objectionThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
          include: { sender: { select: { id: true, full_name: true } } },
        },
        raised_by: { select: { id: true, full_name: true } },
        assigned_approver: { select: { id: true, full_name: true } },
        clearance_item: { select: { id: true, description: true } },
      },
    })

    return NextResponse.json(updatedThread)
  } catch (error) {
    console.error('[POST resolve objection] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
