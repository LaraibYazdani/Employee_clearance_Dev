import puppeteer from 'puppeteer'
import { prisma } from './prisma'
import { SECTION_LABELS } from './clearance-config'

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

const SECTION_2_KEYS = [
  'IR_DEPT', 'IT_DEPT', 'SUPPLY_MGMT', 'ICS_DEPT',
  'SECURITY', 'OTHER_FACILITIES', 'DEPT_HEAD',
]

const OD_KEY = 'OD_DEPT'
const HR_KEY = 'HR_DEPT'
const FINANCE_KEY = 'FINANCE'

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

  const getSectionByKey = (key: string) => sections.find((s) => s.section_key === key)

  // ---- Section 2 rows ----
  const section2Rows = SECTION_2_KEYS.map((key) => {
    const sec = getSectionByKey(key)
    if (!sec) return ''
    const items = sec.clearance_items ?? []
    const itemRows = items
      .map(
        (item: any) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;color:#555;">&nbsp;</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? '&#10003;' : ''}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.comments ?? ''}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">&nbsp;</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">&nbsp;</td>
        </tr>`
      )
      .join('')

    const sig =
      sec.status === 'APPROVED' && sec.approver_name
        ? `${sec.approver_name}<br><span style="font-size:10px;color:#555;">${fmtDate(sec.decision_at)}</span>`
        : sec.status === 'DENIED'
        ? `<span style="color:red;">DENIED</span><br><span style="font-size:10px;">${sec.approver_name ?? ''}</span>`
        : ''

    return `
      <tr style="background:#f5f5f5;">
        <td colspan="6" style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:bold;">
          ${SECTION_LABELS[key] ?? key}
        </td>
      </tr>
      ${itemRows}
      <tr>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;" colspan="4">&nbsp;</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sec.approver_name ?? ''}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${sig}</td>
      </tr>`
  }).join('')

  // ---- OD Section ----
  const odSec = getSectionByKey(OD_KEY)
  const odRows = odSec
    ? (odSec.clearance_items ?? [])
        .map(
          (item: any) => `
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">
              ${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? '&#10003;' : '—'}
            </td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${odSec.approver_name ?? ''}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
              ${odSec.status === 'APPROVED' && odSec.approver_name
                ? `${odSec.approver_name} | ${fmtDate(odSec.decision_at)}`
                : ''}
            </td>
          </tr>`
        )
        .join('')
    : ''

  // ---- HR Assets Section ----
  const hrSec = getSectionByKey(HR_KEY)
  const hrRows = hrSec
    ? (hrSec.clearance_items ?? [])
        .map(
          (item: any) => `
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.description}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">
              ${item.status === 'NA' ? 'N/A' : item.status === 'APPROVED' ? 'Yes' : '—'}
            </td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${item.comments ?? ''}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">Manager HR Operations</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
              ${hrSec.status === 'APPROVED' && hrSec.approver_name
                ? `${hrSec.approver_name} | ${fmtDate(hrSec.decision_at)}`
                : ''}
            </td>
          </tr>`
        )
        .join('')
    : ''

  // ---- Finance Section ----
  const finSec = getSectionByKey(FINANCE_KEY)
  const financeGroupBlocks = GROUP_ORDER.map((groupKey) => {
    const groupEntries = financeEntries.filter((e: any) => e.section_group === groupKey)
    if (!groupEntries.length) return ''

    const total = groupEntries.reduce(
      (sum: number, e: any) => sum + (e.amount_pkr ?? 0),
      0
    )

    const entryRows = groupEntries
      .map(
        (e: any) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${e.gl_account ?? '—'}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">${e.particulars}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:right;">${fmtPKR(e.amount_pkr)}</td>
          <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
            ${finSec?.status === 'APPROVED' && finSec?.approver_name
              ? `${finSec.approver_name} | ${fmtDate(finSec.decision_at)}`
              : ''}
          </td>
        </tr>`
      )
      .join('')

    return `
      <tr style="background:#f0f0f0;">
        <td colspan="4" style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:bold;">
          ${GROUP_LABELS[groupKey]}
        </td>
      </tr>
      ${entryRows}
      <tr style="background:#fafafa;">
        <td colspan="2" style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold;text-align:right;">Total:</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold;text-align:right;">${fmtPKR(total)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;">
          ${finSec?.status === 'APPROVED' && finSec?.approver_name
            ? `Financial Controller/CFO: ${finSec.approver_name} | ${fmtDate(finSec.decision_at)}`
            : ''}
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Employee Exit Clearance Form</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #222;
      background: #fff;
      padding: 20px 24px;
    }
    h1 { font-size: 20px; font-weight: bold; color: #1a1a1a; }
    h2 { font-size: 14px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th {
      background: #e8e8e8;
      padding: 6px 8px;
      border: 1px solid #ccc;
      font-size: 11px;
      text-align: left;
      font-weight: bold;
      text-transform: uppercase;
    }
    td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; vertical-align: top; }
    .section-heading {
      font-size: 13px;
      font-weight: bold;
      margin: 18px 0 6px;
      padding-bottom: 3px;
      border-bottom: 2px solid #333;
      color: #111;
    }
    .label { font-weight: bold; white-space: nowrap; width: 160px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  <!-- ===== HEADER ===== -->
  <div style="text-align:center;margin-bottom:20px;border-bottom:3px double #333;padding-bottom:12px;">
    <h1 style="font-size:22px;font-weight:900;letter-spacing:0.08em;">Packages Ltd.</h1>
    <h2 style="font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">
      Employee Exit Clearance Form
    </h2>
    <p style="font-size:10px;color:#666;margin-top:4px;">
      Clearance ID: ${clearance.id}
      &nbsp;|&nbsp;
      Status: ${clearance.status}
      &nbsp;|&nbsp;
      Generated: ${fmtDate(new Date().toISOString())}
    </p>
  </div>

  <!-- ===== SECTION 1: EMPLOYEE DETAILS ===== -->
  <div class="section-heading">Section 1 &mdash; Employee Information</div>
  <table>
    <tbody>
      <tr>
        <td class="label">Issued By</td>
        <td>${fmt(clearance.issued_by)}</td>
        <td class="label">Employee #</td>
        <td>${fmt(employee?.sf_employee_id)}</td>
      </tr>
      <tr>
        <td class="label">Issuance Date</td>
        <td>${fmtDate(clearance.issuance_date)}</td>
        <td class="label">Employee Name</td>
        <td>${fmt(employee?.full_name)}</td>
      </tr>
      <tr>
        <td class="label">Receiving Date</td>
        <td>${fmtDate(clearance.receiving_date)}</td>
        <td class="label">Grade</td>
        <td>${fmt(employee?.grade)}</td>
      </tr>
      <tr>
        <td class="label">Date of Leaving</td>
        <td>${fmtDate(clearance.date_of_leaving)}</td>
        <td class="label">Designation</td>
        <td>${fmt(employee?.designation)}</td>
      </tr>
      <tr>
        <td class="label">HRBP</td>
        <td>${fmt(hrbp?.full_name)}</td>
        <td class="label">Department</td>
        <td>${fmt(employee?.department)}</td>
      </tr>
      <tr>
        <td class="label">Company</td>
        <td>${fmt(employee?.company)}</td>
        <td class="label">Division</td>
        <td>${fmt(employee?.division)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ===== SECTION 2: DEPARTMENTAL CLEARANCES ===== -->
  <div class="section-heading">Section 2 &mdash; Departmental Clearances</div>
  <table>
    <thead>
      <tr>
        <th style="width:18%;">Department</th>
        <th style="width:22%;">Item / Description</th>
        <th style="width:7%;text-align:center;">Result</th>
        <th style="width:20%;">Comments</th>
        <th style="width:16%;">Authorized Person</th>
        <th style="width:17%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${section2Rows}
    </tbody>
  </table>

  <!-- ===== SECTION 3A: OD DEPT ===== -->
  <div class="section-heading">Section 3A &mdash; Organizational Development</div>
  <table>
    <thead>
      <tr>
        <th style="width:35%;">Description</th>
        <th style="width:12%;text-align:center;">N/A or Result</th>
        <th style="width:25%;">Authorized Person</th>
        <th style="width:28%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${odRows || `<tr><td colspan="4" style="text-align:center;color:#999;">No OD items</td></tr>`}
    </tbody>
  </table>

  <!-- ===== SECTION 3B: HR ASSETS ===== -->
  <div class="section-heading">Section 3B &mdash; HR Assets &amp; Handover</div>
  <table>
    <thead>
      <tr>
        <th style="width:28%;">Item</th>
        <th style="width:12%;text-align:center;">Collected?</th>
        <th style="width:22%;">Comments</th>
        <th style="width:18%;">Authorized Person</th>
        <th style="width:20%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${hrRows || `<tr><td colspan="5" style="text-align:center;color:#999;">No HR asset items</td></tr>`}
    </tbody>
  </table>

  <!-- ===== SECTION 3C: FINANCE ===== -->
  <div class="section-heading">Section 3C &mdash; Finance Clearance</div>
  <table>
    <thead>
      <tr>
        <th style="width:14%;">GL Account</th>
        <th style="width:38%;">Particulars</th>
        <th style="width:18%;text-align:right;">Amount PKR</th>
        <th style="width:30%;">Signature / Date</th>
      </tr>
    </thead>
    <tbody>
      ${financeGroupBlocks || `<tr><td colspan="4" style="text-align:center;color:#999;">No finance entries</td></tr>`}
    </tbody>
  </table>

  <!-- ===== FOOTER ===== -->
  <div style="margin-top:30px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <p style="font-size:10px;color:#666;">
        This document is system-generated from the Packages Ltd. Employee Exit Clearance Portal.
      </p>
      <p style="font-size:10px;color:#666;">
        Clearance ID: ${clearance.id} &nbsp;|&nbsp; Generated on: ${fmtDate(new Date().toISOString())}
      </p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;color:#888;">Page 1 of 1</p>
    </div>
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
          Packages Ltd. &mdash; Employee Exit Clearance Form
          &nbsp;|&nbsp;
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
