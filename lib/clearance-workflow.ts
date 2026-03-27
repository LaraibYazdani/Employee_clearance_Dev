import { prisma } from '@/lib/prisma'
import { SECTION_2_KEYS, SECTION_3_KEYS, SECTION_ROLE_MAP } from '@/lib/clearance-config'
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
 * Checks whether all Section 2 sections are APPROVED.
 * If yes, unlocks Section 3 sections (changes status from LOCKED to PENDING)
 * and notifies Section 3 approvers.
 *
 * Returns true if Section 3 was just unlocked, false otherwise.
 */
export async function checkAndUnlockSection3(clearanceId: string): Promise<boolean> {
  const sections = await prisma.clearanceSection.findMany({
    where: { clearance_request_id: clearanceId },
  })

  const section2Keys = SECTION_2_KEYS as readonly string[]
  const section3Keys = SECTION_3_KEYS as readonly string[]

  const section2Sections = sections.filter((s) => section2Keys.includes(s.section_key))
  const allSection2Approved = section2Sections.every((s) => s.status === 'APPROVED')

  if (!allSection2Approved) return false

  const section3Sections = sections.filter((s) => section3Keys.includes(s.section_key))
  const anyStillLocked = section3Sections.some((s) => s.status === 'LOCKED')

  if (!anyStillLocked) return false

  // Unlock all Section 3 sections
  await prisma.clearanceSection.updateMany({
    where: {
      clearance_request_id: clearanceId,
      section_key: { in: [...SECTION_3_KEYS] },
      status: 'LOCKED',
    },
    data: { status: 'PENDING' },
  })

  // Notify Section 3 approvers
  await notifySection3Approvers(clearanceId)

  return true
}

/**
 * Checks whether ALL sections (Section 2 + Section 3) are APPROVED.
 * Returns true if the clearance is fully approved.
 */
export async function checkAndCompleteClearance(clearanceId: string): Promise<boolean> {
  const sections = await prisma.clearanceSection.findMany({
    where: { clearance_request_id: clearanceId },
  })

  const relevantKeys = [...SECTION_2_KEYS, ...SECTION_3_KEYS] as string[]
  const relevantSections = sections.filter((s) => relevantKeys.includes(s.section_key))

  const allApproved = relevantSections.every((s) => s.status === 'APPROVED')
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

  // Find the HRBP to use as the actor for the system log entry
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
 * For DEPT_HEAD: returns the employee's line_manager_id.
 * For all others: finds the first user in the DB whose roles array contains
 *                 the required role string.
 *
 * Returns null if no suitable approver is found.
 */
export async function findApproverForSection(
  sectionKey: string,
  employeeId: string
): Promise<string | null> {
  if (sectionKey === 'DEPT_HEAD') {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { line_manager_id: true },
    })
    return employee?.line_manager_id ?? null
  }

  const requiredRole = SECTION_ROLE_MAP[sectionKey]
  if (!requiredRole) return null

  // roles is stored as a JSON array in the DB
  // We fetch all users and filter in JS (suitable for small user sets)
  const users = await prisma.user.findMany({
    select: { id: true, roles: true },
  })

  const match = users.find((u) => {
    const rolesArr = Array.isArray(u.roles) ? u.roles : []
    return rolesArr.includes(requiredRole)
  })

  return match?.id ?? null
}
