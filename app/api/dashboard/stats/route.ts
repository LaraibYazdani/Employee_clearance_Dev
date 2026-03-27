import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/stats — returns role-specific dashboard statistics
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { id: userId, roles } = req.user!

  const isSuperAdmin = roles.includes('SUPER_ADMIN')
  const isHRBP = roles.includes('HRBP')
  const isDeptApprover = roles.some((r) => r.startsWith('DEPT_APPROVER_'))

  // ── SUPER_ADMIN stats ─────────────────────────────────────────────────────
  if (isSuperAdmin) {
    const [totalActive, totalCompleted, totalPending, totalCancelled] = await Promise.all([
      prisma.clearanceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.clearanceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.clearanceRequest.count({ where: { status: { in: ['DRAFT', 'PENDING_HRBP'] } } }),
      prisma.clearanceRequest.count({ where: { status: 'CANCELLED' } }),
    ])

    return NextResponse.json({ totalActive, totalCompleted, totalPending, totalCancelled })
  }

  // ── HRBP stats ────────────────────────────────────────────────────────────
  if (isHRBP) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [activeClearances, pendingIntervention, completedThisMonth, totalClearances] =
      await Promise.all([
        prisma.clearanceRequest.count({
          where: {
            initiated_by_hrbp_id: userId,
            status: { in: ['IN_PROGRESS', 'DRAFT'] },
          },
        }),
        prisma.clearanceRequest.count({
          where: {
            initiated_by_hrbp_id: userId,
            status: 'PENDING_HRBP',
          },
        }),
        prisma.clearanceRequest.count({
          where: {
            initiated_by_hrbp_id: userId,
            status: 'COMPLETED',
            updated_at: { gte: startOfMonth },
          },
        }),
        prisma.clearanceRequest.count({
          where: { initiated_by_hrbp_id: userId },
        }),
      ])

    return NextResponse.json({
      activeClearances,
      pendingIntervention,
      completedThisMonth,
      totalClearances,
    })
  }

  // ── DEPT_APPROVER stats ───────────────────────────────────────────────────
  if (isDeptApprover) {
    const [pendingApprovals, completedApprovals, deniedCount] = await Promise.all([
      prisma.clearanceSection.count({
        where: { approver_id: userId, status: 'PENDING' },
      }),
      prisma.clearanceSection.count({
        where: { approver_id: userId, status: 'APPROVED' },
      }),
      prisma.clearanceSection.count({
        where: { approver_id: userId, status: 'DENIED' },
      }),
    ])

    return NextResponse.json({ pendingApprovals, completedApprovals, deniedCount })
  }

  // Fallback for EMPLOYEE or unknown roles
  return NextResponse.json({})
})
