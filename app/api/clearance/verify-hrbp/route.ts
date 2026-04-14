import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHRBP } from '@/lib/successfactors'

// GET /api/clearance/verify-hrbp?employeeId=<dbId>
// Returns { allowed: true } or { allowed: false, message } or 503 if SF is down
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  // SUPER_ADMIN bypasses the check
  if (user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ allowed: true })
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { sf_employee_id: true, full_name: true },
  })
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  try {
    const hrbpResult = await getHRBP(employee.sf_employee_id)
    const sfHrbpId = hrbpResult?.hrbpId ?? null
    if (!sfHrbpId || sfHrbpId !== user.sf_employee_id) {
      return NextResponse.json({
        allowed: false,
        message: `You are not the assigned HRBP for ${employee.full_name} in SuccessFactors.`,
      })
    }
    return NextResponse.json({ allowed: true })
  } catch {
    return NextResponse.json(
      {
        error: 'Service Unavailable',
        message: 'Unable to verify HRBP status. SuccessFactors is currently unavailable. Please try again later.',
      },
      { status: 503 }
    )
  }
})
