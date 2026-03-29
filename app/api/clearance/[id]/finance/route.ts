import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  checkAndUnlockSection3,
  checkAndCompleteClearance,
} from '@/lib/clearance-workflow'
import {
  notifyHRBPSectionApproved,
} from '@/lib/notifications'

// PKT = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/finance
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      select: { id: true, initiated_by_hrbp_id: true },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Access control: HRBP owner, any DEPT_APPROVER, or SUPER_ADMIN
    const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
    const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id

    if (!isSuperAdmin && !isOwnerHRBP && !isDeptApprover) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const entries = await prisma.financeEntry.findMany({
      where: { clearance_request_id: clearanceId },
      orderBy: { created_at: 'asc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('[GET /api/clearance/[id]/finance] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]/finance
// Body: { action: 'SAVE' | 'APPROVE', entries: Array<{id, amount_pkr}> }
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  // Allow role-based OR assigned approver for the finance section
  const isFinanceRole = user.roles.includes('DEPT_APPROVER_FINANCE')
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  if (!isFinanceRole && !isSuperAdmin) {
    // Check if user is the assigned approver for the FINANCE section
    const finSection = await prisma.clearanceSection.findFirst({
      where: { clearance_request_id: clearanceId, section_key: 'FINANCE' },
      select: { approver_id: true },
    })
    if (finSection?.approver_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to update finance entries' },
        { status: 403 }
      )
    }
  }

  let body: {
    action?: 'SAVE' | 'APPROVE'
    entries?: Array<{ id: string; amount_pkr: number | null }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action ?? 'APPROVE'

  if (!['SAVE', 'APPROVE'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be SAVE or APPROVE' },
      { status: 400 }
    )
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: 'entries array is required and must not be empty' },
      { status: 400 }
    )
  }

  for (const entry of body.entries) {
    if (!entry.id) {
      return NextResponse.json({ error: 'Each entry must have an id' }, { status: 400 })
    }
    if (entry.amount_pkr !== null && typeof entry.amount_pkr !== 'number') {
      return NextResponse.json(
        { error: 'amount_pkr must be a number or null' },
        { status: 400 }
      )
    }
  }

  try {
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
      select: { id: true },
    })

    if (!clearance) {
      return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })
    }

    // Update amount_pkr for each entry
    const updates = await Promise.all(
      body.entries.map(async (entryUpdate) => {
        const existingEntry = await prisma.financeEntry.findFirst({
          where: { id: entryUpdate.id, clearance_request_id: clearanceId },
        })
        if (!existingEntry) return null
        return prisma.financeEntry.update({
          where: { id: entryUpdate.id },
          data: { amount_pkr: entryUpdate.amount_pkr },
        })
      })
    )

    const updatedEntries = updates.filter(Boolean)

    // If SAVE only, return without triggering approval
    if (action === 'SAVE') {
      return NextResponse.json({
        action: 'SAVE',
        updated: updatedEntries.length,
        entries: updatedEntries,
      })
    }

    // ----- APPROVE action -----
    // Find the FINANCE section for this clearance
    const financeSection = await prisma.clearanceSection.findFirst({
      where: {
        clearance_request_id: clearanceId,
        section_key: 'FINANCE',
      },
    })

    if (!financeSection) {
      return NextResponse.json({ error: 'Finance section not found' }, { status: 404 })
    }

    if (financeSection.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Finance section is already approved' },
        { status: 409 }
      )
    }

    if (financeSection.status === 'LOCKED') {
      return NextResponse.json(
        { error: 'Finance section is locked and cannot be actioned yet' },
        { status: 409 }
      )
    }

    const now = nowPKT()

    // Approve the finance section
    await prisma.clearanceSection.update({
      where: { id: financeSection.id },
      data: {
        status: 'APPROVED',
        approver_id: user.id,
        approver_name: user.full_name,
        decision_at: now,
      },
    })

    // Activity log
    await prisma.activityLog.create({
      data: {
        clearance_request_id: clearanceId,
        actor_id: user.id,
        action: 'SECTION_APPROVED',
        details: JSON.stringify({
          section_key: 'FINANCE',
          section_id: financeSection.id,
          approver: user.full_name,
          timestamp: now.toISOString(),
        }),
      },
    })

    // Notify HRBP
    try {
      await notifyHRBPSectionApproved(clearanceId, 'FINANCE', user.full_name)
    } catch (e) {
      console.error('[PATCH finance] notifyHRBPSectionApproved error:', e)
    }

    // Check if all sections are approved -> complete clearance
    try {
      await checkAndUnlockSection3(clearanceId)
    } catch (e) {
      console.error('[PATCH finance] checkAndUnlockSection3 error:', e)
    }

    try {
      await checkAndCompleteClearance(clearanceId)
    } catch (e) {
      console.error('[PATCH finance] checkAndCompleteClearance error:', e)
    }

    const updatedSection = await prisma.clearanceSection.findUnique({
      where: { id: financeSection.id },
    })

    return NextResponse.json({
      action: 'APPROVE',
      updated: updatedEntries.length,
      entries: updatedEntries,
      section: updatedSection,
    })
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]/finance] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
