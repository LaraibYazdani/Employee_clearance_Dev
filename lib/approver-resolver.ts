import { prisma } from './prisma'

// Maps section_key → the portal role that grants approver access to that section
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
}

/**
 * Grants the corresponding DEPT_APPROVER_* role to the user if they don't already have it.
 * Preserves all existing roles.
 */
async function grantApproverRole(approverId: string, sectionKey: string): Promise<void> {
  const role = SECTION_TO_ROLE[sectionKey]
  if (!role) return

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
 * Checks whether the given user is already assigned to a DIFFERENT department
 * for the same company. Returns the conflicting section_key if found, null otherwise.
 *
 * Rule: one user can only be an approver within one department (section_key).
 * They may approve multiple items within that department, but cannot appear
 * in any other department's assignments.
 */
export async function checkApproverDepartmentConflict(
  companyCode: string,
  sectionKey: string,
  approverId: string
): Promise<string | null> {
  const conflict = await prisma.approverAssignment.findFirst({
    where: {
      company_code: companyCode,
      approver_id: approverId,
      section_key: { not: sectionKey },
    },
    select: { section_key: true },
  })
  return conflict?.section_key ?? null
}

/**
 * Get the assigned approver for a specific clearance item.
 * Looks up approver_assignments by company_code + section_key + item_key.
 */
export async function getApproverForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string
): Promise<{ id: string; full_name: string } | null> {
  try {
    const assignment = await prisma.approverAssignment.findUnique({
      where: {
        company_code_section_key_item_key: {
          company_code: companyCode,
          section_key: sectionKey,
          item_key: itemKey,
        },
      },
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
 * Upsert a single approver assignment.
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
        company_code_section_key_item_key: {
          company_code: companyCode,
          section_key: sectionKey,
          item_key: itemKey,
        },
      },
      update: { approver_id: approverId },
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
 * Remove a single approver assignment.
 */
export async function removeApproverForItem(
  companyCode: string,
  sectionKey: string,
  itemKey: string
) {
  try {
    return await prisma.approverAssignment.delete({
      where: {
        company_code_section_key_item_key: {
          company_code: companyCode,
          section_key: sectionKey,
          item_key: itemKey,
        },
      },
    })
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
