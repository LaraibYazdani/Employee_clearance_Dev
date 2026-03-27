import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/activity
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      select: { id: true, initiated_by_hrbp_id: true },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Access control: HRBP owner, any DEPT_APPROVER, or SUPER_ADMIN
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id

    if (!isSuperAdmin && !isOwnerHRBP && !isDeptApprover) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const logs = await prisma.activityLog.findMany({
      where: { clearance_request_id: clearanceId },
      orderBy: { created_at: 'desc' },
      include: {
        actor: {
          select: { id: true, full_name: true, email: true, designation: true },
        },
      },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('[GET /api/clearance/[id]/activity] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
