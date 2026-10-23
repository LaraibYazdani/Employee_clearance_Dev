import puppeteer from 'puppeteer'
import { prisma } from './prisma'
import { SECTION_LABELS } from './clearance-config'
import { IS_TEST_SERVER, PDF_TEST_WATERMARK_HTML } from './site-config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(val: string | null | undefined): string {
  return val ?? '—'
}

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtPKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

type GroupKey = 'PAYABLES' | 'INVENTORY' | 'ERS' | 'PAYROLL_FUNDS'

const GROUP_LABELS: Record<GroupKey, string> = {
  PAYABLES: 'Payables',
  INVENTORY: 'Inventory',
  ERS: 'ERS',
  PAYROLL_FUNDS: 'Payroll & Funds',
}

const GROUP_ORDER: GroupKey[] = ['PAYABLES', 'INVENTORY', 'ERS', 'PAYROLL_FUNDS']

// Section categorisation — fully dynamic, no hardcoded keys
const isFinanceSection = (key: string) => key.includes('FINANCE')
const isHRSection = (key: string) => key.includes('HR_DEPT') || key === 'OD_DEPT'
const isPayrollSection = (key: string) => key === 'PAYROLL_MANAGER'
const isDeptSection = (key: string) =>
  !isFinanceSection(key) && !isHRSection(key) && !isPayrollSection(key)

function sectionSig(sec: any): string {
  if (sec.status === 'APPROVED' && sec.approver_name)
    return `${sec.approver_name}<br><span style="font-size:10px;color:#555;">${fmtDate(sec.decision_at)}</span>`
  if (sec.status === 'DENIED')
    return `<span style="color:red;">DENIED</span><br><span style="font-size:10px;">${sec.approver_name ?? ''}</span>`
  return '—'
}

function queryBadge(val: string | null | undefined): string {
  if (!val) return '—'
  const map: Record<string, string> = {
    YES: 'Yes', NO: 'No', NA: 'N/A', GROUP_TRANSFER: 'Group Transfer',
  }
  return map[val] ?? val
}

// ---------------------------------------------------------------------------
// HTML Builder
// ---------------------------------------------------------------------------
function buildHTML(data: {
  clearance: any
  employee: any
  hrbp: any
  sections: any[]
  financeEntries: any[]
}): string {
  const { clearance, employee, hrbp, sections, financeEntries } = data

  const companyName = employee?.company ?? 'Packages Ltd.'

  // ---- Categorise sections ----
  const deptSections = sections.filter((s) => isDeptSection(s.section_key))
  const hrSections   = sections.filter((s) => isHRSection(s.section_key))
  const finSections  = sections.filter((s) => isFinanceSection(s.section_key))
  const pmSection    = sections.find((s) => isPayrollSection(s.section_key))

  // ---- Section 2: Departmental rows (dynamic) ----
  const section2Rows = deptSections.map((sec) => {
    const items = sec.clearance_items ?? []
    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;color:#555;">&nbsp;</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? '&#10003;' : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.comments ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.approver_name ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">&nbsp;</td>
      </tr>`).join('')
    return `
      <tr style="background:#f5f5f5;">
        <td colspan="6" style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:bold;">
          ${SECTION_LABELS[sec.section_key] ?? sec.section_key}
        </td>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="4" style="padding:5px 8px;border:1px solid #ccc;">&nbsp;</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sec.approver_name ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sectionSig(sec)}</td>
      </tr>`
  }).join('')

  // ---- Section 3B: HR & OD rows (dynamic) ----
  const hrRows = hrSections.map((sec) => {
    const items = sec.clearance_items ?? []
    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${SECTION_LABELS[sec.section_key] ?? sec.section_key}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? '&#10003;' : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.comments ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sec.approver_name ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sectionSig(sec)}</td>
      </tr>`).join('')
    return itemRows
  }).join('')

  // ---- Section 3C: Finance rows (dynamic) ----
  const financeGroupBlocks = GROUP_ORDER.map((groupKey) => {
    const groupEntries = financeEntries.filter((e: any) => e.section_group === groupKey)
    if (!groupEntries.length) return ''
    const total = groupEntries.reduce((sum: number, e: any) => sum + (e.amount_pkr ?? 0), 0)
    const relevantFinSec = (() => {
      const sk = (s: any) => (s.section_key as string).toUpperCase()
      if (groupKey === 'PAYABLES' || groupKey === 'INVENTORY')
        return finSections.find((s) => sk(s).includes('INVENTORY_PAYABLES') || sk(s).includes('INVENTORY'))
      if (groupKey === 'ERS')
        return finSections.find((s) => sk(s).includes('ERS'))
      if (groupKey === 'PAYROLL_FUNDS')
        return finSections.find((s) => sk(s).includes('PAYROLL'))
      return finSections[0]
    })() ?? finSections[0]
    const entryRows = groupEntries.map((e: any) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${e.gl_account ?? '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${e.particulars}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:right;">${fmtPKR(e.amount_pkr)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
          ${relevantFinSec?.status === 'APPROVED' && relevantFinSec?.approver_name
            ? `${relevantFinSec.approver_name} | ${fmtDate(relevantFinSec.decision_at)}`
            : ''}
        </td>
      </tr>`).join('')
    return `
      <tr style="background:#f0f0f0;">
        <td colspan="4" style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:bold;">${GROUP_LABELS[groupKey]}</td>
      </tr>
      ${entryRows}
      <tr style="background:#fafafa;">
        <td colspan="2" style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold;text-align:right;">Total:</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold;text-align:right;">${fmtPKR(total)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
          ${relevantFinSec?.status === 'APPROVED' && relevantFinSec?.approver_name
            ? `Financial Controller/CFO: ${relevantFinSec.approver_name} | ${fmtDate(relevantFinSec.decision_at)}`
            : ''}
        </td>
      </tr>`
  }).join('')

  // ---- Finance section item rows (company-specific finance sections) ----
  const finSectionItemRows = finSections.map((sec) => {
    const items = sec.clearance_items ?? []
    if (!items.length) return ''
    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${SECTION_LABELS[sec.section_key] ?? sec.section_key}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? '&#10003;' : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.comments ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.approver_name ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sectionSig(sec)}</td>
      </tr>`).join('')
    return itemRows
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${IS_TEST_SERVER ? '[TEST] ' : ''}Employee Exit Clearance Form</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; background: #fff; padding: 20px 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #e8e8e8; padding: 6px 8px; border: 1px solid #ccc; font-size: 11px; text-align: left; font-weight: bold; text-transform: uppercase; }
    td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; vertical-align: top; }
    .section-heading { font-size: 13px; font-weight: bold; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #333; color: #111; }
    .label { font-weight: bold; white-space: nowrap; width: 150px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  ${PDF_TEST_WATERMARK_HTML}

  <!-- ===== HEADER ===== -->
  <div style="text-align:center;margin-bottom:20px;border-bottom:3px double #333;padding-bottom:12px;">
    <div style="font-size:22px;font-weight:900;letter-spacing:0.08em;">${companyName}</div>
    <div style="font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">
      Employee Exit Clearance Form
    </div>
    <p style="font-size:10px;color:#666;margin-top:4px;">
      Clearance ID: ${clearance.id} &nbsp;|&nbsp; Status: ${clearance.status} &nbsp;|&nbsp; Generated: ${fmtDate(new Date().toISOString())}
    </p>
  </div>

  <!-- ===== SECTION 1: EMPLOYEE DETAILS ===== -->
  <div class="section-heading">Section 1 &mdash; Employee Information</div>
  <table>
    <tbody>
      <tr>
        <td class="label">Employee #</td><td>${fmt(employee?.sf_employee_id)}</td>
        <td class="label">Employee Name</td><td>${fmt(employee?.full_name)}</td>
      </tr>
      <tr>
        <td class="label">Designation</td><td>${fmt(employee?.designation)}</td>
        <td class="label">Grade</td><td>${fmt(employee?.grade)}</td>
      </tr>
      <tr>
        <td class="label">Department</td><td>${fmt(employee?.department)}</td>
        <td class="label">Division</td><td>${fmt(employee?.division)}</td>
      </tr>
      <tr>
        <td class="label">Company</td><td>${fmt(employee?.company)}</td>
        <td class="label">HRBP</td><td>${fmt(hrbp?.full_name)}</td>
      </tr>
      <tr>
        <td class="label">Date of Leaving</td><td>${fmtDate(clearance.date_of_leaving)}</td>
        <td class="label">Issued By</td><td>${fmt(clearance.issued_by)}</td>
      </tr>
      <tr>
        <td class="label">Issuance Date</td><td>${fmtDate(clearance.issuance_date)}</td>
        <td class="label">Receiving Date</td><td>${fmtDate(clearance.receiving_date)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ===== EMPLOYEE QUERIES ===== -->
  ${(clearance.laptop_buyback || clearance.vehicle_loan || clearance.sim_transfer || clearance.exit_interview || clearance.training_bond || clearance.other_query) ? `
  <div class="section-heading">Employee Queries</div>
  <table>
    <tbody>
      ${clearance.laptop_buyback ? `<tr><td class="label">Laptop Buyback</td><td>${queryBadge(clearance.laptop_buyback)}</td><td class="label">Vehicle Loan</td><td>${queryBadge(clearance.vehicle_loan)}</td></tr>` : ''}
      ${clearance.sim_transfer ? `<tr><td class="label">SIM Transfer</td><td>${queryBadge(clearance.sim_transfer)}</td><td class="label">Exit Interview</td><td>${queryBadge(clearance.exit_interview)}</td></tr>` : ''}
      ${clearance.training_bond ? `<tr><td class="label">Training Bond</td><td>${queryBadge(clearance.training_bond)}</td><td class="label">Other Query</td><td>${fmt(clearance.other_query)}</td></tr>` : ''}
    </tbody>
  </table>` : ''}

  <!-- ===== SECTION 2: DEPARTMENTAL CLEARANCES ===== -->
  <div class="section-heading">Section 2 &mdash; Departmental Clearances</div>
  <table>
    <thead>
      <tr>
        <th style="width:16%;">Department</th>
        <th style="width:24%;">Item / Description</th>
        <th style="width:7%;text-align:center;">Result</th>
        <th style="width:20%;">Comments</th>
        <th style="width:16%;">Authorized Person</th>
        <th style="width:17%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${section2Rows || `<tr><td colspan="6" style="text-align:center;color:#999;">No departmental sections</td></tr>`}
    </tbody>
  </table>

  <!-- ===== SECTION 3: HR & OD CLEARANCES ===== -->
  ${hrSections.length ? `
  <div class="section-heading">Section 3 &mdash; HR &amp; OD Clearances</div>
  <table>
    <thead>
      <tr>
        <th style="width:16%;">Section</th>
        <th style="width:22%;">Item / Description</th>
        <th style="width:7%;text-align:center;">Result</th>
        <th style="width:18%;">Comments</th>
        <th style="width:18%;">Authorized Person</th>
        <th style="width:19%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${hrRows}
    </tbody>
  </table>` : ''}

  <!-- ===== SECTION 4: FINANCE CLEARANCE ===== -->
  ${(finSections.length || financeEntries.length) ? `
  <div class="section-heading">Section 4 &mdash; Finance Clearance</div>
  ${finSectionItemRows ? `
  <table>
    <thead>
      <tr>
        <th style="width:16%;">Section</th>
        <th style="width:22%;">Item / Description</th>
        <th style="width:7%;text-align:center;">Result</th>
        <th style="width:18%;">Comments</th>
        <th style="width:18%;">Authorized Person</th>
        <th style="width:19%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>${finSectionItemRows}</tbody>
  </table>` : ''}
  ${financeGroupBlocks ? `
  <table>
    <thead>
      <tr>
        <th style="width:14%;">GL Account</th>
        <th style="width:40%;">Particulars</th>
        <th style="width:16%;text-align:right;">Amount PKR</th>
        <th style="width:30%;">Authorized / Date</th>
      </tr>
    </thead>
    <tbody>${financeGroupBlocks}</tbody>
  </table>` : ''}` : ''}

  <!-- ===== SECTION 5: PAYROLL SIGN-OFF ===== -->
  ${pmSection ? `
  <div class="section-heading">Section 5 &mdash; Payroll Sign-Off</div>
  <table>
    <tbody>
      <tr>
        <td class="label">Status</td>
        <td>${pmSection.status === 'APPROVED' ? '&#10003; Approved' : pmSection.status}</td>
        <td class="label">Payroll Manager</td>
        <td>${fmt(pmSection.approver_name)}</td>
      </tr>
      <tr>
        <td class="label">Decision Date</td>
        <td>${fmtDate(pmSection.decision_at)}</td>
        <td class="label">Note</td>
        <td>${fmt(pmSection.note)}</td>
      </tr>
    </tbody>
  </table>` : ''}

  <!-- ===== FOOTER ===== -->
  <div style="margin-top:30px;border-top:1px solid #ccc;padding-top:10px;">
    <p style="font-size:10px;color:#666;">
      This document is system-generated from the ${companyName} Employee Exit Clearance Portal.
      ${IS_TEST_SERVER ? '<strong style="color:#b91c1c;">(TEST / DEVELOPMENT DOCUMENT &mdash; NOT VALID FOR OFFICIAL USE)</strong>' : ''}
    </p>
    <p style="font-size:10px;color:#666;margin-top:2px;">
      Clearance ID: ${clearance.id} &nbsp;|&nbsp; Generated on: ${fmtDate(new Date().toISOString())}
    </p>
  </div>

</body>
</html>`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function generateClearancePDF(clearanceId: string): Promise<Buffer> {
  // 1. Fetch all clearance data
  const clearance = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    include: {
      employee: true,
      initiated_by_hrbp: true,
      clearance_sections: {
        include: {
          clearance_items: true,
        },
      },
    },
  })

  if (!clearance) {
    throw new Error(`Clearance not found: ${clearanceId}`)
  }

  const financeEntries = await prisma.financeEntry.findMany({
    where: { clearance_request_id: clearanceId },
    orderBy: { created_at: 'asc' },
  })

  // 2. Build HTML
  const html = buildHTML({
    clearance,
    employee: clearance.employee,
    hrbp: clearance.initiated_by_hrbp,
    sections: clearance.clearance_sections,
    financeEntries,
  })

  // 3. Launch Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '12mm',
        right: '12mm',
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:9px;color:#888;text-align:center;padding:0 12mm;">
          ${IS_TEST_SERVER ? '<strong style="color:#b91c1c;">TEST DOCUMENT</strong> &mdash; ' : ''}Packages Ltd. &mdash; Employee Exit Clearance Form
          &nbsp;|&nbsp;
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
