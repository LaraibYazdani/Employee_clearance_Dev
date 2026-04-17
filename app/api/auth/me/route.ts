import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'

async function handler(req: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const userId = req.user!.id

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dbUser, { status: 200 })
  } catch (error) {
    console.error('GET /api/auth/me error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler)
