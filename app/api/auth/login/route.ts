import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, hashPassword, comparePassword } from '@/lib/auth'
import {
  authenticateWithSF,
  authenticateUser,
  getUserProfile,
  getEmpJob,
  getHRBP,
  COMPANY_CODE_MAP,
} from '@/lib/successfactors'

const isMock = process.env.SF_MOCK_MODE === 'true'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Extract userId — format is either "userId@packagesli" or just "userId"
    // or a full email like "name@company.com"
    const userId = email.includes('@') ? email.split('@')[0] : email

    let sfAuthSuccess = false
    let dbUser = null

    // -----------------------------------------------------------------------
    // MOCK MODE: use legacy authenticateUser
    // -----------------------------------------------------------------------
    if (isMock) {
      const sfUser = await authenticateUser(email, password)
      if (!sfUser) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid email or password' },
          { status: 401 }
        )
      }

      dbUser = await prisma.user.findUnique({ where: { sf_employee_id: sfUser.sf_employee_id } })
      if (!dbUser) {
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
          },
        })
      } else {
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
          },
        })
      }
    } else {
      // -----------------------------------------------------------------------
      // LIVE MODE: try SF first, fall back to portal DB credentials
      // -----------------------------------------------------------------------
      try {
        sfAuthSuccess = await authenticateWithSF(userId, password)
      } catch (err) {
        console.error('[login] SF auth error (will try fallback):', err)
        sfAuthSuccess = false
      }

      if (sfAuthSuccess) {
        // SF auth succeeded — fetch profile via SAML Bearer token
        const [profile, job, hrbpResult] = await Promise.all([
          getUserProfile(userId),
          getEmpJob(userId),
          getHRBP(userId),
        ])

        const companyCode = job?.company ?? ''
        const companyName = COMPANY_CODE_MAP[companyCode] ?? companyCode
        const designation = job?.jobTitle || job?.localJobTitle || profile?.title || ''
        const passwordHash = await hashPassword(password)

        // Use SF profile data where available, fall back to userId-based defaults
        const displayName = profile?.displayName || userId
        const userEmail = profile?.email || `${userId}@packagesli.com`
        const payGrade = job?.payGrade ?? profile?.payGrade ?? ''
        const department = profile?.department ?? ''
        const division = profile?.division ?? ''

        // Resolve HRBP and manager DB IDs
        let hrbpDbId: string | null = null
        let managerDbId: string | null = null

        if (hrbpResult?.hrbpId) {
          const hrbpUser = await prisma.user.findUnique({
            where: { sf_employee_id: hrbpResult.hrbpId },
            select: { id: true },
          })
          hrbpDbId = hrbpUser?.id ?? null
        }

        if (job?.managerId) {
          const managerUser = await prisma.user.findUnique({
            where: { sf_employee_id: job.managerId },
            select: { id: true },
          })
          managerDbId = managerUser?.id ?? null
        }

        // Upsert user in DB — preserve existing roles (manually assigned)
        const existing = await prisma.user.findUnique({ where: { sf_employee_id: userId } })

        if (!existing) {
          dbUser = await prisma.user.create({
            data: {
              sf_employee_id: userId,
              full_name: displayName,
              email: userEmail,
              password_hash: passwordHash,
              grade: payGrade,
              designation,
              department,
              division,
              company: companyName,
              company_code: companyCode,
              roles: ['EMPLOYEE'],
              hrbp_id: hrbpDbId,
              line_manager_id: managerDbId,
              sf_synced_at: new Date(),
            },
          })
        } else {
          dbUser = await prisma.user.update({
            where: { id: existing.id },
            data: {
              full_name: displayName,
              email: userEmail,
              password_hash: passwordHash,
              grade: payGrade,
              designation,
              department,
              division,
              company: companyName,
              company_code: companyCode,
              hrbp_id: hrbpDbId ?? existing.hrbp_id,
              line_manager_id: managerDbId ?? existing.line_manager_id,
              sf_synced_at: new Date(),
              // roles NOT updated — managed manually
            },
          })
        }
      } else {
        // SF auth failed or SF unavailable — try portal fallback
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              { sf_employee_id: userId },
              { email: email.toLowerCase() },
            ],
          },
        })

        if (!existing) {
          return NextResponse.json(
            {
              error: 'Unauthorized',
              message: 'Account not found. Please use your SuccessFactors credentials to log in for the first time.',
            },
            { status: 401 }
          )
        }

        const passwordMatch = await comparePassword(password, existing.password_hash)
        if (!passwordMatch) {
          return NextResponse.json(
            { error: 'Unauthorized', message: 'Invalid credentials' },
            { status: 401 }
          )
        }

        dbUser = existing
      }
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Default role assignment if empty
    const roles = Array.isArray(dbUser.roles) && (dbUser.roles as string[]).length > 0
      ? (dbUser.roles as string[])
      : ['EMPLOYEE']

    const token = signToken({
      id: dbUser.id,
      sf_employee_id: dbUser.sf_employee_id,
      email: dbUser.email,
      full_name: dbUser.full_name,
      roles,
    })

    return NextResponse.json({
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
        company_code: dbUser.company_code,
        roles,
      },
    })
  } catch (error: any) {
    console.error('[login] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message ?? 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
