/**
 * DIAGNOSTIC & FIX SCRIPT
 * Use this script to identify and fix approver-related issues
 * 
 * Run in Node.js context with prisma access to fix issues
 */

import { prisma } from './lib/prisma'
import { SECTION_ROLE_MAP } from './lib/clearance-config'

const COMPANY_CODE = '1200' // BSPL

/**
 * DIAGNOSTIC: Check approver visibility and authorization issues
 */
export async function diagnoseApproverIssues() {
  console.log('🔍 DIAGNOSING APPROVER ISSUES FOR BSPL (1200)')
  console.log('=' .repeat(60))

  // 1. Get all clearances for this company
  const clearances = await prisma.clearanceRequest.findMany({
    where: {
      employee: { company_code: COMPANY_CODE },
      status: { in: ['IN_PROGRESS', 'DRAFT', 'PENDING_HRBP'] },
    },
    include: {
      employee: { select: { id: true, full_name: true, company_code: true, line_manager_id: true } },
      clearance_sections: { include: { clearance_items: true } },
    },
    take: 10,
  })

  console.log(`\n📋 Found ${clearances.length} clearances for BSPL\n`)

  for (const clearance of clearances) {
    console.log(`\nCLEARANCE: ${clearance.id}`)
    console.log(`  Employee: ${clearance.employee.full_name} (${clearance.employee.id})`)
    console.log(`  Status: ${clearance.status}`)

    // Check sections
    for (const section of clearance.clearance_sections) {
      console.log(`\n  SECTION: ${section.section_key} (Phase ${section.phase})`)
      console.log(`    Status: ${section.status}`)

      // Check items
      const itemStatuses = section.clearance_items.map((i) => i.status)
      const allApproved = itemStatuses.every((s) => s === 'APPROVED' || s === 'NA')
      console.log(
        `    Items: ${itemStatuses.filter((s) => s === 'APPROVED').length}/${itemStatuses.length} approved`,
        allApproved ? '✅' : '⚠️'
      )

      if (!allApproved && section.status === 'PENDING') {
        console.log(`    ❌ ISSUE: Cannot approve section - not all items are APPROVED/NA`)
        section.clearance_items.forEach((item) => {
          if (item.status !== 'APPROVED' && item.status !== 'NA') {
            console.log(`       - ${item.item_key}: ${item.status}`)
          }
        })
      }

      // Check approver assignment
      const hasAssignment = await prisma.approverAssignment.findFirst({
        where: { company_code: COMPANY_CODE, section_key: section.section_key },
      })

      console.log(`    Assignment: ${hasAssignment ? '✅ Found' : '❌ MISSING'}`)

      if (!hasAssignment && section.section_key !== 'DEPT_HEAD') {
        console.log(`    ⚠️  No approver assigned to this section!`)
      }
    }
  }
}

/**
 * DIAGNOSTIC: Check user roles
 */
export async function checkApproverRoles() {
  console.log('\n\n🔐 CHECKING APPROVER ROLES')
  console.log('=' .repeat(60))

  // Get all users with approver roles or assignments
  const approvers = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { not: null } }, // Has any roles
      ],
    },
    select: { id: true, full_name: true, roles: true },
    take: 50,
  })

  const deptApprovers = approvers.filter((u) => {
    const roles = Array.isArray(u.roles) ? u.roles : []
    return roles.some((r: any) => typeof r === 'string' && r.startsWith('DEPT_APPROVER_'))
  })

  console.log(`\n👥 Found ${deptApprovers.length} users with DEPT_APPROVER roles:`)

  for (const user of deptApprovers) {
    const roles = Array.isArray(user.roles) ? user.roles : []
    const deptRoles = roles.filter((r: any) => typeof r === 'string' && r.startsWith('DEPT_APPROVER_'))
    console.log(`\n  ${user.full_name}`)
    deptRoles.forEach((role) => console.log(`    - ${role}`))

    // Check assignments
    const assignments = await prisma.approverAssignment.findMany({
      where: { approver_id: user.id, company_code: COMPANY_CODE },
    })

    if (assignments.length > 0) {
      console.log(`    Assignments for BSPL:`)
      assignments.forEach((a) => {
        console.log(`      - ${a.section_key} / ${a.item_key}`)
      })
    } else {
      console.log(`    ❌ No assignments for BSPL`)
    }
  }
}

/**
 * DIAGNOSTIC: Show all ApproverAssignments for BSPL
 */
export async function showAllAssignments() {
  console.log('\n\n📊 ALL APPROVER ASSIGNMENTS FOR BSPL')
  console.log('=' .repeat(60))

  const assignments = await prisma.approverAssignment.findMany({
    where: { company_code: COMPANY_CODE },
    include: { approver: { select: { full_name: true, roles: true } } },
  })

  if (assignments.length === 0) {
    console.log('\n⚠️  NO ASSIGNMENTS FOUND FOR BSPL!')
    return
  }

  // Group by section
  const bySection: Record<string, typeof assignments> = {}
  for (const a of assignments) {
    if (!bySection[a.section_key]) {
      bySection[a.section_key] = []
    }
    bySection[a.section_key].push(a)
  }

  for (const [sectionKey, sectionAssignments] of Object.entries(bySection)) {
    console.log(`\n${sectionKey}:`)
    sectionAssignments.forEach((a) => {
      console.log(
        `  ${a.item_key} → ${a.approver.full_name} ${
          Array.isArray(a.approver.roles) && a.approver.roles.includes(SECTION_ROLE_MAP[sectionKey])
            ? '✅'
            : '⚠️'
        }`
      )
    })
  }
}

/**
 * FIX: Grant missing DEPT_APPROVER roles to users
 */
export async function fixMissingRoles() {
  console.log('\n\n🔧 FIXING MISSING DEPT_APPROVER ROLES')
  console.log('=' .repeat(60))

  const assignments = await prisma.approverAssignment.findMany({
    where: { company_code: COMPANY_CODE },
    distinct: ['approver_id'],
  })

  console.log(`\nChecking ${assignments.length} unique approvers...`)

  let fixed = 0

  for (const assignment of assignments) {
    const user = await prisma.user.findUnique({
      where: { id: assignment.approver_id },
      select: { id: true, full_name: true, roles: true },
    })

    if (!user) continue

    const currentRoles = Array.isArray(user.roles) ? (user.roles as string[]) : []
    const sectionKey = assignment.section_key
    const requiredRole = SECTION_ROLE_MAP[sectionKey]

    if (!requiredRole) continue

    if (!currentRoles.includes(requiredRole)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: [...currentRoles, requiredRole] },
      })

      console.log(`  ✅ Added ${requiredRole} to ${user.full_name}`)
      fixed++
    }
  }

  console.log(`\n✅ Fixed ${fixed} users with missing roles`)
}

/**
 * FIX: Mark pending items as APPROVED so sections can be approved
 */
export async function autoApprovePendingItems(clearanceId?: string) {
  console.log('\n\n🔧 AUTO-APPROVING PENDING ITEMS')
  console.log('=' .repeat(60))

  const where = clearanceId
    ? { clearance_request_id: clearanceId, status: 'PENDING' }
    : {
        clearance_request: { employee: { company_code: COMPANY_CODE } },
        status: 'PENDING',
      }

  const items = await prisma.clearanceItem.findMany({
    where,
    include: { clearance_section: true },
  })

  console.log(`\nFound ${items.length} pending items`)

  if (items.length > 0) {
    await prisma.clearanceItem.updateMany({
      where,
      data: { status: 'NA', comments: 'Auto-approved (no action required)' },
    })

    console.log(`\n✅ Marked ${items.length} items as NA`)
  }
}

// Run diagnostics
async function main() {
  try {
    await diagnoseApproverIssues()
    await checkApproverRoles()
    await showAllAssignments()
  } catch (error) {
    console.error('ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
