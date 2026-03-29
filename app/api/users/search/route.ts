import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/users/search?q=<query>
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return NextResponse.json([])
  }

  // Search in DB
  const dbUsers = await prisma.user.findMany({
    where: {
      OR: [
        { full_name: { contains: q } },
        { email: { contains: q } },
        { sf_employee_id: { contains: q } },
      ],
    },
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
    take: 20,
  })

  return NextResponse.json(dbUsers)
})
