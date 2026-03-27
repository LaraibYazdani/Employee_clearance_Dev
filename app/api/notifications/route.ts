import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notifications — returns all notifications for the authenticated user
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const userId = req.user!.id

  const notifications = await prisma.notification.findMany({
    where: { recipient_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      clearance_request: {
        select: {
          id: true,
          status: true,
          employee: {
            select: { id: true, full_name: true, email: true },
          },
        },
      },
    },
  })

  return NextResponse.json(notifications)
})

// PATCH /api/notifications — mark a notification as read
export const PATCH = withAuth(async (req: AuthenticatedRequest) => {
  const userId = req.user!.id

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
  }

  // Ensure the notification belongs to the current user
  const existing = await prisma.notification.findFirst({
    where: { id: body.id, recipient_id: userId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id: body.id },
    data: { read: true },
  })

  return NextResponse.json(updated)
})
