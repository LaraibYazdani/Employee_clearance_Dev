import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/attachments/[attachmentId]
// Streams the file back to the client (inline for images, attachment for PDFs)
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, attachmentId } = context.params as {
    id: string
    attachmentId: string
  }

  const attachment = await prisma.clearanceItemAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      clearance_item: {
        include: {
          clearance_section: {
            include: {
              clearance_request: {
                select: { id: true, employee_id: true, initiated_by_hrbp_id: true },
              },
            },
          },
        },
      },
    },
  })

  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  const clearance = attachment.clearance_item.clearance_section.clearance_request
  if (clearance.id !== clearanceId) {
    return NextResponse.json({ error: 'Attachment does not belong to this clearance' }, { status: 400 })
  }

  // Same access control as the clearance detail
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
  const isSubjectEmployee = clearance.employee_id === user.id
  const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
  const isPayrollManager = user.roles.includes('PAYROLL_MANAGER')
  const isFinanceManager = user.roles.includes('FINANCE_MANAGER')
  if (!isSuperAdmin && !isOwnerHRBP && !isSubjectEmployee && !isDeptApprover && !isPayrollManager && !isFinanceManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!fs.existsSync(attachment.stored_path)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const buffer = fs.readFileSync(attachment.stored_path)
  // Serve all supported types inline (images + PDFs open in browser tab)
  const disposition = `inline; filename="${attachment.original_name}"`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': attachment.mime_type,
      'Content-Disposition': disposition,
      'Content-Length': String(buffer.length),
    },
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/clearance/[id]/attachments/[attachmentId]
// Only the uploader or SUPER_ADMIN can delete; item must not be APPROVED
// ---------------------------------------------------------------------------
export const DELETE = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, attachmentId } = context.params as {
    id: string
    attachmentId: string
  }

  const attachment = await prisma.clearanceItemAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      clearance_item: {
        select: {
          status: true,
          clearance_section: {
            include: {
              clearance_request: {
                select: { id: true, status: true, employee_id: true, initiated_by_hrbp_id: true },
              },
            },
          },
        },
      },
    },
  })

  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  const clearance = attachment.clearance_item.clearance_section.clearance_request
  if (clearance.id !== clearanceId) {
    return NextResponse.json({ error: 'Attachment does not belong to this clearance' }, { status: 400 })
  }

  // Only uploader or SUPER_ADMIN can delete
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isUploader = attachment.uploaded_by_id === user.id
  if (!isSuperAdmin && !isUploader) {
    return NextResponse.json({ error: 'Forbidden: only the uploader can delete this attachment' }, { status: 403 })
  }

  // Cannot delete once clearance is fully completed
  if (clearance.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Cannot delete attachments from a completed clearance' },
      { status: 409 }
    )
  }

  // Delete from disk
  try {
    if (fs.existsSync(attachment.stored_path)) {
      fs.unlinkSync(attachment.stored_path)
    }
  } catch (err) {
    console.error('[attachment DELETE] unlinkSync error:', err)
    // Proceed with DB deletion even if file removal fails
  }

  await prisma.clearanceItemAttachment.delete({ where: { id: attachmentId } })

  return NextResponse.json({ success: true })
})
