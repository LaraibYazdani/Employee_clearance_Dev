import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyHRBPCompletion } from '@/lib/notifications'

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/complete
// Payroll manager final sign-off — marks clearance as COMPLETED
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  if (!user.roles.includes('PAYROLL_MANAGER') && !user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id },
      include: { employee: { select: { company_code: true } } },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    if (clearance.status !== 'PENDING_PAYROLL' && !user.roles.includes('SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Clearance is not pending payroll sign-off' },
        { status: 409 }
      )
    }

    // Verify the user is the assigned payroll manager for this company (skip for SUPER_ADMIN)
    if (!user.roles.includes('SUPER_ADMIN')) {
      const companyCode = clearance.employee.company_code ?? '1000'
      const assignment = await prisma.approverAssignment.findFirst({
        where: { company_code: companyCode, section_key: 'PAYROLL_MANAGER', approver_id: user.id },
        select: { id: true },
      })
      if (!assignment) {
        return NextResponse.json(
          { error: 'Forbidden: you are not the assigned payroll manager for this company' },
          { status: 403 }
        )
      }
    }

    const now = nowPKT()

    await prisma.clearanceRequest.update({
      where: { id },
      data: { status: 'COMPLETED', pdf_generated: true, pdf_generated_at: now },
    })

    await prisma.activityLog.create({
      data: {
        clearance_request_id: id,
        actor_id: user.id,
        action: 'COMPLETION',
        details: JSON.stringify({
          message: `Clearance completed by Payroll Manager ${user.full_name}.`,
          timestamp: now.toISOString(),
        }),
      },
    })

    try {
      await notifyHRBPCompletion(id)
    } catch (e) {
      console.error('[POST /api/clearance/[id]/complete] notifyHRBPCompletion error:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/clearance/[id]/complete] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
