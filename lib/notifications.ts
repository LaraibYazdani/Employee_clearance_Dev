import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { SECTION_LABELS } from '@/lib/clearance-config'

// ---------------------------------------------------------------------------
// Nodemailer transport
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

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(
        '[notifications] sendEmail error: Missing SMTP configuration',
        {
          hasHost: !!process.env.SMTP_HOST,
          hasUser: !!process.env.SMTP_USER,
          hasPass: !!process.env.SMTP_PASS,
          hasPort: !!process.env.SMTP_PORT,
          hasFrom: !!process.env.SMTP_FROM,
        }
      )
      return
    }

    const transport = createTransport()
    
    // Test connection before sending
    try {
      await transport.verify()
    } catch (verifyError) {
      console.error('[notifications] SMTP verification failed:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      })
      throw verifyError
    }

    const mailResult = await transport.sendMail({
      from: process.env.SMTP_FROM || 'clearance-portal@company.com',
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    console.log('[notifications] sendEmail success:', {
      to: params.to,
      subject: params.subject,
      messageId: mailResult.messageId,
    })
  } catch (error) {
    console.error('[notifications] sendEmail failed:', {
      to: params.to,
      subject: params.subject,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

// ---------------------------------------------------------------------------
// Email template wrapper — Packages Group branding
// ---------------------------------------------------------------------------

function emailWrapper(body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f3f4f6; padding: 24px;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
        ${body}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #374151; font-size: 14px; margin: 0 0 2px 0;">Regards,</p>
        <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 16px 0;">Packages Group</p>
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">
          This is a system-generated email from the Employee Clearance Portal. Please do not reply directly to this message.
        </p>
      </div>
    </div>
  `
}

function ctaButton(href: string, label: string, color = '#2563eb'): string {
  return `<p style="margin: 24px 0 0 0;">
    <a href="${href}"
       style="background: ${color}; color: #ffffff; padding: 10px 24px; border-radius: 6px;
              text-decoration: none; font-size: 14px; display: inline-block;">
      ${label}
    </a>
  </p>`
}

// ---------------------------------------------------------------------------
// Template 1 — Employee: Clearance Initiated (also CC'd to HRBP)
// ---------------------------------------------------------------------------

export async function notifyEmployeeClearanceInitiated(clearanceId: string): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, email: true } },
      initiated_by_hrbp: { select: { id: true, full_name: true, email: true } },
    },
  })
  if (!clearance) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { employee, initiated_by_hrbp: hrbp } = clearance

  // Notify employee
  const message = `Your clearance process has been initiated by HRBP ${hrbp.full_name}.`
  await createNotification({
    recipientId: employee.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_INITIATED_EMPLOYEE',
    message,
  })

  const employeeHtml = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${employee.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      Your clearance process has been initiated by HRBP.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      You may log in to the clearance portal to review the status and progress.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'View Clearance Status')}
  `)

  await sendEmail({
    to: employee.email,
    subject: `Your Clearance Has Been Initiated`,
    html: employeeHtml,
  })

  // CC the HRBP
  const hrbpHtml = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${hrbp.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      This is a confirmation that you have successfully initiated a clearance process for
      <strong>${employee.full_name}</strong>.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      You may log in to the clearance portal to track the progress.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'View Clearance')}
  `)

  await sendEmail({
    to: hrbp.email,
    subject: `Clearance Initiated for ${employee.full_name}`,
    html: hrbpHtml,
  })
}

// ---------------------------------------------------------------------------
// Template 2 — Clearing Agent: Section 2 approvers notified on initiation
// Uses live ApproverAssignment rows — never the stale section.approver_id column.
// DEPT_HEAD is resolved via the employee's line_manager_id.
// ---------------------------------------------------------------------------

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
  if (!companyCode) return

  // Dynamically fetch phase-2 section keys from the template table — works for any company/custom sections
  const phaseTemplates = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: companyCode, phase: 2 },
    select: { section_key: true },
  })
  const section2Keys = phaseTemplates.map((t) => t.section_key)
  if (section2Keys.length === 0) return

  const sectionApproverMap = new Map<string, Set<string>>()

  const assignments = await prisma.approverAssignment.findMany({
    where: {
      company_code: companyCode,
      section_key: { in: section2Keys.filter((k) => k !== 'DEPT_HEAD') },
      item_key: 'section',
    },
    select: { section_key: true, approver_id: true },
  })
  for (const a of assignments) {
    if (!sectionApproverMap.has(a.section_key)) sectionApproverMap.set(a.section_key, new Set())
    sectionApproverMap.get(a.section_key)!.add(a.approver_id)
  }

  if (clearance.employee.line_manager_id && section2Keys.includes('DEPT_HEAD')) {
    sectionApproverMap.set('DEPT_HEAD', new Set([clearance.employee.line_manager_id]))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const sectionKey of section2Keys) {
    const approverIds = sectionApproverMap.get(sectionKey)
    if (!approverIds || approverIds.size === 0) continue

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        select: { id: true, email: true, full_name: true },
      })
      if (!approver) continue

      const message = `A clearance request for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id}) requires your action.`

      await createNotification({
        recipientId: approver.id,
        clearanceRequestId: clearanceId,
        type: 'CLEARANCE_INITIATED',
        message,
      })

      const html = emailWrapper(`
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear All,</p>
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
          A clearance request for <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>
          requires your action.
        </p>
        <p style="color: #374151; font-size: 14px; margin: 0;">
          Please log in to the clearance portal and complete your assigned step.
        </p>
        ${ctaButton(`${appUrl}/clearance/${clearanceId}?view=approvals`, 'Complete Your Action')}
      `)

      await sendEmail({
        to: approver.email,
        subject: `Action Required: Clearance for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id})`,
        html,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Template 2 — Clearing Agent: Section 3 approvers notified when phase 2 is done
// Uses live ApproverAssignment rows — never the stale section.approver_id column.
// ---------------------------------------------------------------------------

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
  if (!companyCode) return

  // Dynamically fetch phase-3 section keys from the template table — works for any company/custom sections
  const phaseTemplates = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: companyCode, phase: 3 },
    select: { section_key: true, label: true },
  })
  if (phaseTemplates.length === 0) return

  const section3Keys = phaseTemplates.map((t) => t.section_key)
  const labelFromDB = new Map(phaseTemplates.map((t) => [t.section_key, t.label]))

  const assignments = await prisma.approverAssignment.findMany({
    where: {
      company_code: companyCode,
      section_key: { in: section3Keys },
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

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        select: { id: true, email: true, full_name: true },
      })
      if (!approver) continue

      const sectionLabel = labelFromDB.get(sectionKey) ?? SECTION_LABELS[sectionKey] ?? sectionKey
      const message = `A clearance request for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id}) requires your action for: ${sectionLabel}.`

      await createNotification({
        recipientId: approver.id,
        clearanceRequestId: clearanceId,
        type: 'SECTION_3_UNLOCKED',
        message,
      })

      const html = emailWrapper(`
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear All,</p>
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
          A clearance request for <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>
          requires your action.
        </p>
        <p style="color: #374151; font-size: 14px; margin: 0;">
          Please log in to the clearance portal and complete your assigned step.
        </p>
        ${ctaButton(`${appUrl}/clearance/${clearanceId}?view=approvals`, 'Complete Your Action')}
      `)

      await sendEmail({
        to: approver.email,
        subject: `Action Required: Clearance for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id})`,
        html,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// HRBP: Section approved update
// ---------------------------------------------------------------------------

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const html = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${hrbp.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      <strong>${sectionLabel}</strong> for <strong>${clearance.employee.full_name}</strong>'s
      clearance has been approved by ${approverName}.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      Please log in to the clearance portal to review the updated status.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'View Clearance')}
  `)

  await sendEmail({
    to: hrbp.email,
    subject: `Clearance Update: ${sectionLabel} Approved — ${clearance.employee.full_name}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// HRBP: Section denied — action required
// ---------------------------------------------------------------------------

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const html = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${hrbp.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      <strong>${sectionLabel}</strong> for <strong>${clearance.employee.full_name}</strong>'s
      clearance has been denied by ${approverName}.
    </p>
    <div style="margin: 16px 0; padding: 12px 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> ${comment}</p>
    </div>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      Please log in to the clearance portal to review and re-route the section.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'Review &amp; Re-route', '#dc2626')}
  `)

  await sendEmail({
    to: hrbp.email,
    subject: `Action Required: ${sectionLabel} Denied — ${clearance.employee.full_name}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Template 4 — HR: Clearance completed (CC: HRBP + Employee)
// Primary recipient is the HRBP; employee receives a separate copy.
// ---------------------------------------------------------------------------

export async function notifyHRBPCompletion(clearanceId: string): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, sf_employee_id: true, email: true } },
      initiated_by_hrbp: { select: { id: true, full_name: true, email: true } },
    },
  })
  if (!clearance) return

  const { employee, initiated_by_hrbp: hrbp } = clearance
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // In-app notification for HRBP
  await createNotification({
    recipientId: hrbp.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_COMPLETED',
    message: `The clearance for ${employee.full_name} has been fully completed.`,
  })

  // Email to HRBP (primary — "Dear HR")
  const hrbpHtml = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear HR,</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      The clearance process for <strong>${employee.full_name}, ${employee.sf_employee_id}</strong>
      has been completed.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      You may log in to the clearance portal to review the final status.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      Please proceed with the full and final settlement.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'View Completed Clearance', '#16a34a')}
  `)

  await sendEmail({
    to: hrbp.email,
    subject: `Clearance Completed: ${employee.full_name} (${employee.sf_employee_id})`,
    html: hrbpHtml,
  })

  // CC — separate email to employee
  const employeeHtml = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${employee.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      Your clearance process has been fully completed.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      You may log in to the clearance portal to review the final status and download your clearance certificate.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'View Clearance Certificate', '#16a34a')}
  `)

  await sendEmail({
    to: employee.email,
    subject: `Your Clearance is Complete`,
    html: employeeHtml,
  })
}

// ---------------------------------------------------------------------------
// Approver: Section re-routed by HRBP
// Uses live ApproverAssignment rows — never the stale section.approver_id column.
// DEPT_HEAD is resolved via the employee's line_manager_id.
// ---------------------------------------------------------------------------

export async function notifyApproverRerouted(
  clearanceId: string,
  sectionKey: string,
  hrbpNote: string
): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) return

  const companyCode = clearance.employee.company_code
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
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
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { id: true, email: true, full_name: true },
    })
    if (!approver) continue

    const message = `Your section (${sectionLabel}) for ${clearance.employee.full_name}'s clearance has been re-routed by HRBP ${clearance.initiated_by_hrbp.full_name}. Note: ${hrbpNote}`

    await createNotification({
      recipientId: approver.id,
      clearanceRequestId: clearanceId,
      type: 'SECTION_REROUTED',
      message,
    })

    const html = emailWrapper(`
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${approver.full_name},</p>
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
        The <strong>${sectionLabel}</strong> section for
        <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>'s
        clearance has been re-routed by HRBP ${clearance.initiated_by_hrbp.full_name} for reconsideration.
      </p>
      <div style="margin: 16px 0; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>HRBP Note:</strong> ${hrbpNote}</p>
      </div>
      <p style="color: #374151; font-size: 14px; margin: 0;">
        Please log in to the clearance portal and complete your assigned step.
      </p>
      ${ctaButton(`${appUrl}/clearance/${clearanceId}?view=approvals`, 'Complete Your Action')}
    `)

    await sendEmail({
      to: approver.email,
      subject: `Action Required: ${sectionLabel} Re-routed — ${clearance.employee.full_name}`,
      html,
    })
  }
}

// ---------------------------------------------------------------------------
// Template 3 — Reminder: Clearing agent has a pending action
// NOT ACTIVE — function is defined but not called anywhere yet.
// Wire up to a scheduled job or manual trigger when reminders go live.
// ---------------------------------------------------------------------------

export async function notifyApproverReminder(
  clearanceId: string,
  approverId: string
): Promise<void> {
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true } },
    },
  })
  if (!clearance) return

  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, email: true, full_name: true },
  })
  if (!approver) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const message = `Reminder: Your clearance action for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id}) is still pending.`

  await createNotification({
    recipientId: approver.id,
    clearanceRequestId: clearanceId,
    type: 'APPROVER_REMINDER',
    message,
  })

  const html = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear,</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      Your clearance action for
      <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>
      is still pending.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      Kindly complete the required step in the clearance portal at the earliest.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}?view=approvals`, 'Complete Your Action', '#d97706')}
  `)

  await sendEmail({
    to: approver.email,
    subject: `Reminder: Pending Clearance Action for ${clearance.employee.full_name}`,
    html,
  })
}
