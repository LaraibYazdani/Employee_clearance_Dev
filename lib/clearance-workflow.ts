import { prisma } from '@/lib/prisma'
import { sectionRole } from '@/lib/approver-resolver'
import {
  notifySection3Approvers,
  notifyHRBPCompletion,
} from '@/lib/notifications'

// PKT = UTC+5
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000

function nowPKT(): Date {
  return new Date(Date.now() + PKT_OFFSET_MS)
}

/**
 * Checks whether all phase-2 sections are APPROVED.
 * If yes, unlocks phase-3 sections (changes status from LOCKED to PENDING)
 * and notifies phase-3 approvers.
 *
 * Returns true if phase-3 was just unlocked, false otherwise.
 */
export async function checkAndUnlockSection3(clearanceId: string): Promise<boolean> {
  const sections = await prisma.clearanceSection.findMany({
    where: { clearance_request_id: clearanceId },
  })

  const phase2Sections = sections.filter((s) => s.phase === 2)
  const phase3Sections = sections.filter((s) => s.phase === 3)

  const allPhase2Approved = phase2Sections.every((s) => s.status === 'APPROVED')
  if (!allPhase2Approved) return false

  const anyStillLocked = phase3Sections.some((s) => s.status === 'LOCKED')
  if (!anyStillLocked) return false

  // Unlock all phase-3 sections
  await prisma.clearanceSection.updateMany({
    where: {
      clearance_request_id: clearanceId,
      phase: 3,
      status: 'LOCKED',
    },
    data: { status: 'PENDING' },
  })

  // Notify phase-3 approvers
  await notifySection3Approvers(clearanceId)

  return true
}

/**
 * Checks whether ALL sections are APPROVED.
 * Returns true if the clearance is fully approved.
 */
export async function checkAndCompleteClearance(clearanceId: string): Promise<boolean> {
  const sections = await prisma.clearanceSection.findMany({
    where: { clearance_request_id: clearanceId },
  })

  const allApproved = sections.every((s) => s.status === 'APPROVED')
  if (!allApproved) return false

  await triggerCompletion(clearanceId)
  return true
}

/**
 * Marks the clearance as COMPLETED, sets pdf_generated flag, logs the
 * COMPLETION activity, and notifies the HRBP.
 */
export async function triggerCompletion(clearanceId: string): Promise<void> {
  const now = nowPKT()

  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    select: { initiated_by_hrbp_id: true },
  })

  if (!clearance) return

  await prisma.clearanceRequest.update({
    where: { id: clearanceId },
    data: {
      status: 'COMPLETED',
      pdf_generated: true,
      pdf_generated_at: now,
    },
  })

  await prisma.activityLog.create({
    data: {
      clearance_request_id: clearanceId,
      actor_id: clearance.initiated_by_hrbp_id,
      action: 'COMPLETION',
      details: JSON.stringify({
        message: 'All sections approved. Clearance marked as COMPLETED. PDF generation triggered.',
        timestamp: now.toISOString(),
      }),
    },
  })

  await notifyHRBPCompletion(clearanceId)
}

/**
 * Finds the appropriate approver user ID for a given section key.
 *
 * Priority order:
 * 1. LINE_MANAGER → employee's line_manager_id
 * 2. DEPT_HEAD → employee's line_manager_id
 * 3. ApproverAssignment table (company_code + section_key)
 * 4. Role-based fallback (first user with the required role)
 *
 * Returns null if no suitable approver is found.
 */
export async function findApproverForSection(
  sectionKey: string,
  employeeId: string,
  companyCode?: string | null
): Promise<string | null> {
  if (sectionKey === 'LINE_MANAGER' || sectionKey === 'DEPT_HEAD') {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { line_manager_id: true },
    })
    return employee?.line_manager_id ?? null
  }

  // Check for a section-level assignment only (item_key = 'section')
  // Item-level assignments are per-item and do not designate a single section approver
  if (companyCode) {
    const assignment = await prisma.approverAssignment.findFirst({
      where: { company_code: companyCode, section_key: sectionKey, item_key: 'section' },
      select: { approver_id: true },
    })
    if (assignment) return assignment.approver_id
  }

  // Fall back to role-based lookup — works for both known and custom section keys
  const requiredRole = sectionRole(sectionKey)

  const users = await prisma.user.findMany({
    select: { id: true, roles: true },
  })

  const match = users.find((u) => {
    const rolesArr = Array.isArray(u.roles) ? u.roles : []
    return rolesArr.includes(requiredRole)
  })

  return match?.id ?? null
}
