import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sectionRole } from '@/lib/approver-resolver'

// ---------------------------------------------------------------------------
// PATCH /api/admin/templates/[id]  — update a section template
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = context.params as { id: string }

  let body: {
    label?: string
    phase?: number
    sort_order?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.phase !== undefined && body.phase !== 2 && body.phase !== 3) {
    return NextResponse.json({ error: 'phase must be 2 or 3' }, { status: 400 })
  }

  try {
    const updated = await prisma.clearanceSectionTemplate.update({
      where: { id },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.phase !== undefined && { phase: body.phase }),
        ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
      },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
    }
    console.error('[PATCH /api/admin/templates/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/templates/[id]  — delete a section template
// Cascades: deletes all approver assignments for that section and revokes roles
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  if (!user.roles.includes('SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = context.params as { id: string }

  try {
    // Get the section template to find company_code and section_key
    const sectionTemplate = await prisma.clearanceSectionTemplate.findUnique({
      where: { id },
      select: { company_code: true, section_key: true },
    })

    if (!sectionTemplate) {
      return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
    }

    const { company_code, section_key } = sectionTemplate

    // Find all approver assignments for this section
    const assignments = await prisma.approverAssignment.findMany({
      where: { company_code, section_key },
      select: { approver_id: true },
    })

    // Revoke roles — works for both known and custom section keys
    const roleToRevoke = sectionRole(section_key)

    for (const assignment of assignments) {
      const approver = await prisma.user.findUnique({
        where: { id: assignment.approver_id },
        select: { roles: true },
      })

      if (approver) {
        const currentRoles = Array.isArray(approver.roles) ? (approver.roles as string[]) : []
        if (currentRoles.includes(roleToRevoke)) {
          // Only revoke if not still assigned to this section in another company
          const stillElsewhere = await prisma.approverAssignment.findFirst({
            where: {
              section_key,
              approver_id: assignment.approver_id,
              company_code: { not: company_code },
            },
            select: { id: true },
          })
          if (!stillElsewhere) {
            await prisma.user.update({
              where: { id: assignment.approver_id },
              data: { roles: currentRoles.filter((r) => r !== roleToRevoke) },
            })
          }
        }
      }
    }

    // Delete all approver assignments for this section
    await prisma.approverAssignment.deleteMany({
      where: { company_code, section_key },
    })

    // Delete all item templates for this section
    await prisma.clearanceItemTemplate.deleteMany({
      where: { company_code, section_key },
    })

    // Delete the section template
    await prisma.clearanceSectionTemplate.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `Section deleted. Removed ${assignments.length} approver assignment(s) and revoked associated roles.`,
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Section template not found' }, { status: 404 })
    }
    console.error('[DELETE /api/admin/templates/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
