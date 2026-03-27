import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/admin/clearances
// Query params: status, search, dateFrom, dateTo, page, pageSize
// SUPER_ADMIN only
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined
  const search = searchParams.get('search') || ''
  const dateFrom = searchParams.get('dateFrom') || undefined
  const dateTo = searchParams.get('dateTo') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10))
  )

  try {
    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.created_at = {}
      if (dateFrom) where.created_at.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        where.created_at.lte = end
      }
    }

    if (search.trim()) {
      where.OR = [
        { employee: { full_name: { contains: search, mode: 'insensitive' } } },
        { employee: { sf_employee_id: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const total = await prisma.clearanceRequest.count({ where })
    const totalPages = Math.ceil(total / pageSize)

    const clearances = await prisma.clearanceRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            sf_employee_id: true,
            department: true,
            grade: true,
            designation: true,
          },
        },
        initiated_by_hrbp: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json({ clearances, total, page, totalPages })
  } catch (error) {
    console.error('[GET /api/admin/clearances] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/clearances
// Body: { id, action: 'FORCE_COMPLETE' | 'CANCEL' }
// SUPER_ADMIN only
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, action } = body

  if (!id || !action || !['FORCE_COMPLETE', 'CANCEL'].includes(action)) {
    return NextResponse.json(
      { error: 'id and action (FORCE_COMPLETE | CANCEL) are required' },
      { status: 400 }
    )
  }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    if (clearance.status === 'COMPLETED' || clearance.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot action a clearance that is already ${clearance.status}` },
        { status: 409 }
      )
    }

    const newStatus = action === 'FORCE_COMPLETE' ? 'COMPLETED' : 'CANCELLED'

    const updated = await prisma.clearanceRequest.update({
      where: { id },
      data: {
        status: newStatus,
        ...(action === 'FORCE_COMPLETE'
          ? { pdf_generated: true, pdf_generated_at: new Date() }
          : {}),
      },
    })

    // Log the admin action
    await prisma.activityLog.create({
      data: {
        clearance_request_id: id,
        actor_id: user.id,
        action: action === 'FORCE_COMPLETE' ? 'ADMIN_FORCE_COMPLETE' : 'ADMIN_CANCEL',
        details: JSON.stringify({
          admin: user.full_name,
          previous_status: clearance.status,
          new_status: newStatus,
          timestamp: new Date().toISOString(),
        }),
      },
    })

    return NextResponse.json({ clearance: updated })
  } catch (error) {
    console.error('[PATCH /api/admin/clearances] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
