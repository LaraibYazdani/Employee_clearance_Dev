import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchEmployees } from '@/lib/successfactors'

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

  // Optionally augment with SF mock data
  if (process.env.SF_MOCK_MODE === 'true') {
    try {
      const sfUsers = await searchEmployees(q)

      // Merge: prefer DB records, add SF-only records as enrichment hints
      const dbIds = new Set(dbUsers.map((u) => u.sf_employee_id))
      const sfOnly = sfUsers
        .filter((sf) => !dbIds.has(sf.sf_employee_id))
        .map((sf) => ({
          id: null,
          sf_employee_id: sf.sf_employee_id,
          full_name: sf.full_name,
          email: sf.email,
          grade: sf.grade,
          designation: sf.designation,
          department: sf.department,
          division: sf.division,
          company: sf.company,
          roles: sf.roles,
          hrbp_id: sf.hrbp_id ?? null,
          line_manager_id: sf.line_manager_id ?? null,
          created_at: null,
          updated_at: null,
          source: 'sf_only',
        }))

      return NextResponse.json([...dbUsers, ...sfOnly])
    } catch {
      // SF lookup failed — return DB results only
    }
  }

  return NextResponse.json(dbUsers)
})
