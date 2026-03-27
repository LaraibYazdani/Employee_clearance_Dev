import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyApproverRerouted } from '@/lib/notifications'

// PKT = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/reroute
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  if (!user.roles.includes('HRBP')) {
    return NextResponse.json({ error: 'Forbidden', message: 'Only HRBP can re-route clearance sections' }, { status: 403 })
  }

  let body: { sectionId?: string; resolutionNote?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.sectionId) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })
  }
  if (!body.resolutionNote?.trim()) {
    return NextResponse.json({ error: 'resolutionNote is required' }, { status: 400 })
  }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Verify HRBP owns this clearance
    if (clearance.initiated_by_hrbp_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', message: 'You are not the HRBP for this clearance' }, { status: 403 })
    }

    // Fetch the denied section
    const section = await prisma.clearanceSection.findUnique({
      where: { id: body.sectionId },
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    if (section.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Section does not belong to this clearance' }, { status: 400 })
    }

    if (section.status !== 'DENIED') {
      return NextResponse.json({ error: 'Only DENIED sections can be re-routed' }, { status: 409 })
    }

    const now = nowPKT()

    // Reset section to PENDING with resolution note
    await prisma.clearanceSection.update({
      where: { id: body.sectionId },
      data: {
        status: 'PENDING',
        note: body.resolutionNote,
        decision_at: null,
      },
    })

    // Check if there are any remaining DENIED sections after this re-route
    const remainingDenied = await prisma.clearanceSection.count({
      where: {
        clearance_request_id: clearanceId,
        status: 'DENIED',
      },
    })

    // If no more denials, restore clearance to IN_PROGRESS
    if (remainingDenied === 0) {
      await prisma.clearanceRequest.update({
        where: { id: clearanceId },
        data: { status: 'IN_PROGRESS' },
      })
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        clearance_request_id: clearanceId,
        actor_id: user.id,
        action: 'HRBP_REROUTED',
        details: JSON.stringify({
          section_key: section.section_key,
          section_id: body.sectionId,
          resolution_note: body.resolutionNote,
          hrbp: user.full_name,
          timestamp: now.toISOString(),
        }),
      },
    })

    // Notify the relevant approver
    try {
      await notifyApproverRerouted(clearanceId, section.section_key, body.resolutionNote)
    } catch (e) {
      console.error('[POST /api/clearance/[id]/reroute] notification error:', e)
    }

    const updatedSection = await prisma.clearanceSection.findUnique({
      where: { id: body.sectionId },
      include: { clearance_items: true },
    })

    return NextResponse.json({ message: 'Section re-routed successfully', section: updatedSection })
  } catch (error) {
    console.error('[POST /api/clearance/[id]/reroute] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
