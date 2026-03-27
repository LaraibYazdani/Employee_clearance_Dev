import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'
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

  let body: { action?: string; note?: string }
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
    // Fetch section with its parent clearance
    const section = await prisma.clearanceSection.findUnique({
      where: { id: sectionId },
      include: { clearance_request: true },
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    if (section.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Section does not belong to this clearance' }, { status: 400 })
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

    // Validate the user has the correct role for this section
    const requiredRole = SECTION_ROLE_MAP[section.section_key]
    if (!requiredRole) {
      return NextResponse.json({ error: 'Unknown section key' }, { status: 400 })
    }

    // For DEPT_HEAD, the approver is the specific employee's line manager
    // We check by approver_id match rather than role
    const isDeptHead = section.section_key === 'DEPT_HEAD'
    const hasRole = user.roles.includes(requiredRole)
    const isAssignedApprover = section.approver_id === user.id

    if (!hasRole && !isAssignedApprover) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to action this section' },
        { status: 403 }
      )
    }

    // For non-DEPT_HEAD sections, the user must either have the role OR be the assigned approver
    // For DEPT_HEAD, we rely solely on assigned approver check since role is DEPT_APPROVER_HEAD
    if (!isDeptHead && !hasRole) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have the required role for this section' },
        { status: 403 }
      )
    }

    const now = nowPKT()

    if (body.action === 'APPROVE') {
      // Update section to APPROVED
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

      // Approve all still-PENDING items in this section
      await prisma.clearanceItem.updateMany({
        where: {
          clearance_section_id: sectionId,
          status: 'PENDING',
        },
        data: { status: 'APPROVED' },
      })

      // Activity log
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

      // Notify HRBP
      try {
        await notifyHRBPSectionApproved(clearanceId, section.section_key, user.full_name)
      } catch (e) {
        console.error('[PATCH section] notifyHRBPSectionApproved error:', e)
      }

      // Check if Section 3 should be unlocked (all Section 2 approved)
      try {
        await checkAndUnlockSection3(clearanceId)
      } catch (e) {
        console.error('[PATCH section] checkAndUnlockSection3 error:', e)
      }

      // Check if entire clearance is now complete
      try {
        await checkAndCompleteClearance(clearanceId)
      } catch (e) {
        console.error('[PATCH section] checkAndCompleteClearance error:', e)
      }

    } else {
      // DENY
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

      // Update clearance status to PENDING_HRBP
      await prisma.clearanceRequest.update({
        where: { id: clearanceId },
        data: { status: 'PENDING_HRBP' },
      })

      // Activity log
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

      // Notify HRBP
      try {
        await notifyHRBPSectionDenied(clearanceId, section.section_key, user.full_name, body.note!)
      } catch (e) {
        console.error('[PATCH section] notifyHRBPSectionDenied error:', e)
      }
    }

    // Return updated section
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
