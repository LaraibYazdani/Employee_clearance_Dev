import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
])
const STORAGE_ROOT = 'C:\\Employee_Clearance_Attachments'

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/items/[itemId]/attachments
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, itemId } = context.params as { id: string; itemId: string }

  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    select: { employee_id: true, initiated_by_hrbp_id: true },
  })
  if (!clearance) return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })

  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
  const isSubjectEmployee = clearance.employee_id === user.id
  const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
  if (!isSuperAdmin && !isOwnerHRBP && !isSubjectEmployee && !isDeptApprover) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const attachments = await prisma.clearanceItemAttachment.findMany({
    where: { clearance_item_id: itemId },
    include: { uploaded_by: { select: { id: true, full_name: true } } },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(attachments)
})

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/items/[itemId]/attachments
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId, itemId } = context.params as { id: string; itemId: string }

  // Fetch item + section + clearance in one query
  const item = await prisma.clearanceItem.findUnique({
    where: { id: itemId },
    include: {
      clearance_section: {
        include: {
          clearance_request: {
            select: {
              id: true,
              status: true,
              employee_id: true,
              initiated_by_hrbp_id: true,
              employee: { select: { full_name: true } },
            },
          },
        },
      },
    },
  })

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const section = item.clearance_section
  const clearance = section.clearance_request

  if (clearance.id !== clearanceId) {
    return NextResponse.json({ error: 'Item does not belong to this clearance' }, { status: 400 })
  }

  // Access control
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
  const isSubjectEmployee = clearance.employee_id === user.id
  const isDeptApprover = user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))
  const isPayrollManager = user.roles.includes('PAYROLL_MANAGER')
  if (!isSuperAdmin && !isOwnerHRBP && !isSubjectEmployee && !isDeptApprover && !isPayrollManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Block uploads once the clearance is fully completed
  if (clearance.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Cannot add attachments — clearance is completed' },
      { status: 409 }
    )
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds the 10 MB limit' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Only JPEG, PNG, GIF, WebP images and PDFs are allowed.' },
      { status: 400 }
    )
  }

  // Build storage path:
  // C:\Employee_Clearance_Attachments\{employee_name}\{section_key}\{item_key}\
  const employeeName = sanitizeFolderName(clearance.employee?.full_name ?? 'unknown')
  const safeOriginal = file.name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
  const storedFilename = `${Date.now()}_${safeOriginal}`
  const dir = path.join(STORAGE_ROOT, employeeName, section.section_key, item.item_key)

  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (err) {
    console.error('[attachment POST] mkdirSync error:', err)
    return NextResponse.json({ error: 'Storage directory could not be created' }, { status: 500 })
  }

  const storedPath = path.join(dir, storedFilename)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(storedPath, buffer)
  } catch (err) {
    console.error('[attachment POST] writeFileSync error:', err)
    return NextResponse.json({ error: 'Failed to save file to disk' }, { status: 500 })
  }

  try {
    const attachment = await prisma.clearanceItemAttachment.create({
      data: {
        clearance_item_id: itemId,
        uploaded_by_id: user.id,
        original_name: file.name,
        stored_path: storedPath,
        file_size: file.size,
        mime_type: file.type,
      },
      include: { uploaded_by: { select: { id: true, full_name: true } } },
    })
    return NextResponse.json(attachment, { status: 201 })
  } catch (err) {
    // Roll back the file write if DB insert fails
    try { fs.unlinkSync(storedPath) } catch {}
    console.error('[attachment POST] prisma.create error:', err)
    return NextResponse.json({ error: 'Database error while saving attachment' }, { status: 500 })
  }
})
