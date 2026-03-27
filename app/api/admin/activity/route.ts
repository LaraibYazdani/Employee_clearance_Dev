import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/admin/activity
// Query params: clearanceId, actorId, action, page, pageSize
// Returns global activity log across all clearances
// SUPER_ADMIN only
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const clearanceId = searchParams.get('clearanceId') || undefined
  const actorId = searchParams.get('actorId') || undefined
  const actionFilter = searchParams.get('action') || undefined
  const actorSearch = searchParams.get('actorSearch') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
  )

  try {
    const where: any = {}

    if (clearanceId) where.clearance_request_id = clearanceId
    if (actorId) where.actor_id = actorId
    if (actionFilter) where.action = actionFilter

    if (actorSearch.trim()) {
      where.actor = {
        full_name: { contains: actorSearch, mode: 'insensitive' },
      }
    }

    const total = await prisma.activityLog.count({ where })
    const totalPages = Math.ceil(total / pageSize)

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            full_name: true,
            email: true,
            roles: true,
          },
        },
        clearance_request: {
          select: {
            id: true,
            status: true,
            employee: {
              select: {
                full_name: true,
                sf_employee_id: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json({ activities, total, page, totalPages })
  } catch (error) {
    console.error('[GET /api/admin/activity] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
