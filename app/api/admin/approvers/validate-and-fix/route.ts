import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'

/**
 * POST /api/admin/approvers/validate-and-fix
 * 
 * Validates and automatically fixes common approver configuration issues:
 * 1. Grants missing DEPT_APPROVER_* roles to users with assignments
 * 2. Identifies missing ApproverAssignment records
 * 3. Optionally auto-approves pending items (with confirmation)
 * 
 * Query params:
 * - company=<code> : Company to fix (default: 1000)
 * - fixRoles=true : Auto-grant missing roles
 * - clearanceId=<id> : Fix pending items for specific clearance
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const user = req.user!

  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const companyCode = searchParams.get('company') ?? '1000'
  const fixRoles = searchParams.get('fixRoles') === 'true'
  const clearanceId = searchParams.get('clearanceId')

  try {
    const results: any = {
      company_code: companyCode,
      timestamp: new Date().toISOString(),
      fixes_applied: [],
      issues_found: [],
    }

    // ============================================================================
    // PART 1: Check and grant missing DEPT_APPROVER roles
    // ============================================================================

    const allAssignments = await prisma.approverAssignment.findMany({
      where: { company_code: companyCode },
      select: { section_key: true, approver_id: true },
      distinct: ['approver_id'],
    })

    const usersNeedingRoles: Record<string, string[]> = {} // user_id → [missing_roles]

    for (const assignment of allAssignments) {
      const user = await prisma.user.findUnique({
        where: { id: assignment.approver_id },
        select: { id: true, full_name: true, roles: true },
      })

      if (!user) continue

      const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
      const requiredRole = SECTION_ROLE_MAP[assignment.section_key]

      if (!requiredRole) continue

      if (!currentRoles.includes(requiredRole)) {
        if (!usersNeedingRoles[user.id]) {
          usersNeedingRoles[user.id] = []
        }
        usersNeedingRoles[user.id].push(requiredRole)
      }
    }

    if (Object.keys(usersNeedingRoles).length > 0) {
      results.issues_found.push({
        type: 'MISSING_DEPT_APPROVER_ROLES',
        count: Object.keys(usersNeedingRoles).length,
        users: usersNeedingRoles,
      })

      if (fixRoles) {
        for (const [userId, missingRoles] of Object.entries(usersNeedingRoles)) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { full_name: true, roles: true },
          })
          if (user) {
            const currentRoles = Array.isArray(user.roles) ? user.roles : []
            // Merge and deduplicate roles
            const allRoles = currentRoles.concat(missingRoles)
            const newRoles = allRoles.filter((role, index, self) => self.indexOf(role) === index)
            await prisma.user.update({
              where: { id: userId },
              data: { roles: newRoles },
            })
            results.fixes_applied.push({
              type: 'GRANTED_ROLES',
              user_id: userId,
              user_name: user.full_name,
              roles: missingRoles,
            })
          }
        }
      }
    }

    // ============================================================================
    // PART 2: Check for approvers without assignments in this company
    // ============================================================================

    const approvingUsers = await prisma.user.findMany({
      select: { id: true, full_name: true, roles: true },
    })

    const approvesWithoutAssignments = approvingUsers.filter((u) => {
      const roles = Array.isArray(u.roles) ? u.roles : []
      const hasDeptRole = roles.some((r) => typeof r === 'string' && r.startsWith('DEPT_APPROVER_'))

      if (!hasDeptRole) return false

      // Check if has assignment in this company
      const hasAssignment = allAssignments.some((a) => a.approver_id === u.id)
      return !hasAssignment
    })

    if (approvesWithoutAssignments.length > 0) {
      results.issues_found.push({
        type: 'APPROVERS_WITHOUT_ASSIGNMENTS',
        count: approvesWithoutAssignments.length,
        users: approvesWithoutAssignments.map((u) => ({
          id: u.id,
          name: u.full_name,
          roles: u.roles,
        })),
        note: 'These users have DEPT_APPROVER roles but no assignments in this company',
      })
    }

    // ============================================================================
    // PART 3: Check for sections without assignments
    // ============================================================================

    const templates = await prisma.clearanceSectionTemplate.findMany({
      where: { company_code: companyCode },
      select: { section_key: true, label: true },
    })

    const sectionsWithoutAssignments = []

    for (const template of templates) {
      const hasAssignment = allAssignments.some((a) => a.section_key === template.section_key)
      if (!hasAssignment) {
        sectionsWithoutAssignments.push({
          section_key: template.section_key,
          label: template.label,
        })
      }
    }

    if (sectionsWithoutAssignments.length > 0) {
      results.issues_found.push({
        type: 'SECTIONS_WITHOUT_APPROVERS',
        count: sectionsWithoutAssignments.length,
        sections: sectionsWithoutAssignments,
      })
    }

    // ============================================================================
    // PART 4: Check for pending items in clearances (blocking approval)
    // ============================================================================

    let pendingItemsQuery: any = {
      clearance_request: { employee: { company_code: companyCode } },
      status: 'PENDING',
    }

    if (clearanceId) {
      pendingItemsQuery = {
        clearance_request_id: clearanceId,
        status: 'PENDING',
      }
    }

    const pendingItems = await prisma.clearanceItem.findMany({
      where: pendingItemsQuery,
      include: { clearance_section: { include: { clearance_request: { select: { id: true } } } } },
    })

    if (pendingItems.length > 0) {
      const groupedByClearance: Record<string, number> = {}
      pendingItems.forEach((item) => {
        const cid = item.clearance_section.clearance_request.id
        groupedByClearance[cid] = (groupedByClearance[cid] || 0) + 1
      })

      results.issues_found.push({
        type: 'PENDING_ITEMS_BLOCKING_APPROVAL',
        count: pendingItems.length,
        clearances_affected: groupedByClearance,
        note: 'These items must be marked APPROVED or NA before sections can be approved',
      })

      if (clearanceId && searchParams.get('autoApprovePending') === 'true') {
        await prisma.clearanceItem.updateMany({
          where: {
            clearance_section: { clearance_request_id: clearanceId },
            status: 'PENDING',
          },
          data: {
            status: 'NA',
            comments: 'Auto-approved during validation fix (no action required)',
          },
        })

        results.fixes_applied.push({
          type: 'AUTO_APPROVED_PENDING_ITEMS',
          clearance_id: clearanceId,
          count: pendingItems.filter((i) => i.clearance_section.clearance_request.id === clearanceId).length,
        })
      }
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================

    results.summary = {
      issues_found: results.issues_found.length,
      fixes_applied: results.fixes_applied.length,
      next_steps: [],
    }

    if (results.issues_found.length > 0 && !fixRoles) {
      results.summary.next_steps.push('Call this endpoint with ?fixRoles=true to auto-grant missing roles')
    }

    if (pendingItems.length > 0 && clearanceId && !searchParams.get('autoApprovePending')) {
      results.summary.next_steps.push(
        `Call with ?clearanceId=${clearanceId}&autoApprovePending=true to auto-approve pending items`
      )
    }

    if (sectionsWithoutAssignments.length > 0) {
      results.summary.next_steps.push('Manually assign approvers for sections without assignments via Admin → Approvers')
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    console.error('[POST /api/admin/approvers/validate-and-fix] error:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 })
  }
})

/**
 * GET /api/admin/approvers/validate-and-fix
 * Same as POST but read-only (just reporting, no fixes)
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  // Just redirect to POST without fixes
  const url = new URL(req.url)
  url.searchParams.delete('fixRoles') // Ensure no fixes applied
  url.searchParams.delete('autoApprovePending')

  // Forward to POST
  return POST(req as AuthenticatedRequest)
})
