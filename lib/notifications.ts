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
  console.log('[notifications] createNotification:', {
    recipientId: params.recipientId,
    clearanceRequestId: params.clearanceRequestId,
    type: params.type,
  })
  try {
    await prisma.notification.create({
      data: {
        recipient_id: params.recipientId,
        clearance_request_id: params.clearanceRequestId,
        type: params.type,
        message: params.message,
      },
    })
    console.log('[notifications] createNotification success:', { type: params.type, recipientId: params.recipientId })
  } catch (error) {
    console.error('[notifications] createNotification failed:', {
      recipientId: params.recipientId,
      type: params.type,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  console.log('[notifications] sendEmail called:', { to: params.to, subject: params.subject })
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(
        '[notifications] sendEmail error: Missing SMTP configuration',
        {
          SMTP_HOST: process.env.SMTP_HOST ?? '(missing)',
          SMTP_PORT: process.env.SMTP_PORT ?? '(missing)',
          SMTP_USER: process.env.SMTP_USER ?? '(missing)',
          SMTP_PASS: process.env.SMTP_PASS ? '(set)' : '(missing)',
          SMTP_FROM: process.env.SMTP_FROM ?? '(missing)',
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
  console.log('[notifications] notifyEmployeeClearanceInitiated START:', { clearanceId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, email: true } },
      initiated_by_hrbp: { select: { id: true, full_name: true, email: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyEmployeeClearanceInitiated SKIP: clearance not found', { clearanceId })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { employee, initiated_by_hrbp: hrbp } = clearance
  console.log('[notifications] notifyEmployeeClearanceInitiated found clearance:', {
    clearanceId,
    employeeId: employee.id,
    employeeEmail: employee.email,
    hrbpId: hrbp.id,
    hrbpEmail: hrbp.email,
  })

  // Notify employee
  const message = `Your clearance process has been initiated by HRBP ${hrbp.full_name}.`
  await createNotification({
    recipientId: employee.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_INITIATED_EMPLOYEE',
    message,
  })
  console.log('[notifications] notifyEmployeeClearanceInitiated: employee notification created')

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
  console.log('[notifications] notifyEmployeeClearanceInitiated: employee email sent')

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
  console.log('[notifications] notifyEmployeeClearanceInitiated: HRBP email sent')
  console.log('[notifications] notifyEmployeeClearanceInitiated END: all emails sent', { clearanceId })
}

// ---------------------------------------------------------------------------
// Template 1.5 — Line Manager: Notified of clearance requiring their approval
// Resolves line manager from employee's line_manager_id
// Skips with note if no line manager found in system
// ---------------------------------------------------------------------------

export async function notifyLineManager(clearanceId: string): Promise<void> {
  console.log('[notifications] notifyLineManager START:', { clearanceId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, sf_employee_id: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyLineManager SKIP: clearance not found', { clearanceId })
    return
  }

  console.log('[notifications] notifyLineManager found clearance:', {
    clearanceId,
    employeeId: clearance.employee.id,
    employeeName: clearance.employee.full_name,
    lineManagerId: clearance.employee.line_manager_id,
  })

  // Check if line manager exists
  if (!clearance.employee.line_manager_id) {
    console.warn('[notifications] notifyLineManager SKIP: no line manager found for employee', {
      clearanceId,
      employeeId: clearance.employee.id,
      employeeName: clearance.employee.full_name,
    })
    return
  }

  // Fetch line manager details
  const lineManager = await prisma.user.findUnique({
    where: { id: clearance.employee.line_manager_id },
    select: { id: true, email: true, full_name: true },
  })

  if (!lineManager) {
    console.warn('[notifications] notifyLineManager SKIP: line manager ID exists but user record not found', {
      clearanceId,
      lineManagerId: clearance.employee.line_manager_id,
    })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  console.log('[notifications] notifyLineManager: line manager found', {
    clearanceId,
    lineManagerId: lineManager.id,
    lineManagerEmail: lineManager.email,
    lineManagerName: lineManager.full_name,
  })

  // Create in-app notification for line manager
  const message = `A clearance request for ${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}, who reports to you, requires your approval.`
  await createNotification({
    recipientId: lineManager.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_INITIATED',
    message,
  })
  console.log('[notifications] notifyLineManager: notification created for', { lineManagerId: lineManager.id })

  // Send email to line manager
  const html = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${lineManager.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      A clearance request for <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>,
      who reports to you, requires your approval.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0;">
      Please log in to the clearance portal and provide your approval.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}?view=approvals`, 'Open for Approval')}
  `)

  await sendEmail({
    to: lineManager.email,
    subject: `Action Required: Clearance Approval for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id})`,
    html,
  })
  console.log('[notifications] notifyLineManager: email sent successfully', {
    clearanceId,
    lineManagerEmail: lineManager.email,
  })
  console.log('[notifications] notifyLineManager END:', { clearanceId, lineManagerId: lineManager.id })
}

// ---------------------------------------------------------------------------
// Template 2 — Clearing Agent: Section 2 approvers notified on initiation
// Uses live ApproverAssignment rows — never the stale section.approver_id column.
// DEPT_HEAD is resolved via the employee's line_manager_id.
// ---------------------------------------------------------------------------

export async function notifySection2Approvers(clearanceId: string): Promise<void> {
  console.log('[notifications] notifySection2Approvers START:', { clearanceId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifySection2Approvers SKIP: clearance not found', { clearanceId })
    return
  }

  const companyCode = clearance.employee.company_code
  console.log('[notifications] notifySection2Approvers found clearance:', {
    clearanceId,
    employeeName: clearance.employee.full_name,
    companyCode,
  })
  
  if (!companyCode) {
    console.warn('[notifications] notifySection2Approvers SKIP: companyCode is null or undefined', {
      clearanceId,
      employeeId: clearance.employee,
    })
    return
  }

  // Dynamically fetch phase-2 section keys from the template table — works for any company/custom sections
  const phaseTemplates = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: companyCode, phase: 2 },
    select: { section_key: true },
  })
  const section2Keys = phaseTemplates.map((t) => t.section_key)
  console.log('[notifications] notifySection2Approvers: phase 2 templates:', {
    companyCode,
    section2KeysCount: section2Keys.length,
    section2Keys,
  })
  
  if (section2Keys.length === 0) {
    console.warn('[notifications] notifySection2Approvers SKIP: no phase 2 sections found', { companyCode })
    return
  }

  const sectionApproverMap = new Map<string, Set<string>>()

  const assignments = await prisma.approverAssignment.findMany({
    where: {
      company_code: companyCode,
      section_key: { in: section2Keys.filter((k) => k !== 'DEPT_HEAD') },
      item_key: 'section',
    },
    select: { section_key: true, approver_id: true },
  })
  console.log('[notifications] notifySection2Approvers: approver assignments found:', { assignmentCount: assignments.length })
  
  for (const a of assignments) {
    if (!sectionApproverMap.has(a.section_key)) sectionApproverMap.set(a.section_key, new Set())
    sectionApproverMap.get(a.section_key)!.add(a.approver_id)
  }

  if (clearance.employee.line_manager_id) {
    if (section2Keys.includes('DEPT_HEAD')) {
      sectionApproverMap.set('DEPT_HEAD', new Set([clearance.employee.line_manager_id]))
      console.log('[notifications] notifySection2Approvers: added DEPT_HEAD approver via line_manager', {
        lineManagerId: clearance.employee.line_manager_id,
      })
    }
    if (section2Keys.includes('LINE_MANAGER')) {
      sectionApproverMap.set('LINE_MANAGER', new Set([clearance.employee.line_manager_id]))
      console.log('[notifications] notifySection2Approvers: added LINE_MANAGER approver via line_manager', {
        lineManagerId: clearance.employee.line_manager_id,
      })
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let totalEmailsSent = 0
  let totalApproversProcessed = 0

  for (const sectionKey of section2Keys) {
    const approverIds = sectionApproverMap.get(sectionKey)
    console.log('[notifications] notifySection2Approvers: processing section:', {
      sectionKey,
      approverCount: approverIds?.size ?? 0,
    })
    
    if (!approverIds || approverIds.size === 0) {
      console.warn('[notifications] notifySection2Approvers: no approvers for section', { sectionKey })
      continue
    }

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        select: { id: true, email: true, full_name: true },
      })
      if (!approver) {
        console.warn('[notifications] notifySection2Approvers: approver not found', { approverId })
        continue
      }

      totalApproversProcessed++
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
      totalEmailsSent++
    }
  }
  
  console.log('[notifications] notifySection2Approvers END:', {
    clearanceId,
    totalApproversProcessed,
    totalEmailsSent,
  })
}

// ---------------------------------------------------------------------------
// Template 2 — Clearing Agent: Section 3 approvers notified when phase 2 is done
// Uses live ApproverAssignment rows — never the stale section.approver_id column.
// ---------------------------------------------------------------------------

export async function notifySection3Approvers(clearanceId: string): Promise<void> {
  console.log('[notifications] notifySection3Approvers START:', { clearanceId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifySection3Approvers SKIP: clearance not found', { clearanceId })
    return
  }

  const companyCode = clearance.employee.company_code
  console.log('[notifications] notifySection3Approvers found clearance:', {
    clearanceId,
    employeeName: clearance.employee.full_name,
    companyCode,
  })
  
  if (!companyCode) {
    console.warn('[notifications] notifySection3Approvers SKIP: companyCode is null', { clearanceId })
    return
  }

  // Dynamically fetch phase-3 section keys from the template table — works for any company/custom sections
  const phaseTemplates = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: companyCode, phase: 3 },
    select: { section_key: true, label: true },
  })
  console.log('[notifications] notifySection3Approvers: phase 3 templates found:', {
    companyCode,
    templateCount: phaseTemplates.length,
  })
  
  if (phaseTemplates.length === 0) {
    console.warn('[notifications] notifySection3Approvers SKIP: no phase 3 sections in templates', { companyCode })
    return
  }

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
  console.log('[notifications] notifySection3Approvers: assignments found:', { assignmentCount: assignments.length })

  const sectionApproverMap = new Map<string, Set<string>>()
  for (const a of assignments) {
    if (!sectionApproverMap.has(a.section_key)) sectionApproverMap.set(a.section_key, new Set())
    sectionApproverMap.get(a.section_key)!.add(a.approver_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let totalEmailsSent = 0
  let totalApproversProcessed = 0

  for (const sectionKey of section3Keys) {
    const approverIds = sectionApproverMap.get(sectionKey)
    console.log('[notifications] notifySection3Approvers: processing section:', {
      sectionKey,
      approverCount: approverIds?.size ?? 0,
    })
    
    if (!approverIds || approverIds.size === 0) {
      console.warn('[notifications] notifySection3Approvers: no approvers for section', { sectionKey })
      continue
    }

    for (const approverId of Array.from(approverIds)) {
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        select: { id: true, email: true, full_name: true },
      })
      if (!approver) {
        console.warn('[notifications] notifySection3Approvers: approver not found', { approverId })
        continue
      }

      totalApproversProcessed++
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
      totalEmailsSent++
    }
  }
  
  console.log('[notifications] notifySection3Approvers END:', {
    clearanceId,
    totalApproversProcessed,
    totalEmailsSent,
  })
}

// ---------------------------------------------------------------------------
// HRBP: Section approved update
// ---------------------------------------------------------------------------

export async function notifyHRBPSectionApproved(
  clearanceId: string,
  sectionKey: string,
  approverName: string
): Promise<void> {
  console.log('[notifications] notifyHRBPSectionApproved START:', { clearanceId, sectionKey, approverName })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { employee: true, initiated_by_hrbp: true },
  })
  if (!clearance) {
    console.warn('[notifications] notifyHRBPSectionApproved SKIP: clearance not found', { clearanceId })
    return
  }

  const hrbp = clearance.initiated_by_hrbp
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const message = `${sectionLabel} has been approved by ${approverName} for ${clearance.employee.full_name}'s clearance.`
  console.log('[notifications] notifyHRBPSectionApproved: sending notification to HRBP:', {
    hrbpId: hrbp.id,
    hrbpEmail: hrbp.email,
    sectionLabel,
  })

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
  console.log('[notifications] notifyHRBPSectionApproved END: email sent', { clearanceId, sectionKey })
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
  console.log('[notifications] notifyHRBPSectionDenied START:', { clearanceId, sectionKey, approverName })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: { employee: true, initiated_by_hrbp: true },
  })
  if (!clearance) {
    console.warn('[notifications] notifyHRBPSectionDenied SKIP: clearance not found', { clearanceId })
    return
  }

  const hrbp = clearance.initiated_by_hrbp
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const message = `${sectionLabel} has been denied by ${approverName} for ${clearance.employee.full_name}'s clearance. Reason: ${comment}`
  console.log('[notifications] notifyHRBPSectionDenied: sending notification to HRBP:', {
    hrbpId: hrbp.id,
    hrbpEmail: hrbp.email,
    sectionLabel,
    commentLength: comment.length,
  })

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
  console.log('[notifications] notifyHRBPSectionDenied END: email sent', { clearanceId, sectionKey })
}

// ---------------------------------------------------------------------------
// Template 4 — HR: Clearance completed (CC: HRBP + Employee)
// Primary recipient is the HRBP; employee receives a separate copy.
// ---------------------------------------------------------------------------

export async function notifyHRBPCompletion(clearanceId: string): Promise<void> {
  console.log('[notifications] notifyHRBPCompletion START:', { clearanceId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, sf_employee_id: true, email: true } },
      initiated_by_hrbp: { select: { id: true, full_name: true, email: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyHRBPCompletion SKIP: clearance not found', { clearanceId })
    return
  }

  const { employee, initiated_by_hrbp: hrbp } = clearance
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  console.log('[notifications] notifyHRBPCompletion: found clearance:', {
    clearanceId,
    employeeId: employee.id,
    employeeEmail: employee.email,
    hrbpId: hrbp.id,
    hrbpEmail: hrbp.email,
  })

  // In-app notification for HRBP
  await createNotification({
    recipientId: hrbp.id,
    clearanceRequestId: clearanceId,
    type: 'CLEARANCE_COMPLETED',
    message: `The clearance for ${employee.full_name} has been fully completed.`,
  })
  console.log('[notifications] notifyHRBPCompletion: HRBP notification created')

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
  console.log('[notifications] notifyHRBPCompletion: HRBP email sent')

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
  console.log('[notifications] notifyHRBPCompletion: employee email sent')
  console.log('[notifications] notifyHRBPCompletion END: all emails sent', { clearanceId })
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
  console.log('[notifications] notifyApproverRerouted START:', { clearanceId, sectionKey })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true, company_code: true, line_manager_id: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyApproverRerouted SKIP: clearance not found', { clearanceId })
    return
  }

  const companyCode = clearance.employee.company_code
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const approverIds: string[] = []
  console.log('[notifications] notifyApproverRerouted: found clearance:', {
    clearanceId,
    sectionKey,
    sectionLabel,
    companyCode,
  })

  if (sectionKey === 'DEPT_HEAD' || sectionKey === 'LINE_MANAGER') {
    if (clearance.employee.line_manager_id) {
      approverIds.push(clearance.employee.line_manager_id)
      console.log('[notifications] notifyApproverRerouted: using line_manager as DEPT_HEAD/LINE_MANAGER', {
        lineManagerId: clearance.employee.line_manager_id,
      })
    } else {
      console.warn('[notifications] notifyApproverRerouted: DEPT_HEAD/LINE_MANAGER section but no line_manager_id', { clearanceId })
    }
  } else if (companyCode) {
    const assignments = await prisma.approverAssignment.findMany({
      where: { company_code: companyCode, section_key: sectionKey, item_key: 'section' },
      select: { approver_id: true },
    })
    approverIds.push(...assignments.map((a) => a.approver_id))
    console.log('[notifications] notifyApproverRerouted: found assignmentCount:', {
      sectionKey,
      assignmentCount: assignments.length,
    })
  }

  if (approverIds.length === 0) {
    console.warn('[notifications] notifyApproverRerouted SKIP: no approverIds found', {
      clearanceId,
      sectionKey,
      isDepthHead: sectionKey === 'DEPT_HEAD',
    })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let emailsSent = 0

  for (const approverId of approverIds) {
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { id: true, email: true, full_name: true },
    })
    if (!approver) {
      console.warn('[notifications] notifyApproverRerouted: approver not found', { approverId })
      continue
    }

    const message = `Your section (${sectionLabel}) for ${clearance.employee.full_name}'s clearance has been re-routed by HRBP ${clearance.initiated_by_hrbp.full_name}. Note: ${hrbpNote}`
    console.log('[notifications] notifyApproverRerouted: processing approver:', {
      approverId,
      approverEmail: approver.email,
      sectionKey,
    })

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
    emailsSent++
  }
  
  console.log('[notifications] notifyApproverRerouted END:', {
    clearanceId,
    sectionKey,
    emailsSent,
  })
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
  console.log('[notifications] notifyApproverReminder START:', { clearanceId, approverId })
  
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { full_name: true, sf_employee_id: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyApproverReminder SKIP: clearance not found', { clearanceId })
    return
  }

  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, email: true, full_name: true },
  })
  if (!approver) {
    console.warn('[notifications] notifyApproverReminder SKIP: approver not found', { approverId })
    return
  }

  console.log('[notifications] notifyApproverReminder: found clearance and approver:', {
    clearanceId,
    approverId,
    approverEmail: approver.email,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const message = `Reminder: Your clearance action for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id}) is still pending.`

  await createNotification({
    recipientId: approver.id,
    clearanceRequestId: clearanceId,
    type: 'APPROVER_REMINDER',
    message,
  })
  console.log('[notifications] notifyApproverReminder: notification created')

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
  console.log('[notifications] notifyApproverReminder END: email sent', { clearanceId, approverId })
}

// ---------------------------------------------------------------------------
// Payroll Manager: All sections approved — ready for final sign-off
// ---------------------------------------------------------------------------

export async function notifyPayrollManager(clearanceId: string): Promise<void> {
  console.log('[notifications] notifyPayrollManager START:', { clearanceId })

  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: { select: { id: true, full_name: true, sf_employee_id: true, company_code: true } },
      initiated_by_hrbp: { select: { full_name: true } },
    },
  })
  if (!clearance) {
    console.warn('[notifications] notifyPayrollManager SKIP: clearance not found', { clearanceId })
    return
  }

  const companyCode = clearance.employee.company_code
  if (!companyCode) {
    console.warn('[notifications] notifyPayrollManager SKIP: no company_code', { clearanceId })
    return
  }

  const assignment = await prisma.approverAssignment.findFirst({
    where: { company_code: companyCode, section_key: 'PAYROLL_MANAGER' },
    select: { approver_id: true },
  })
  if (!assignment) {
    console.warn('[notifications] notifyPayrollManager SKIP: no payroll manager assigned', { companyCode })
    return
  }

  const payrollManager = await prisma.user.findUnique({
    where: { id: assignment.approver_id },
    select: { id: true, email: true, full_name: true },
  })
  if (!payrollManager) {
    console.warn('[notifications] notifyPayrollManager SKIP: payroll manager user not found', { approverId: assignment.approver_id })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const message = `All sections for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id}) have been approved. Please complete the clearance.`

  await createNotification({
    recipientId: payrollManager.id,
    clearanceRequestId: clearanceId,
    type: 'READY_FOR_PAYROLL',
    message,
  })

  const html = emailWrapper(`
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Dear ${payrollManager.full_name},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      All department sections for <strong>${clearance.employee.full_name}, ${clearance.employee.sf_employee_id}</strong>
      have been approved.
    </p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
      Please log in to the clearance portal to review the deductible entries and complete the clearance.
    </p>
    ${ctaButton(`${appUrl}/clearance/${clearanceId}`, 'Complete Clearance', '#7c3aed')}
  `)

  await sendEmail({
    to: payrollManager.email,
    subject: `Action Required: Complete Clearance for ${clearance.employee.full_name} (${clearance.employee.sf_employee_id})`,
    html,
  })
  console.log('[notifications] notifyPayrollManager END: email sent', { clearanceId, payrollManagerId: payrollManager.id })
}
