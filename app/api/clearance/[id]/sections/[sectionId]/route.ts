import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'
import { sectionRole } from '@/lib/approver-resolver'
import {
  checkAndUnlockSection3,
  checkAndCompleteClearance,
} from '@/lib/clearance-workflow'
import {
  notifyHRBPSectionApproved,
  notifyHRBPSectionDenied,
} from '@/lib/notifications'

// PKT = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]/sections/[sectionId]
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, sectionId } = context.params as { id: string; sectionId: string }

  let body: {
    action?: string
    note?: string
    items?: Array<{ id: string; item_key?: string; status?: string; comments?: string }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.action || !['APPROVE', 'DENY'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be APPROVE or DENY' }, { status: 400 })
  }

  if (body.action === 'DENY' && !body.note?.trim()) {
    return NextResponse.json({ error: 'note is required when denying a section' }, { status: 400 })
  }

  try {
    // Fetch section with its parent clearance (including employee info for line-manager check)
    const section = await prisma.clearanceSection.findUnique({
      where: { id: sectionId },
      include: {
        clearance_request: {
          select: {
            employee_id: true,
            initiated_by_hrbp_id: true,
            employee: {
              select: { company_code: true, line_manager_id: true },
            },
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    if (section.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Section does not belong to this clearance' }, { status: 400 })
    }

    const companyCode = section.clearance_request.employee?.company_code || '1000'
    const employeeLineManagerId = section.clearance_request.employee?.line_manager_id ?? null

    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && section.clearance_request.initiated_by_hrbp_id === user.id
    const isSubjectEmployee = section.clearance_request.employee_id === user.id

    // Clearance-level access: is user assigned to any item in this clearance's company?
    const hasAnyAssignment = await prisma.approverAssignment.findFirst({
      where: { company_code: companyCode, approver_id: user.id },
      select: { id: true },
    })
    const isLineManagerForEmployee = employeeLineManagerId === user.id

    if (!isSuperAdmin && !isOwnerHRBP && !isSubjectEmployee && !hasAnyAssignment && !isLineManagerForEmployee) {
      return NextResponse.json({ error: 'Forbidden: You cannot access this clearance' }, { status: 403 })
    }

    // Validate section is in a state that allows action
    if (section.status === 'LOCKED') {
      return NextResponse.json({ error: 'Section is locked and cannot be actioned yet' }, { status: 409 })
    }
    if (section.status === 'APPROVED') {
      return NextResponse.json({ error: 'Section is already approved' }, { status: 409 })
    }
    if (section.status === 'DENIED') {
      return NextResponse.json({ error: 'Section is already denied. HRBP must re-route first' }, { status: 409 })
    }
    if (section.status !== 'PENDING') {
      return NextResponse.json({ error: 'Section is not in a PENDING state' }, { status: 409 })
    }

    // sectionRole() generates DEPT_APPROVER_<key> for custom/unknown section keys
    const requiredRole = sectionRole(section.section_key)
    const hasRole = user.roles.includes(requiredRole)

    // Live assignment check — never trust the stale section.approver_id column
    // For DEPT_HEAD: approver is the employee's line manager
    // For all others: check ApproverAssignment table directly
    let isAssignedApprover = false
    if (section.section_key === 'DEPT_HEAD') {
      isAssignedApprover = employeeLineManagerId === user.id
    } else {
      const liveAssignment = await prisma.approverAssignment.findFirst({
        where: {
          company_code: companyCode,
          section_key: section.section_key,
          approver_id: user.id,
        },
        select: { id: true },
      })
      isAssignedApprover = !!liveAssignment
    }

    if (!isSuperAdmin && !hasRole && !isAssignedApprover) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to action this section' },
        { status: 403 }
      )
    }

    const now = nowPKT()

    // Shared: fetch item-level assignments for this section (used in both APPROVE and DENY)
    const itemAssignments = await prisma.approverAssignment.findMany({
      where: { section_key: section.section_key, company_code: companyCode },
      select: { item_key: true, approver_id: true },
    })
    const itemAssignmentMap = new Map<string, string>()
    itemAssignments.forEach((a) => itemAssignmentMap.set(a.item_key, a.approver_id))
    const sectionLevelAssignerId = itemAssignmentMap.get('section') ?? null

    // Per-item authorization: section-level approver or super admin can act on any item;
    // item-level approvers can only act on their own items
    const authorizeItems = (items: typeof body.items): NextResponse | null => {
      if (!Array.isArray(items) || items.length === 0) return null
      if (isSuperAdmin) return null
      for (const item of items) {
        const effectiveApprover =
          sectionLevelAssignerId ?? (item.item_key ? itemAssignmentMap.get(item.item_key) : undefined)
        if (effectiveApprover && effectiveApprover !== user.id) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'You are not authorized to act on this item. It is assigned to another approver.' },
            { status: 403 }
          )
        }
      }
      return null
    }

    if (body.action === 'APPROVE') {
      const itemAuthError = authorizeItems(body.items)
      if (itemAuthError) return itemAuthError

      if (Array.isArray(body.items) && body.items.length > 0) {
        await Promise.all(
          body.items.map((item) => {
            const allowedStatuses = ['APPROVED', 'NA', 'PENDING']
            const status = item.status && allowedStatuses.includes(item.status) ? item.status : undefined
            return prisma.clearanceItem.updateMany({
              where: { id: item.id, clearance_section_id: sectionId },
              data: {
                ...(status ? { status } : {}),
                ...(item.comments !== undefined ? { comments: item.comments } : {}),
                ...(status === 'APPROVED' || status === 'NA'
                  ? { approver_id: user.id, approver_name: user.full_name, decision_at: now }
                  : {}),
              },
            })
          })
        )
      }

      // All items must be APPROVED/NA before the section can be approved
      const allItems = await prisma.clearanceItem.findMany({
        where: { clearance_section_id: sectionId },
        select: { status: true },
      })
      const allApproved = allItems.every((item) => item.status === 'APPROVED' || item.status === 'NA')
      if (!allApproved) {
        return NextResponse.json(
          { error: 'Cannot approve section', message: 'All items must be approved before the section can be approved.' },
          { status: 409 }
        )
      }

      await prisma.clearanceSection.update({
        where: { id: sectionId },
        data: {
          status: 'APPROVED',
          approver_id: user.id,
          approver_name: user.full_name,
          decision_at: now,
          note: body.note ?? null,
        },
      })

      await prisma.activityLog.create({
        data: {
          clearance_request_id: clearanceId,
          actor_id: user.id,
          action: 'SECTION_APPROVED',
          details: JSON.stringify({
            section_key: section.section_key,
            section_id: sectionId,
            approver: user.full_name,
            note: body.note ?? null,
            timestamp: now.toISOString(),
          }),
        },
      })

      try {
        await notifyHRBPSectionApproved(clearanceId, section.section_key, user.full_name)
      } catch (e) {
        console.error('[PATCH section] notifyHRBPSectionApproved error:', e)
      }
      try {
        await checkAndUnlockSection3(clearanceId)
      } catch (e) {
        console.error('[PATCH section] checkAndUnlockSection3 error:', e)
      }
      try {
        await checkAndCompleteClearance(clearanceId)
      } catch (e) {
        console.error('[PATCH section] checkAndCompleteClearance error:', e)
      }

    } else {
      // DENY
      const itemAuthError = authorizeItems(body.items)
      if (itemAuthError) return itemAuthError

      if (Array.isArray(body.items) && body.items.length > 0) {
        await Promise.all(
          body.items.map((item) => {
            const allowedStatuses = ['APPROVED', 'NA', 'PENDING']
            const status = item.status && allowedStatuses.includes(item.status) ? item.status : undefined
            return prisma.clearanceItem.updateMany({
              where: { id: item.id, clearance_section_id: sectionId },
              data: {
                ...(status ? { status } : {}),
                ...(item.comments !== undefined ? { comments: item.comments } : {}),
              },
            })
          })
        )
      }

      await prisma.clearanceSection.update({
        where: { id: sectionId },
        data: {
          status: 'DENIED',
          approver_id: user.id,
          approver_name: user.full_name,
          decision_at: now,
          note: body.note!,
        },
      })

      await prisma.clearanceRequest.update({
        where: { id: clearanceId },
        data: { status: 'PENDING_HRBP' },
      })

      await prisma.activityLog.create({
        data: {
          clearance_request_id: clearanceId,
          actor_id: user.id,
          action: 'SECTION_DENIED',
          details: JSON.stringify({
            section_key: section.section_key,
            section_id: sectionId,
            approver: user.full_name,
            note: body.note,
            timestamp: now.toISOString(),
          }),
        },
      })

      try {
        await notifyHRBPSectionDenied(clearanceId, section.section_key, user.full_name, body.note!)
      } catch (e) {
        console.error('[PATCH section] notifyHRBPSectionDenied error:', e)
      }
    }

    const updatedSection = await prisma.clearanceSection.findUnique({
      where: { id: sectionId },
      include: { clearance_items: true },
    })

    return NextResponse.json(updatedSection)
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]/sections/[sectionId]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
