import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB (to accommodate MP4s)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
])
const STORAGE_ROOT = 'C:\\Employee_Clearance_Attachments'

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

// ---------------------------------------------------------------------------
// GET /api/clearance/[id]/exit-interview-attachments
// ---------------------------------------------------------------------------
export const GET = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    select: { employee_id: true, initiated_by_hrbp_id: true },
  })
  if (!clearance) return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })

  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
  if (!isSuperAdmin && !isOwnerHRBP) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const attachments = await prisma.exitInterviewAttachment.findMany({
    where: { clearance_request_id: clearanceId },
    include: { uploaded_by: { select: { id: true, full_name: true } } },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(attachments)
})

// ---------------------------------------------------------------------------
// POST /api/clearance/[id]/exit-interview-attachments
// ---------------------------------------------------------------------------
export const POST = withAuth(async (req: AuthenticatedRequest, context: any) => {
  const user = req.user!
  const { id: clearanceId } = context.params as { id: string }

  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    select: {
      employee_id: true,
      initiated_by_hrbp_id: true,
      employee: { select: { full_name: true } },
    },
  })
  if (!clearance) return NextResponse.json({ error: 'Clearance not found' }, { status: 404 })

  const isSuperAdmin = user.roles.includes('SUPER_ADMIN')
  const isOwnerHRBP = user.roles.includes('HRBP') && clearance.initiated_by_hrbp_id === user.id
  if (!isSuperAdmin && !isOwnerHRBP) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
    return NextResponse.json({ error: 'File exceeds the 100 MB limit' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, MP4, MOV.' },
      { status: 400 }
    )
  }

  const employeeName = sanitizeFolderName(clearance.employee?.full_name ?? 'unknown')
  const safeOriginal = file.name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
  const storedFilename = `${Date.now()}_${safeOriginal}`
  const dir = path.join(STORAGE_ROOT, employeeName, 'exit_interview')

  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (err) {
    console.error('[exit-interview-attachments POST] mkdirSync error:', err)
    return NextResponse.json({ error: 'Storage directory could not be created' }, { status: 500 })
  }

  const storedPath = path.join(dir, storedFilename)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(storedPath, buffer)
  } catch (err) {
    console.error('[exit-interview-attachments POST] writeFileSync error:', err)
    return NextResponse.json({ error: 'Failed to save file to disk' }, { status: 500 })
  }

  try {
    const attachment = await prisma.exitInterviewAttachment.create({
      data: {
        clearance_request_id: clearanceId,
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
    try { fs.unlinkSync(storedPath) } catch {}
    console.error('[exit-interview-attachments POST] prisma.create error:', err)
    return NextResponse.json({ error: 'Database error while saving attachment' }, { status: 500 })
  }
})
