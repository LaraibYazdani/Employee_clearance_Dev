import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/admin/users
// Returns all users with their roles
// SUPER_ADMIN only
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        sf_employee_id: true,
        full_name: true,
        email: true,
        grade: true,
        designation: true,
        department: true,
        division: true,
        company: true,
        roles: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { full_name: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[GET /api/admin/users] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/users
// Body: { userId: string, roles: string[] }
// Updates a user's roles
// SUPER_ADMIN only
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; roles?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, roles } = body

  if (!userId || !Array.isArray(roles)) {
    return NextResponse.json(
      { error: 'userId (string) and roles (string[]) are required' },
      { status: 400 }
    )
  }

  // Validate role values
  const validRoles = [
    'HRBP',
    'DEPT_APPROVER_IR',
    'DEPT_APPROVER_IT',
    'DEPT_APPROVER_SUPPLY',
    'DEPT_APPROVER_ICS',
    'DEPT_APPROVER_SECURITY',
    'DEPT_APPROVER_OTHER',
    'DEPT_APPROVER_HEAD',
    'DEPT_APPROVER_OD',
    'DEPT_APPROVER_HR',
    'DEPT_APPROVER_FINANCE',
    'EMPLOYEE',
    'SUPER_ADMIN',
  ]

  const invalidRoles = roles.filter((r) => !validRoles.includes(r))
  if (invalidRoles.length > 0) {
    return NextResponse.json(
      { error: `Invalid roles: ${invalidRoles.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, full_name: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { roles },
      select: {
        id: true,
        sf_employee_id: true,
        full_name: true,
        email: true,
        roles: true,
        department: true,
        grade: true,
        designation: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (error) {
    console.error('[PATCH /api/admin/users] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
