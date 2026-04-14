import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            sf_employee_id: true,
            full_name: true,
            email: true,
            designation: true,
            department: true,
            grade: true,
            division: true,
            company: true,
            hrbp_id: true,
            line_manager_id: true,
          },
        },
        initiated_by_hrbp: {
          select: { id: true, full_name: true, email: true, designation: true },
        },
        clearance_sections: {
          orderBy: { created_at: 'asc' },
          include: {
            clearance_items: { orderBy: { created_at: 'asc' } },
          },
        },
        finance_entries: { orderBy: { created_at: 'asc' } },
        activity_logs: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: {
            actor: { select: { id: true, full_name: true, email: true } },
          },
        },
      },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Access control
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
    const isSubjectEmployee = clearance.employee_id === user.id

    if (!isSuperAdmin && !isOwnerHRBP && !isDeptApprover && !isSubjectEmployee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Normalize Prisma relation names to match frontend types
    const normalized = {
      ...clearance,
      sections: clearance.clearance_sections.map((s) => ({
        ...s,
        items: s.clearance_items,
      })),
    }

    return NextResponse.json(normalized)
  } catch (error) {
    console.error('[GET /api/clearance/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id } = context.params as { id: string }

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Only SUPER_ADMIN can force update clearance status' }, { status: 403 })
  }

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 })
  }

  const allowedStatuses = ['IN_PROGRESS', 'PENDING_HRBP', 'COMPLETED', 'CANCELLED']
  if (!allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.clearanceRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    const updated = await prisma.clearanceRequest.update({
      where: { id },
      data: { status: body.status },
    })

    await prisma.activityLog.create({
      data: {
        clearance_request_id: id,
        actor_id: user.id,
        action: 'STATUS_UPDATED',
        details: JSON.stringify({
          message: `Status force-updated to ${body.status} by SUPER_ADMIN ${user.full_name}`,
          previous_status: existing.status,
          new_status: body.status,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
