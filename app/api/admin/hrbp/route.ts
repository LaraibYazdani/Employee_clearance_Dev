import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/admin/hrbp — list all users with the HRBP role
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  if (!req.user!.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: {
      roles: { array_contains: 'HRBP' },
    },
    select: {
      id: true,
      sf_employee_id: true,
      full_name: true,
      email: true,
      designation: true,
      department: true,
      roles: true,
    },
    orderBy: { full_name: 'asc' },
  })

  return NextResponse.json(users)
})

// ---------------------------------------------------------------------------
// POST /api/admin/hrbp — manually grant HRBP role to a user
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  if (!req.user!.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
  if (currentRoles.includes('HRBP')) {
    return NextResponse.json({ message: 'User already has HRBP role' })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { roles: [...currentRoles, 'HRBP'] },
    select: { id: true, full_name: true, roles: true },
  })

  return NextResponse.json(updated)
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/hrbp — remove HRBP role from a user
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  if (!req.user!.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { roles: currentRoles.filter((r) => r !== 'HRBP') },
    select: { id: true, full_name: true, roles: true },
  })

  return NextResponse.json(updated)
})
