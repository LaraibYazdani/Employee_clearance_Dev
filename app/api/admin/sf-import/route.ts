import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchEmployees, getUserProfile, getEmpJob, COMPANY_CODE_MAP, SFUserProfile } from '@/lib/successfactors'

// GET /api/admin/sf-import?q=<query>
// Search SuccessFactors for users — returns results annotated with inDb flag
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const isNumericId = /^\d+$/.test(q)
  let sfUsers: SFUserProfile[] = []

  try {
    if (isNumericId) {
      // For numeric employee IDs: use direct profile lookup (userId eq) — confirmed working
      // searchEmployees uses substringof which SF does not support on userId field
      const profile = await getUserProfile(q)
      if (profile) {
        sfUsers = [profile]
      }
    } else {
      sfUsers = await searchEmployees(q)
    }
  } catch (err: any) {
    console.error('[sf-import GET] SF error:', err)
    return NextResponse.json({ error: 'SuccessFactors search failed', message: err?.message }, { status: 502 })
  }

  if (sfUsers.length === 0) {
    return NextResponse.json([])
  }

  // Check which SF user IDs are already in DB
  const sfIds = sfUsers.map((u) => u.userId)
  const existing = await prisma.user.findMany({
    where: { sf_employee_id: { in: sfIds } },
    select: { id: true, sf_employee_id: true },
  })
  const existingIds = new Set(existing.map((u) => u.sf_employee_id))
  const dbIdMap: Record<string, string> = {}
  for (const u of existing) {
    dbIdMap[u.sf_employee_id] = u.id
  }

  return NextResponse.json(
    sfUsers.map((u) => ({
      sf_employee_id: u.userId,
      full_name: u.displayName,
      email: u.email,
      designation: u.title,
      department: u.department,
      grade: u.payGrade,
      inDb: existingIds.has(u.userId),
      dbId: dbIdMap[u.userId] ?? null,
    }))
  )
})

// POST /api/admin/sf-import
// Body: { sf_user_id }
// Imports (or re-syncs) a SF user into the local DB with a placeholder password hash
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { sf_user_id } = body

  if (!sf_user_id) {
    return NextResponse.json({ error: 'sf_user_id is required' }, { status: 400 })
  }

  const [profile, job] = await Promise.all([
    getUserProfile(sf_user_id),
    getEmpJob(sf_user_id),
  ])

  if (!profile) {
    return NextResponse.json(
      { error: 'User not found in SuccessFactors' },
      { status: 404 }
    )
  }

  const companyCode = job?.company ?? ''
  const companyName = COMPANY_CODE_MAP[companyCode] ?? companyCode
  const designation = job?.jobTitle || job?.localJobTitle || profile.title || ''
  const payGrade = job?.payGrade ?? profile.payGrade ?? ''

  // Placeholder hash — will be replaced on first successful SF login
  const placeholderHash = await hashPassword(`SF_PLACEHOLDER_${sf_user_id}_${Date.now()}`)

  const existing = await prisma.user.findUnique({ where: { sf_employee_id: sf_user_id } })

  let dbUser
  if (!existing) {
    dbUser = await prisma.user.create({
      data: {
        sf_employee_id: sf_user_id,
        full_name: profile.displayName,
        email: profile.email || `${sf_user_id}@packagesli.com`,
        password_hash: placeholderHash,
        grade: payGrade,
        designation,
        department: profile.department ?? '',
        division: profile.division ?? '',
        company: companyName,
        company_code: companyCode,
        roles: ['EMPLOYEE'],
        sf_synced_at: new Date(),
      },
      select: {
        id: true,
        sf_employee_id: true,
        full_name: true,
        email: true,
        designation: true,
        department: true,
        grade: true,
        company_code: true,
      },
    })
  } else {
    // Re-sync SF data but preserve roles and password
    dbUser = await prisma.user.update({
      where: { id: existing.id },
      data: {
        full_name: profile.displayName,
        email: profile.email || existing.email,
        grade: payGrade,
        designation,
        department: profile.department ?? existing.department,
        division: profile.division ?? existing.division,
        company: companyName || existing.company,
        company_code: companyCode || existing.company_code,
        sf_synced_at: new Date(),
      },
      select: {
        id: true,
        sf_employee_id: true,
        full_name: true,
        email: true,
        designation: true,
        department: true,
        grade: true,
        company_code: true,
      },
    })
  }

  return NextResponse.json({
    success: true,
    imported: !existing,
    user: dbUser,
  })
})
