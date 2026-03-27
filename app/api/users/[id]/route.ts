import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/users/[id] — returns user by ID (without password_hash)
export const GET = withAuth(async (req: AuthenticatedRequest, context: { params: { id: string } }) => {
  const { id } = context.params

  const user = await prisma.user.findUnique({
    where: { id },
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
      hrbp_id: true,
      line_manager_id: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(user)
})
