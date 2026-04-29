import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { SECTION_LABELS, SECTION_2_KEYS, SECTION_3_KEYS, SECTION_ROLE_MAP } from '@/lib/clearance-config'

// ---------------------------------------------------------------------------
// Nodemailer transport (configured via environment variables)
// ---------------------------------------------------------------------------

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  })
}

// ---------------------------------------------------------------------------
// Base helpers
// ---------------------------------------------------------------------------

/**
 * Creates an in-app notification record for a recipient.
 */
export async function createNotification(params: {
  recipientId: string
  clearanceRequestId: string
  type: string
  message: string
}): Promise<void> {
  await prisma.notification.create({
    data: {
      recipient_id: params.recipientId,
      clearance_request_id: params.clearanceRequestId,
      type: params.type,
      message: params.message,
    },
  })
}

/**
 * Sends an email via Nodemailer. Errors are logged but never thrown so that
 * a failed email never blocks the main request flow.
 */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  try {
    const transport = createTransport()
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'clearance-portal@company.com',
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
  } catch (error) {
    console.error('[notifications] sendEmail error:', error)
  }
}

// ---------------------------------------------------------------------------
// Email template helper
// ---------------------------------------------------------------------------

function emailWrapper(title: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">${title}</h2>
        ${body}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This is an automated message from the Employee Clearance Portal. Please do not reply to this email.
        </p>
      </div>
    </div>
  `
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding: 6px 12px 6px 0; color: #6b7280; font-size: 14px; white-space: nowrap;">${label}</td>
    <td style="padding: 6px 0; color: #111827; font-size: 14px;">${value}</td>
  </tr>`
}

// ---------------------------------------------------------------------------
// Domain-level notification functions
// ---------------------------------------------------------------------------

/**
 * Notifies all Section 2 approvers that a new clearance has been initiated.
 * Uses live ApproverAssignment rows — never the stale section.approver_id column.
 * DEPT_HEAD is resolved via the employee's line_manager_id.
 */
export async function notifySection2Approvers(clearanceId: string): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })

  if (!clearance) return

  const companyCode = clearance.employee.company_code
  const section2Keys = SECTION_2_KEYS as readonly string[]

  // Build a map of section_key → approver user IDs to notify
  const sectionApproverMap = new Map<string, Set<string>>()

  // Fetch all section-level assignments for this company + section2 keys
  if (companyCode) {
    const assignments = await prisma.approverAssignment.findMany({
      where: {
        company_code: companyCode,
        section_key: { in: [...section2Keys.filter((k) => k !== 'DEPT_HEAD')] },
        item_key: 'section',
      },
      select: { section_key: true, approver_id: true },
    })
    for (const a of assignments) {
      if (!sectionApproverMap.has(a.section_key)) sectionApproverMap.set(a.section_key, new Set())
      sectionApproverMap.get(a.section_key)!.add(a.approver_id)
    }
  }

  // DEPT_HEAD → line manager
  if (clearance.employee.line_manager_id) {
    sectionApproverMap.set('DEPT_HEAD', new Set([clearance.employee.line_manager_id]))
  }

  // Notify each unique approver per section
  for (const sectionKey of section2Keys) {
    const approverIds = sectionApproverMap.get(sectionKey)
    if (!approverIds || approverIds.size === 0) continue

    const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({ where: { id: approverId }, select: { id: true, email: true, full_name: true } })
      if (!approver) continue

      const message = `A new clearance request has been initiated for ${clearance.employee.full_name}. Your action is required for: ${sectionLabel}.`

      await createNotification({
        recipientId: approver.id,
        clearanceRequestId: clearanceId,
        type: 'CLEARANCE_INITIATED',
        message,
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const html = emailWrapper(
        'New Clearance Request — Action Required',
        `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
          A new employee clearance request requires your approval.
        </p>
        <table style="border-collapse: collapse; width: 100%;">
          ${detailRow('Employee', clearance.employee.full_name)}
          ${detailRow('Employee ID', clearance.employee.sf_employee_id)}
          ${detailRow('Section', sectionLabel)}
          ${detailRow('Initiated by', clearance.initiated_by_hrbp.full_name)}
        </table>
        <p style="margin: 20px 0 0 0;">
          <a href="${appUrl}/clearance/${clearanceId}?view=approvals"
             style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
            Review Clearance
          </a>
        </p>`
      )

      await sendEmail({
        to: approver.email,
        subject: `Action Required: Clearance for ${clearance.employee.full_name}`,
        html,
      })
    }
  }
}

/**
 * Notifies the HRBP that a section has been approved.
 */
export async function notifyHRBPSectionApproved(
  clearanceId: string,
  sectionKey: string,
  approverName: string
): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { employee: true, initiated_by_hrbp: true },
  })

  if (!clearance) return

  const hrbp = clearance.initiated_by_hrbp
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const message = `${sectionLabel} has been approved by ${approverName} for ${clearance.employee.full_name}'s clearance.`

  await createNotification({
    recipientId: hrbp.id,
    clearanceRequestId: clearanceId,
    type: 'SECTION_APPROVED',
    message,
  })

  const html = emailWrapper(
    'Section Approved',
    `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      A section in the clearance request has been approved.
    </p>
    <table style="border-collapse: collapse; width: 100%;">
      ${detailRow('Employee', clearance.employee.full_name)}
      ${detailRow('Section', sectionLabel)}
      ${detailRow('Approved by', approverName)}
    </table>
    <p style="margin: 20px 0 0 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/clearance/${clearanceId}"
         style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
        View Clearance
      </a>
    </p>`
  )

  await sendEmail({
    to: hrbp.email,
    subject: `Clearance Update: ${sectionLabel} Approved — ${clearance.employee.full_name}`,
    html,
  })
}

/**
 * Notifies the HRBP that a section has been denied.
 */
export async function notifyHRBPSectionDenied(
  clearanceId: string,
  sectionKey: string,
  approverName: string,
  comment: string
): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { employee: true, initiated_by_hrbp: true },
  })

  if (!clearance) return

  const hrbp = clearance.initiated_by_hrbp
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const message = `${sectionLabel} has been denied by ${approverName} for ${clearance.employee.full_name}'s clearance. Reason: ${comment}`

  await createNotification({
    recipientId: hrbp.id,
    clearanceRequestId: clearanceId,
    type: 'SECTION_DENIED',
    message,
  })

  const html = emailWrapper(
    'Section Denied — Action Required',
    `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      A section in the clearance request has been denied and requires your attention.
    </p>
    <table style="border-collapse: collapse; width: 100%;">
      ${detailRow('Employee', clearance.employee.full_name)}
      ${detailRow('Section', sectionLabel)}
      ${detailRow('Denied by', approverName)}
    </table>
    <div style="margin: 16px 0; padding: 12px 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> ${comment}</p>
    </div>
    <p style="margin: 20px 0 0 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/clearance/${clearanceId}"
         style="background: #dc2626; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
        Review &amp; Re-route
      </a>
    </p>`
  )

  await sendEmail({
    to: hrbp.email,
    subject: `Action Required: ${sectionLabel} Denied — ${clearance.employee.full_name}`,
    html,
  })
}

/**
 * Notifies Section 3 approvers (OD, HR, Finance) when all Section 2 sections are complete.
 * Uses live ApproverAssignment rows — never the stale section.approver_id column.
 */
export async function notifySection3Approvers(clearanceId: string): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })

  if (!clearance) return

  const companyCode = clearance.employee.company_code
  const section3Keys = SECTION_3_KEYS as readonly string[]

  // Fetch all section-level assignments for section3 keys
  if (!companyCode) return

  const assignments = await prisma.approverAssignment.findMany({
    where: {
      company_code: companyCode,
      section_key: { in: [...section3Keys] },
      item_key: 'section',
    },
    select: { section_key: true, approver_id: true },
  })

  const sectionApproverMap = new Map<string, Set<string>>()
  for (const a of assignments) {
    if (!sectionApproverMap.has(a.section_key)) sectionApproverMap.set(a.section_key, new Set())
    sectionApproverMap.get(a.section_key)!.add(a.approver_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const sectionKey of section3Keys) {
    const approverIds = sectionApproverMap.get(sectionKey)
    if (!approverIds || approverIds.size === 0) continue

    const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({ where: { id: approverId }, select: { id: true, email: true, full_name: true } })
      if (!approver) continue

      const message = `All department clearances are complete for ${clearance.employee.full_name}. Your action is now required for: ${sectionLabel}.`

      await createNotification({
        recipientId: approver.id,
        clearanceRequestId: clearanceId,
        type: 'SECTION_3_UNLOCKED',
        message,
      })

      const html = emailWrapper(
        'Clearance Ready for Your Review',
        `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
          All departmental sections have been approved. Your section is now unlocked for review.
        </p>
        <table style="border-collapse: collapse; width: 100%;">
          ${detailRow('Employee', clearance.employee.full_name)}
          ${detailRow('Employee ID', clearance.employee.sf_employee_id)}
          ${detailRow('Section', sectionLabel)}
          ${detailRow('Initiated by', clearance.initiated_by_hrbp.full_name)}
        </table>
        <p style="margin: 20px 0 0 0;">
          <a href="${appUrl}/clearance/${clearanceId}?view=approvals"
             style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
            Review Clearance
          </a>
        </p>`
      )

      await sendEmail({
        to: approver.email,
        subject: `Action Required: Final Clearance for ${clearance.employee.full_name}`,
        html,
      })
    }
  }
}

/**
 * Notifies the HRBP that the clearance is fully complete.
 */
export async function notifyHRBPCompletion(clearanceId: string): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { employee: true, initiated_by_hrbp: true },
  })

  if (!clearance) return

  const hrbp = clearance.initiated_by_hrbp
  const message = `The clearance for ${clearance.employee.full_name} has been fully completed. The PDF is being generated.`

  await createNotification({
    recipientId: hrbp.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_COMPLETED',
    message,
  })

  const html = emailWrapper(
    'Clearance Completed',
    `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      The employee clearance process has been successfully completed.
    </p>
    <table style="border-collapse: collapse; width: 100%;">
      ${detailRow('Employee', clearance.employee.full_name)}
      ${detailRow('Employee ID', clearance.employee.sf_employee_id)}
      ${detailRow('Status', 'COMPLETED')}
    </table>
    <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">
      The clearance certificate PDF is being generated and will be available shortly.
    </p>
    <p style="margin: 20px 0 0 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/clearance/${clearanceId}"
         style="background: #16a34a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
        View Clearance
      </a>
    </p>`
  )

  await sendEmail({
    to: hrbp.email,
    subject: `Clearance Completed: ${clearance.employee.full_name}`,
    html,
  })
}

/**
 * Notifies the relevant section approver(s) that their section has been re-routed by the HRBP.
 * Uses live ApproverAssignment rows — never the stale section.approver_id column.
 * DEPT_HEAD is resolved via the employee's line_manager_id.
 */
export async function notifyApproverRerouted(
  clearanceId: string,
  sectionKey: string,
  hrbpNote: string
): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, company_code: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })

  if (!clearance) return

  const companyCode = clearance.employee.company_code
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey

  // Resolve approver IDs for this section
  const approverIds: string[] = []

  if (sectionKey === 'DEPT_HEAD') {
    if (clearance.employee.line_manager_id) approverIds.push(clearance.employee.line_manager_id)
  } else if (companyCode) {
    const assignments = await prisma.approverAssignment.findMany({
      where: { company_code: companyCode, section_key: sectionKey, item_key: 'section' },
      select: { approver_id: true },
    })
    approverIds.push(...assignments.map((a) => a.approver_id))
  }

  if (approverIds.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const approverId of approverIds) {
    const approver = await prisma.user.findUnique({ where: { id: approverId }, select: { id: true, email: true, full_name: true } })
    if (!approver) continue

    const message = `Your section (${sectionLabel}) for ${clearance.employee.full_name}'s clearance has been re-routed by HRBP ${clearance.initiated_by_hrbp.full_name}. Note: ${hrbpNote}`

    await createNotification({
      recipientId: approver.id,
      clearanceRequestId: clearanceId,
      type: 'SECTION_REROUTED',
      message,
    })

    const html = emailWrapper(
      'Clearance Section Re-routed — Action Required',
      `<p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
        Your previously denied section has been re-routed by the HRBP for reconsideration.
      </p>
      <table style="border-collapse: collapse; width: 100%;">
        ${detailRow('Employee', clearance.employee.full_name)}
        ${detailRow('Section', sectionLabel)}
        ${detailRow('Re-routed by', clearance.initiated_by_hrbp.full_name)}
      </table>
      <div style="margin: 16px 0; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>HRBP Note:</strong> ${hrbpNote}</p>
      </div>
      <p style="margin: 20px 0 0 0;">
        <a href="${appUrl}/clearance/${clearanceId}?view=approvals"
           style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">
          Review Clearance
        </a>
      </p>`
    )

    await sendEmail({
      to: approver.email,
      subject: `Re-routed: ${sectionLabel} — ${clearance.employee.full_name}`,
      html,
    })
  }
}
