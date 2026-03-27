import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, hashPassword } from '@/lib/auth'
import { authenticateUser } from '@/lib/successfactors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate against SuccessFactors (mock or live)
    const sfUser = await authenticateUser(email, password)

    if (!sfUser) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Look up or create the user in the local DB
    let dbUser = await prisma.user.findUnique({
      where: { sf_employee_id: sfUser.sf_employee_id },
    })

    if (!dbUser) {
      // First-time login: create user record in DB
      const passwordHash = await hashPassword(password)

      dbUser = await prisma.user.create({
        data: {
          sf_employee_id: sfUser.sf_employee_id,
          full_name: sfUser.full_name,
          email: sfUser.email,
          password_hash: passwordHash,
          grade: sfUser.grade,
          designation: sfUser.designation,
          department: sfUser.department,
          division: sfUser.division,
          company: sfUser.company,
          roles: sfUser.roles,
          // hrbp_id and line_manager_id are SF IDs, not DB IDs — store as metadata strings
          // They will be resolved to DB user IDs separately if needed
        },
      })
    } else {
      // Update user info from SF on each login to keep data fresh
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          full_name: sfUser.full_name,
          email: sfUser.email,
          grade: sfUser.grade,
          designation: sfUser.designation,
          department: sfUser.department,
          division: sfUser.division,
          company: sfUser.company,
          roles: sfUser.roles,
        },
      })
    }

    // Build JWT payload
    const tokenPayload = {
      id: dbUser.id,
      sf_employee_id: dbUser.sf_employee_id,
      email: dbUser.email,
      full_name: dbUser.full_name,
      roles: dbUser.roles,
    }

    const token = signToken(tokenPayload)

    return NextResponse.json(
      {
        message: 'Login successful',
        token,
        user: {
          id: dbUser.id,
          sf_employee_id: dbUser.sf_employee_id,
          full_name: dbUser.full_name,
          email: dbUser.email,
          grade: dbUser.grade,
          designation: dbUser.designation,
          department: dbUser.department,
          division: dbUser.division,
          company: dbUser.company,
          roles: dbUser.roles,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Login error:', error)

    if (error.message?.includes('NotImplementedError')) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Authentication service is not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
