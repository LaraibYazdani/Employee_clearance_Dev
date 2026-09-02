import { prisma } from './prisma'

// Maps well-known section_key → short role name. Custom section keys fall back
// to a dynamically generated DEPT_APPROVER_<section_key> role at runtime.
const SECTION_TO_ROLE: Record<string, string> = {
  IR_DEPT:          'DEPT_APPROVER_IR',
  IT_DEPT:          'DEPT_APPROVER_IT',
  SUPPLY_MGMT:      'DEPT_APPROVER_SUPPLY',
  ICS_DEPT:         'DEPT_APPROVER_ICS',
  SECURITY:         'DEPT_APPROVER_SECURITY',
  OTHER_FACILITIES: 'DEPT_APPROVER_OTHER',
  DEPT_HEAD:        'DEPT_APPROVER_HEAD',
  OD_DEPT:          'DEPT_APPROVER_OD',
  HR_DEPT:          'DEPT_APPROVER_HR',
  FINANCE:          'DEPT_APPROVER_FINANCE',
  PAYROLL_MANAGER:  'PAYROLL_MANAGER',
  FINANCE_MANAGER:  'FINANCE_MANAGER',
}

/** Returns the role for a section, generating one dynamically for custom keys. */
export function sectionRole(sectionKey: string): string {
  return SECTION_TO_ROLE[sectionKey] ?? `DEPT_APPROVER_${sectionKey}`
}

/**
 * Grants the corresponding DEPT_APPROVER_* role to the user if they don't already have it.
 * Preserves all existing roles.
 */
async function grantApproverRole(approverId: string, sectionKey: string): Promise<void> {
  const role = sectionRole(sectionKey)

  const user = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, roles: true },
  })
  if (!user) return

  const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
  if (currentRoles.includes(role)) return

  await prisma.user.update({
    where: { id: approverId },
    data: { roles: [...currentRoles, role] },
  })
}

/**
 * Revokes the corresponding DEPT_APPROVER_* role if the user is not assigned
 * to any item in that section across ANY company.
 */
async function revokeApproverRoleIfNotAssigned(
  approverId: string,
  _companyCode: string,
  sectionKey: string
): Promise<void> {
  const role = sectionRole(sectionKey)

  const stillAssigned = await prisma.approverAssignment.findFirst({
    where: {
      section_key: sectionKey,
      approver_id: approverId,
    },
    select: { id: true },
  })

  if (stillAssigned) return

  const user = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, roles: true },
  })
  if (!user) return

  const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
  if (!currentRoles.includes(role)) return

  await prisma.user.update({
    where: { id: approverId },
    data: { roles: currentRoles.filter((r) => r !== role) },
  })
}

/**
 * Get the first assigned approver for a specific clearance item (single-approver compat).
 */
export async function getApproverForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string
): Promise<{ id: string; full_name: string } | null> {
  try {
    const assignment = await prisma.approverAssignment.findFirst({
      where: { company_code: companyCode, section_key: sectionKey, item_key: itemKey },
      include: {
        approver: { select: { id: true, full_name: true } },
      },
    })
    return assignment?.approver ?? null
  } catch {
    return null
  }
}

/**
 * Get all assigned approvers for a specific clearance item.
 */
export async function getApproversForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string
): Promise<{ id: string; full_name: string }[]> {
  const assignments = await prisma.approverAssignment.findMany({
    where: { company_code: companyCode, section_key: sectionKey, item_key: itemKey },
    include: {
      approver: { select: { id: true, full_name: true } },
    },
  })
  return assignments.map((a) => a.approver)
}

/**
 * Get all approver assignments for a company.
 */
export async function getApproverMatrix(companyCode: string) {
  return prisma.approverAssignment.findMany({
    where: { company_code: companyCode },
    include: {
      approver: {
        select: { id: true, full_name: true, email: true, designation: true },
      },
    },
    orderBy: [{ section_key: 'asc' }, { item_key: 'asc' }],
  })
}

/**
 * Add an approver to an item (idempotent — no-op if already assigned).
 * Multiple approvers per item are allowed; any one can approve.
 */
export async function setApproverForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string,
  approverId: string
) {
  const [result] = await Promise.all([
    prisma.approverAssignment.upsert({
      where: {
        company_code_section_key_item_key_approver_id: {
          company_code: companyCode,
          section_key: sectionKey,
          item_key: itemKey,
          approver_id: approverId,
        },
      },
      update: {},
      create: {
        company_code: companyCode,
        section_key: sectionKey,
        item_key: itemKey,
        approver_id: approverId,
      },
    }),
    grantApproverRole(approverId, sectionKey),
  ])
  return result
}

/**
 * Remove an approver assignment.
 * - If approverId is given: removes that specific approver from the item.
 * - If approverId is omitted: removes ALL approvers for the item.
 */
export async function removeApproverForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string,
  approverId?: string
) {
  try {
    if (approverId) {
      const result = await prisma.approverAssignment.delete({
        where: {
          company_code_section_key_item_key_approver_id: {
            company_code: companyCode,
            section_key: sectionKey,
            item_key: itemKey,
            approver_id: approverId,
          },
        },
      })
      await revokeApproverRoleIfNotAssigned(approverId, companyCode, sectionKey)
      return result
    } else {
      const assignments = await prisma.approverAssignment.findMany({
        where: { company_code: companyCode, section_key: sectionKey, item_key: itemKey },
        select: { approver_id: true },
      })
      await prisma.approverAssignment.deleteMany({
        where: { company_code: companyCode, section_key: sectionKey, item_key: itemKey },
      })
      await Promise.all(
        assignments.map((a) =>
          revokeApproverRoleIfNotAssigned(a.approver_id, companyCode, sectionKey)
        )
      )
      return null
    }
  } catch {
    return null
  }
}

/**
 * Bulk assign one approver to every item in a section for a given company.
 */
export async function bulkAssignSection(
  companyCode: string,
  sectionKey: string,
  itemKeys: string[],
  approverId: string
) {
  return Promise.all(
    itemKeys.map((itemKey) =>
      setApproverForItem(companyCode, sectionKey, itemKey, approverId)
    )
  )
}
