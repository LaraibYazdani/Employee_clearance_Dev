import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/notifications/[id] — mark specific notification as read
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: { params: { id: string } }) => {
  const userId = req.user!.id
  const { id } = context.params

  const existing = await prisma.notification.findFirst({
    where: { id, recipient_id: userId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  })

  return NextResponse.json(updated)
})

// DELETE /api/notifications/[id] — delete a notification
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: { params: { id: string } }) => {
  const userId = req.user!.id
  const { id } = context.params

  const existing = await prisma.notification.findFirst({
    where: { id, recipient_id: userId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  await prisma.notification.delete({ where: { id } })

  return NextResponse.json({ success: true })
})
