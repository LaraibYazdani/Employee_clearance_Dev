import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateClearancePDF } from '@/lib/pdf'

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/pdf
// Accessible to: HRBP owner or SUPER_ADMIN
// Only works when status is COMPLETED
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      select: {
        id: true,
        status: true,
        initiated_by_hrbp_id: true,
        employee: { select: { sf_employee_id: true, full_name: true } },
      },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Access control: HRBP owner or SUPER_ADMIN
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP =
      user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id

    if (!isSuperAdmin && !isOwnerHRBP) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only generate PDF for COMPLETED clearances
    if (clearance.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'PDF only available for completed clearances',
          message: `Clearance status is ${clearance.status}. PDF can only be generated when status is COMPLETED.`,
        },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBuffer = await generateClearancePDF(clearanceId)

    const employeeId = clearance.employee?.sf_employee_id ?? clearanceId
    const filename = `clearance-${employeeId}-${clearanceId}.pdf`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('[GET /api/clearance/[id]/pdf] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
