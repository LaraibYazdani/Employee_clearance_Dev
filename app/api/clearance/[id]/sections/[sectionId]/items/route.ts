import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SECTION_ROLE_MAP } from '@/lib/clearance-config'

// ---------------------------------------------------------------------------
// PATCH /api/clearance/[id]/sections/[sectionId]/items
// ---------------------------------------------------------------------------
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, sectionId } = context.params as { id: string; sectionId: string }

  let body: {
    items?: Array<{
      id: string
      status?: 'APPROVED' | 'NA' | 'PENDING'
      comments?: string
    }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 })
  }

  const allowedStatuses = ['APPROVED', 'NA', 'PENDING']
  for (const item of body.items) {
    if (!item.id) {
      return NextResponse.json({ error: 'Each item must have an id' }, { status: 400 })
    }
    if (item.status && !allowedStatuses.includes(item.status)) {
      return NextResponse.json(
        { error: `Invalid item status "${item.status}". Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      )
    }
  }

  try {
    // Fetch section to verify ownership
    const section = await prisma.clearanceSection.findUnique({
      where: { id: sectionId },
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    if (section.clearance_request_id !== clearanceId) {
      return NextResponse.json({ error: 'Section does not belong to this clearance' }, { status: 400 })
    }

    if (section.status === 'LOCKED') {
      return NextResponse.json({ error: 'Section is locked' }, { status: 409 })
    }

    if (section.status === 'APPROVED') {
      return NextResponse.json({ error: 'Section is already approved and items cannot be modified' }, { status: 409 })
    }

    // Verify the user is the assigned approver for this section
    const requiredRole = SECTION_ROLE_MAP[section.section_key]
    const hasRole = requiredRole ? user.roles.includes(requiredRole) : false
    const isAssignedApprover = section.approver_id === user.id

    if (!hasRole && !isAssignedApprover) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to update items in this section' },
        { status: 403 }
      )
    }

    // Update each item
    const updates = await Promise.all(
      body.items.map(async (itemUpdate) => {
        const existingItem = await prisma.clearanceItem.findFirst({
          where: {
            id: itemUpdate.id,
            clearance_section_id: sectionId,
          },
        })

        if (!existingItem) return null

        const data: any = {}
        if (itemUpdate.status !== undefined) data.status = itemUpdate.status
        if (itemUpdate.comments !== undefined) data.comments = itemUpdate.comments

        if (Object.keys(data).length === 0) return existingItem

        return prisma.clearanceItem.update({
          where: { id: itemUpdate.id },
          data,
        })
      })
    )

    const updatedItems = updates.filter(Boolean)

    return NextResponse.json({ updated: updatedItems.length, items: updatedItems })
  } catch (error) {
    console.error('[PATCH /api/clearance/[id]/sections/[sectionId]/items] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
