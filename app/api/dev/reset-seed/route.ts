import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * POST /api/dev/reset-seed
 *
 * Re-runs the database seed. Only available in development mode (NODE_ENV=development).
 * Clears all data and re-seeds the database with the standard development fixture data.
 */
export async function POST(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'This endpoint is only available in development mode.' },
      { status: 403 }
    )
  }

  const prisma = new PrismaClient()

  try {
    // -----------------------------------------------------------------------
    // 1. Clear tables in correct dependency order
    // -----------------------------------------------------------------------
    await prisma.activityLog.deleteMany({})
    await prisma.notification.deleteMany({})
    await prisma.financeEntry.deleteMany({})
    await prisma.clearanceItem.deleteMany({})
    await prisma.clearanceSection.deleteMany({})
    await prisma.clearanceRequest.deleteMany({})
    await prisma.user.deleteMany({})

    // -----------------------------------------------------------------------
    // 2. Hash the shared password
    // -----------------------------------------------------------------------
    const SALT_ROUNDS = 10
    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS)

    // -----------------------------------------------------------------------
    // 3. Create users — staff/approvers first, then employees
    // -----------------------------------------------------------------------
    await prisma.$transaction([
      prisma.user.create({ data: { id: 'user-u1', sf_employee_id: 'SF-1001', full_name: 'Ayesha Malik', email: 'ayesha.malik@company.com', password_hash: passwordHash, grade: 'M3', designation: 'HR Business Partner', department: 'Human Resources', division: 'People & Culture', company: 'Packages Ltd.', roles: ['HRBP'] } }),
      prisma.user.create({ data: { id: 'user-u2', sf_employee_id: 'SF-1002', full_name: 'Omar Farooq', email: 'omar.farooq@company.com', password_hash: passwordHash, grade: 'M2', designation: 'IT Manager', department: 'Information Technology', division: 'Technology', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_IT'] } }),
      prisma.user.create({ data: { id: 'user-u3', sf_employee_id: 'SF-1003', full_name: 'Sana Rehman', email: 'sana.rehman@company.com', password_hash: passwordHash, grade: 'M2', designation: 'IR Manager', department: 'Industrial Relations', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_IR'] } }),
      prisma.user.create({ data: { id: 'user-u4', sf_employee_id: 'SF-1004', full_name: 'Bilal Ahmed', email: 'bilal.ahmed@company.com', password_hash: passwordHash, grade: 'M2', designation: 'Supply Chain Manager', department: 'Supply Management', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_SUPPLY'] } }),
      prisma.user.create({ data: { id: 'user-u5', sf_employee_id: 'SF-1005', full_name: 'Nadia Khan', email: 'nadia.khan@company.com', password_hash: passwordHash, grade: 'M3', designation: 'ICS Head', department: 'Internal Customer Services', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_ICS'] } }),
      prisma.user.create({ data: { id: 'user-u6', sf_employee_id: 'SF-1006', full_name: 'Tariq Hassan', email: 'tariq.hassan@company.com', password_hash: passwordHash, grade: 'M2', designation: 'Security Manager', department: 'Security', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_SECURITY'] } }),
      prisma.user.create({ data: { id: 'user-u7', sf_employee_id: 'SF-1007', full_name: 'Farrukh Mirza', email: 'farrukh.mirza@company.com', password_hash: passwordHash, grade: 'M2', designation: 'Facilities Manager', department: 'Facilities', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_OTHER'] } }),
      prisma.user.create({ data: { id: 'user-u8', sf_employee_id: 'SF-1008', full_name: 'Zara Qureshi', email: 'zara.qureshi@company.com', password_hash: passwordHash, grade: 'M4', designation: 'Regional Sales Director', department: 'Sales', division: 'Commercial', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_HEAD'] } }),
      prisma.user.create({ data: { id: 'user-u9', sf_employee_id: 'SF-1009', full_name: 'Imran Sheikh', email: 'imran.sheikh@company.com', password_hash: passwordHash, grade: 'M2', designation: 'OD Manager', department: 'Organizational Development', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_OD'] } }),
      prisma.user.create({ data: { id: 'user-u10', sf_employee_id: 'SF-1010', full_name: 'Rabia Siddiqui', email: 'rabia.siddiqui@company.com', password_hash: passwordHash, grade: 'M3', designation: 'Manager HR Operations', department: 'Human Resources', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_HR'] } }),
      prisma.user.create({ data: { id: 'user-u11', sf_employee_id: 'SF-1011', full_name: 'Kamran Baig', email: 'kamran.baig@company.com', password_hash: passwordHash, grade: 'M4', designation: 'Financial Controller', department: 'Finance', division: 'Finance & Accounts', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_FINANCE'] } }),
      prisma.user.create({ data: { id: 'user-u12', sf_employee_id: 'SF-1012', full_name: 'Hassan Raza', email: 'hassan.raza@company.com', password_hash: passwordHash, grade: 'M1', designation: 'System Administrator', department: 'Human Resources', division: 'People & Culture', company: 'Packages Ltd.', roles: ['SUPER_ADMIN'] } }),
    ])

    await prisma.$transaction([
      prisma.user.create({ data: { id: 'user-u13', sf_employee_id: 'SF-2001', full_name: 'Ali Raza', email: 'ali.raza@company.com', password_hash: passwordHash, grade: 'G3', designation: 'Senior Sales Executive', department: 'Sales', division: 'Commercial', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_id: 'user-u1', line_manager_id: 'user-u8' } }),
      prisma.user.create({ data: { id: 'user-u14', sf_employee_id: 'SF-2002', full_name: 'Mehwish Tariq', email: 'mehwish.tariq@company.com', password_hash: passwordHash, grade: 'G3', designation: 'Software Engineer', department: 'Information Technology', division: 'Technology', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_id: 'user-u1', line_manager_id: 'user-u2' } }),
      prisma.user.create({ data: { id: 'user-u15', sf_employee_id: 'SF-2003', full_name: 'Usman Ghani', email: 'usman.ghani@company.com', password_hash: passwordHash, grade: 'G3', designation: 'Finance Analyst', department: 'Finance', division: 'Finance & Accounts', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_id: 'user-u1', line_manager_id: 'user-u11' } }),
      prisma.user.create({ data: { id: 'user-u16', sf_employee_id: 'SF-2004', full_name: 'Hamid Siddiqui', email: 'hamid.siddiqui@company.com', password_hash: passwordHash, grade: 'G3', designation: 'Network Engineer', department: 'Information Technology', division: 'Technology', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_id: 'user-u1', line_manager_id: 'user-u2' } }),
    ])

    // -----------------------------------------------------------------------
    // 4. CLR-2024-001
    // -----------------------------------------------------------------------
    await prisma.clearanceRequest.create({
      data: {
        id: 'clr-001', employee_id: 'user-u13', initiated_by_hrbp_id: 'user-u1', status: 'IN_PROGRESS',
        date_of_leaving: new Date('2024-02-15'), issued_by: 'user-u1',
        issuance_date: new Date('2024-01-20'), receiving_date: new Date('2024-01-20'),
        clearance_sections: {
          create: [
            { section_key: 'SECTION_1_HR_ISSUE', status: 'APPROVED', approver_id: 'user-u1', approver_name: 'Ayesha Malik', decision_at: new Date('2024-01-20'), note: 'HR issuance section completed by HRBP.' },
            { section_key: 'IR_DEPT', status: 'APPROVED', approver_id: 'user-u3', approver_name: 'Sana Rehman', decision_at: new Date('2024-01-22'), note: 'All items verified and cleared. Social security card collected.', clearance_items: { create: [{ item_key: 'social_security_card', description: 'Social Security Card', status: 'APPROVED', comments: 'Card collected and filed' }, { item_key: 'fair_price_shop', description: 'Fair Price Shop', status: 'NA', comments: 'N/A - not applicable' }, { item_key: 'uniform_locker', description: 'Uniform & Locker', status: 'APPROVED', comments: 'Locker cleared, uniform returned' }] } },
            { section_key: 'IT_DEPT', status: 'APPROVED', approver_id: 'user-u2', approver_name: 'Omar Farooq', decision_at: new Date('2024-01-23'), note: 'Laptop wiped, accounts deactivated.', clearance_items: { create: [{ item_key: 'laptop_data_clearance', description: 'Laptop/Desktop Data Clearance', status: 'APPROVED', comments: 'HP laptop wiped - serial WX23445' }, { item_key: 'email_sap_deactivation', description: 'Email & SAP User Account Deactivation', status: 'APPROVED', comments: 'Both accounts deactivated' }, { item_key: 'it_other', description: 'Other', status: 'NA', comments: 'N/A' }] } },
            { section_key: 'SUPPLY_MGMT', status: 'PENDING', clearance_items: { create: [{ item_key: 'central_stores', description: 'Central Stores', status: 'PENDING' }, { item_key: 'supply_other', description: 'Other', status: 'PENDING' }] } },
            { section_key: 'ICS_DEPT', status: 'PENDING', clearance_items: { create: [{ item_key: 'library', description: 'Library', status: 'PENDING' }, { item_key: 'workshop', description: 'Workshop', status: 'PENDING' }, { item_key: 'ics_other', description: 'Other', status: 'PENDING' }] } },
            { section_key: 'SECURITY', status: 'APPROVED', approver_id: 'user-u6', approver_name: 'Tariq Hassan', decision_at: new Date('2024-01-24'), note: 'Gate pass cancelled.', clearance_items: { create: [{ item_key: 'gate_office', description: 'Gate Office', status: 'APPROVED', comments: 'Gate access revoked' }, { item_key: 'security_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OTHER_FACILITIES', status: 'PENDING', clearance_items: { create: [{ item_key: 'telephone', description: 'Telephone', status: 'PENDING' }, { item_key: 'electrical', description: 'Electrical', status: 'PENDING' }] } },
            { section_key: 'DEPT_HEAD', status: 'PENDING', approver_id: 'user-u8', approver_name: 'Zara Qureshi', clearance_items: { create: [{ item_key: 'company_data_records', description: 'Company Data/Records', status: 'PENDING' }, { item_key: 'business_controller', description: 'Business Controller', status: 'PENDING' }, { item_key: 'dept_other', description: 'Other', status: 'PENDING' }] } },
            { section_key: 'OD_DEPT', status: 'PENDING' },
            { section_key: 'HR_DEPT', status: 'PENDING' },
            { section_key: 'FINANCE', status: 'PENDING' },
          ],
        },
      },
    })

    // -----------------------------------------------------------------------
    // 5. CLR-2024-002
    // -----------------------------------------------------------------------
    await prisma.clearanceRequest.create({
      data: {
        id: 'clr-002', employee_id: 'user-u14', initiated_by_hrbp_id: 'user-u1', status: 'PENDING_HRBP',
        date_of_leaving: new Date('2024-02-28'), issued_by: 'user-u1',
        issuance_date: new Date('2024-01-25'), receiving_date: new Date('2024-01-25'),
        clearance_sections: {
          create: [
            { section_key: 'SECTION_1_HR_ISSUE', status: 'APPROVED', approver_id: 'user-u1', approver_name: 'Ayesha Malik', decision_at: new Date('2024-01-25'), note: 'HR issuance section completed by HRBP.' },
            { section_key: 'IR_DEPT', status: 'APPROVED', approver_id: 'user-u3', approver_name: 'Sana Rehman', decision_at: new Date('2024-01-27'), note: 'All IR items verified and cleared.', clearance_items: { create: [{ item_key: 'social_security_card', description: 'Social Security Card', status: 'APPROVED' }, { item_key: 'fair_price_shop', description: 'Fair Price Shop', status: 'NA' }, { item_key: 'uniform_locker', description: 'Uniform & Locker', status: 'APPROVED' }] } },
            { section_key: 'IT_DEPT', status: 'DENIED', approver_id: 'user-u2', approver_name: 'Omar Farooq', decision_at: new Date('2024-01-28'), note: 'Laptop not yet returned. Employee has company laptop (Dell XPS, serial DX99812) and has not submitted it despite two reminders. Cannot clear until device is physically returned.', clearance_items: { create: [{ item_key: 'laptop_data_clearance', description: 'Laptop/Desktop Data Clearance', status: 'PENDING', comments: 'Laptop not returned - Dell XPS DX99812' }, { item_key: 'email_sap_deactivation', description: 'Email & SAP User Account Deactivation', status: 'APPROVED' }, { item_key: 'it_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SUPPLY_MGMT', status: 'APPROVED', approver_id: 'user-u4', approver_name: 'Bilal Ahmed', decision_at: new Date('2024-01-27'), note: 'Supply management cleared.', clearance_items: { create: [{ item_key: 'central_stores', description: 'Central Stores', status: 'APPROVED' }, { item_key: 'supply_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'ICS_DEPT', status: 'APPROVED', approver_id: 'user-u5', approver_name: 'Nadia Khan', decision_at: new Date('2024-01-27'), note: 'No ICS obligations.', clearance_items: { create: [{ item_key: 'library', description: 'Library', status: 'NA' }, { item_key: 'workshop', description: 'Workshop', status: 'NA' }, { item_key: 'ics_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SECURITY', status: 'APPROVED', approver_id: 'user-u6', approver_name: 'Tariq Hassan', decision_at: new Date('2024-01-27'), note: 'Gate pass cancelled.', clearance_items: { create: [{ item_key: 'gate_office', description: 'Gate Office', status: 'APPROVED' }, { item_key: 'security_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OTHER_FACILITIES', status: 'APPROVED', approver_id: 'user-u7', approver_name: 'Farrukh Mirza', decision_at: new Date('2024-01-27'), note: 'No facilities obligations.', clearance_items: { create: [{ item_key: 'telephone', description: 'Telephone', status: 'NA' }, { item_key: 'electrical', description: 'Electrical', status: 'NA' }] } },
            { section_key: 'DEPT_HEAD', status: 'APPROVED', approver_id: 'user-u8', approver_name: 'Zara Qureshi', decision_at: new Date('2024-01-28'), note: 'All department records accounted for.', clearance_items: { create: [{ item_key: 'company_data_records', description: 'Company Data/Records', status: 'APPROVED' }, { item_key: 'business_controller', description: 'Business Controller', status: 'NA' }, { item_key: 'dept_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OD_DEPT', status: 'PENDING' },
            { section_key: 'HR_DEPT', status: 'PENDING' },
            { section_key: 'FINANCE', status: 'PENDING' },
          ],
        },
      },
    })

    // -----------------------------------------------------------------------
    // 6. CLR-2024-003
    // -----------------------------------------------------------------------
    await prisma.clearanceRequest.create({
      data: {
        id: 'clr-003', employee_id: 'user-u15', initiated_by_hrbp_id: 'user-u1', status: 'IN_PROGRESS',
        date_of_leaving: new Date('2024-01-31'), issued_by: 'user-u1',
        issuance_date: new Date('2024-01-10'), receiving_date: new Date('2024-01-10'),
        clearance_sections: {
          create: [
            { section_key: 'SECTION_1_HR_ISSUE', status: 'APPROVED', approver_id: 'user-u1', approver_name: 'Ayesha Malik', decision_at: new Date('2024-01-10'), note: 'HR issuance section completed by HRBP.' },
            { section_key: 'IR_DEPT', status: 'APPROVED', approver_id: 'user-u3', approver_name: 'Sana Rehman', decision_at: new Date('2024-01-12'), note: 'IR clearance complete.', clearance_items: { create: [{ item_key: 'social_security_card', description: 'Social Security Card', status: 'APPROVED', comments: 'Card collected' }, { item_key: 'fair_price_shop', description: 'Fair Price Shop', status: 'NA' }, { item_key: 'uniform_locker', description: 'Uniform & Locker', status: 'APPROVED', comments: 'Locker cleared' }] } },
            { section_key: 'IT_DEPT', status: 'APPROVED', approver_id: 'user-u2', approver_name: 'Omar Farooq', decision_at: new Date('2024-01-12'), note: 'IT assets cleared.', clearance_items: { create: [{ item_key: 'laptop_data_clearance', description: 'Laptop/Desktop Data Clearance', status: 'APPROVED', comments: 'Laptop returned and wiped' }, { item_key: 'email_sap_deactivation', description: 'Email & SAP User Account Deactivation', status: 'APPROVED', comments: 'Accounts deactivated' }, { item_key: 'it_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SUPPLY_MGMT', status: 'APPROVED', approver_id: 'user-u4', approver_name: 'Bilal Ahmed', decision_at: new Date('2024-01-13'), note: 'No supply items outstanding.', clearance_items: { create: [{ item_key: 'central_stores', description: 'Central Stores', status: 'APPROVED' }, { item_key: 'supply_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'ICS_DEPT', status: 'APPROVED', approver_id: 'user-u5', approver_name: 'Nadia Khan', decision_at: new Date('2024-01-13'), note: 'ICS cleared.', clearance_items: { create: [{ item_key: 'library', description: 'Library', status: 'NA' }, { item_key: 'workshop', description: 'Workshop', status: 'NA' }, { item_key: 'ics_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SECURITY', status: 'APPROVED', approver_id: 'user-u6', approver_name: 'Tariq Hassan', decision_at: new Date('2024-01-13'), note: 'Security clearance done.', clearance_items: { create: [{ item_key: 'gate_office', description: 'Gate Office', status: 'APPROVED', comments: 'Gate access revoked' }, { item_key: 'security_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OTHER_FACILITIES', status: 'APPROVED', approver_id: 'user-u7', approver_name: 'Farrukh Mirza', decision_at: new Date('2024-01-14'), note: 'Facilities cleared.', clearance_items: { create: [{ item_key: 'telephone', description: 'Telephone', status: 'NA' }, { item_key: 'electrical', description: 'Electrical', status: 'NA' }] } },
            { section_key: 'DEPT_HEAD', status: 'APPROVED', approver_id: 'user-u11', approver_name: 'Kamran Baig', decision_at: new Date('2024-01-15'), note: 'Department head cleared.', clearance_items: { create: [{ item_key: 'company_data_records', description: 'Company Data/Records', status: 'APPROVED' }, { item_key: 'business_controller', description: 'Business Controller', status: 'APPROVED' }, { item_key: 'dept_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OD_DEPT', status: 'APPROVED', approver_id: 'user-u9', approver_name: 'Imran Sheikh', decision_at: new Date('2024-01-16'), note: 'No training bond. All OD obligations cleared.', clearance_items: { create: [{ item_key: 'training_bond', description: 'Training Bond', status: 'NA', comments: 'No training bond applicable' }, { item_key: 'od_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'HR_DEPT', status: 'PENDING', approver_id: 'user-u10', approver_name: 'Rabia Siddiqui', clearance_items: { create: [{ item_key: 'employee_id_access_card', description: 'Employee ID / Access Card', status: 'PENDING' }, { item_key: 'health_insurance_card', description: 'Health Insurance Card', status: 'PENDING' }, { item_key: 'sim', description: 'SIM', status: 'PENDING' }, { item_key: 'cell_phone', description: 'Cell Phone', status: 'PENDING' }, { item_key: 'laptop', description: 'Laptop', status: 'PENDING' }, { item_key: 'vehicle_bike', description: 'Vehicle / Bike', status: 'PENDING' }, { item_key: 'fuel_card', description: 'Fuel Card', status: 'PENDING' }, { item_key: 'project_buraq', description: 'Project Buraq', status: 'PENDING' }, { item_key: 'hr_other', description: 'Other', status: 'PENDING' }] } },
            { section_key: 'FINANCE', status: 'PENDING', approver_id: 'user-u11', approver_name: 'Kamran Baig' },
          ],
        },
      },
    })

    await prisma.financeEntry.createMany({
      data: [
        { clearance_request_id: 'clr-003', section_group: 'PAYABLES', gl_account: '371001', particulars: 'Vendor/Imprest (Also create vendor if does not exist)', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYABLES', gl_account: '856007', particulars: 'Packages Ltd.', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '417099', particulars: 'Company Car/Bike Loan', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: null, particulars: 'Transfer of Vehicle Ownership', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Laptop', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Personal Entitlements', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '642003', particulars: 'Fair Price Shop', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: '642006', particulars: 'Travelling Advance', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: '642012', particulars: 'Other Advances', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: null, particulars: 'Fuel Adjustment', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: null, particulars: 'Any Unpaid Voucher', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '521002', particulars: 'Cycle Loan', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642001', particulars: 'Salary/HR Advance', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642004', particulars: 'Eid Advance', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642005', particulars: 'Christmas Advance', amount_pkr: null },
        { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642009', particulars: 'Other Advances', amount_pkr: null },
      ],
    })

    // -----------------------------------------------------------------------
    // 7. CLR-2023-047
    // -----------------------------------------------------------------------
    await prisma.clearanceRequest.create({
      data: {
        id: 'clr-047', employee_id: 'user-u16', initiated_by_hrbp_id: 'user-u1', status: 'COMPLETED',
        pdf_generated: true, pdf_generated_at: new Date('2023-12-30'),
        date_of_leaving: new Date('2023-12-31'), issued_by: 'user-u1',
        issuance_date: new Date('2023-12-15'), receiving_date: new Date('2023-12-15'),
        clearance_sections: {
          create: [
            { section_key: 'SECTION_1_HR_ISSUE', status: 'APPROVED', approver_id: 'user-u1', approver_name: 'Ayesha Malik', decision_at: new Date('2023-12-15'), note: 'HR issuance section completed by HRBP.' },
            { section_key: 'IR_DEPT', status: 'APPROVED', approver_id: 'user-u3', approver_name: 'Sana Rehman', decision_at: new Date('2023-12-16'), note: 'IR cleared.', clearance_items: { create: [{ item_key: 'social_security_card', description: 'Social Security Card', status: 'APPROVED', comments: 'Card collected' }, { item_key: 'fair_price_shop', description: 'Fair Price Shop', status: 'NA' }, { item_key: 'uniform_locker', description: 'Uniform & Locker', status: 'APPROVED', comments: 'Locker cleared, uniform returned' }] } },
            { section_key: 'IT_DEPT', status: 'APPROVED', approver_id: 'user-u2', approver_name: 'Omar Farooq', decision_at: new Date('2023-12-17'), note: 'IT assets cleared.', clearance_items: { create: [{ item_key: 'laptop_data_clearance', description: 'Laptop/Desktop Data Clearance', status: 'APPROVED', comments: 'Laptop wiped and returned' }, { item_key: 'email_sap_deactivation', description: 'Email & SAP User Account Deactivation', status: 'APPROVED', comments: 'All accounts deactivated' }, { item_key: 'it_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SUPPLY_MGMT', status: 'APPROVED', approver_id: 'user-u4', approver_name: 'Bilal Ahmed', decision_at: new Date('2023-12-18'), note: 'Supply cleared.', clearance_items: { create: [{ item_key: 'central_stores', description: 'Central Stores', status: 'APPROVED' }, { item_key: 'supply_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'ICS_DEPT', status: 'APPROVED', approver_id: 'user-u5', approver_name: 'Nadia Khan', decision_at: new Date('2023-12-18'), note: 'ICS cleared.', clearance_items: { create: [{ item_key: 'library', description: 'Library', status: 'NA' }, { item_key: 'workshop', description: 'Workshop', status: 'NA' }, { item_key: 'ics_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'SECURITY', status: 'APPROVED', approver_id: 'user-u6', approver_name: 'Tariq Hassan', decision_at: new Date('2023-12-19'), note: 'Gate pass cancelled.', clearance_items: { create: [{ item_key: 'gate_office', description: 'Gate Office', status: 'APPROVED', comments: 'Gate access revoked' }, { item_key: 'security_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OTHER_FACILITIES', status: 'APPROVED', approver_id: 'user-u7', approver_name: 'Farrukh Mirza', decision_at: new Date('2023-12-20'), note: 'Facilities cleared.', clearance_items: { create: [{ item_key: 'telephone', description: 'Telephone', status: 'NA' }, { item_key: 'electrical', description: 'Electrical', status: 'NA' }] } },
            { section_key: 'DEPT_HEAD', status: 'APPROVED', approver_id: 'user-u2', approver_name: 'Omar Farooq', decision_at: new Date('2023-12-21'), note: 'Department head clearance complete.', clearance_items: { create: [{ item_key: 'company_data_records', description: 'Company Data/Records', status: 'APPROVED' }, { item_key: 'business_controller', description: 'Business Controller', status: 'NA' }, { item_key: 'dept_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'OD_DEPT', status: 'APPROVED', approver_id: 'user-u9', approver_name: 'Imran Sheikh', decision_at: new Date('2023-12-22'), note: 'No training bond. OD cleared.', clearance_items: { create: [{ item_key: 'training_bond', description: 'Training Bond', status: 'NA', comments: 'No training bond applicable' }, { item_key: 'od_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'HR_DEPT', status: 'APPROVED', approver_id: 'user-u10', approver_name: 'Rabia Siddiqui', decision_at: new Date('2023-12-27'), note: 'All HR assets collected.', clearance_items: { create: [{ item_key: 'employee_id_access_card', description: 'Employee ID / Access Card', status: 'APPROVED', comments: 'Card collected' }, { item_key: 'health_insurance_card', description: 'Health Insurance Card', status: 'APPROVED', comments: 'Card cancelled and collected' }, { item_key: 'sim', description: 'SIM', status: 'APPROVED', comments: 'SIM returned' }, { item_key: 'cell_phone', description: 'Cell Phone', status: 'NA' }, { item_key: 'laptop', description: 'Laptop', status: 'APPROVED', comments: 'Laptop returned' }, { item_key: 'vehicle_bike', description: 'Vehicle / Bike', status: 'NA' }, { item_key: 'fuel_card', description: 'Fuel Card', status: 'NA' }, { item_key: 'project_buraq', description: 'Project Buraq', status: 'NA' }, { item_key: 'hr_other', description: 'Other', status: 'NA' }] } },
            { section_key: 'FINANCE', status: 'APPROVED', approver_id: 'user-u11', approver_name: 'Kamran Baig', decision_at: new Date('2023-12-29'), note: 'All financial obligations settled.' },
          ],
        },
      },
    })

    await prisma.financeEntry.createMany({
      data: [
        { clearance_request_id: 'clr-047', section_group: 'PAYABLES', gl_account: '371001', particulars: 'Vendor/Imprest (Also create vendor if does not exist)', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'PAYABLES', gl_account: '856007', particulars: 'Packages Ltd.', amount_pkr: 2500 },
        { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '417099', particulars: 'Company Car/Bike Loan', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: null, particulars: 'Transfer of Vehicle Ownership', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Laptop', amount_pkr: 85000 },
        { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Personal Entitlements', amount_pkr: 12000 },
        { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '642003', particulars: 'Fair Price Shop', amount_pkr: 3200 },
        { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: '642006', particulars: 'Travelling Advance', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: '642012', particulars: 'Other Advances', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: null, particulars: 'Fuel Adjustment', amount_pkr: 4500 },
        { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: null, particulars: 'Any Unpaid Voucher', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '521002', particulars: 'Cycle Loan', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642001', particulars: 'Salary/HR Advance', amount_pkr: 15000 },
        { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642004', particulars: 'Eid Advance', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642005', particulars: 'Christmas Advance', amount_pkr: 0 },
        { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642009', particulars: 'Other Advances', amount_pkr: 0 },
      ],
    })

    // -----------------------------------------------------------------------
    // 8. Notifications
    // -----------------------------------------------------------------------
    await prisma.notification.createMany({
      data: [
        { recipient_id: 'user-u1', clearance_request_id: 'clr-002', type: 'DENIAL', message: 'IT Department has denied the clearance for Mehwish Tariq. Reason: Laptop not yet returned.', read: false, created_at: new Date('2024-01-28') },
        { recipient_id: 'user-u1', clearance_request_id: 'clr-002', type: 'APPROVAL', message: 'Supply Management has approved the clearance for Mehwish Tariq.', read: false, created_at: new Date('2024-01-27') },
        { recipient_id: 'user-u1', clearance_request_id: 'clr-003', type: 'APPROVAL', message: 'OD Department has approved Section 3 for Usman Ghani.', read: false, created_at: new Date('2024-01-16') },
        { recipient_id: 'user-u1', clearance_request_id: 'clr-047', type: 'COMPLETED', message: 'Clearance for Hamid Siddiqui has been fully completed. PDF is ready for download.', read: true, created_at: new Date('2023-12-30') },
        { recipient_id: 'user-u1', clearance_request_id: 'clr-003', type: 'SECTION3_UNLOCKED', message: 'All Section 2 departments have approved the clearance for Usman Ghani. Section 3 is now active.', read: true, created_at: new Date('2024-01-15') },
        { recipient_id: 'user-u2', clearance_request_id: 'clr-001', type: 'NEW_CLEARANCE', message: 'A new clearance has been initiated for Ali Raza. Your approval is required.', read: false, created_at: new Date('2024-01-20') },
        { recipient_id: 'user-u10', clearance_request_id: 'clr-003', type: 'SECTION3_UNLOCKED', message: 'Section 3 is now active for Usman Ghani. Please complete the HR asset collection.', read: false, created_at: new Date('2024-01-15') },
      ],
    })

    // -----------------------------------------------------------------------
    // 9. Activity logs
    // -----------------------------------------------------------------------
    await prisma.activityLog.createMany({
      data: [
        // CLR-2024-001
        { clearance_request_id: 'clr-001', actor_id: 'user-u1', action: 'CLEARANCE_INITIATED', details: 'Clearance request CLR-2024-001 initiated for Ali Raza (SF-2001) by Ayesha Malik. Date of leaving: 2024-02-15.', created_at: new Date('2024-01-20T09:00:00Z') },
        { clearance_request_id: 'clr-001', actor_id: 'user-u3', action: 'SECTION_APPROVED', details: 'IR Department approved by Sana Rehman. Social security card collected, locker cleared.', created_at: new Date('2024-01-22T10:30:00Z') },
        { clearance_request_id: 'clr-001', actor_id: 'user-u2', action: 'SECTION_APPROVED', details: 'IT Department approved by Omar Farooq. Laptop wiped (serial WX23445), accounts deactivated.', created_at: new Date('2024-01-23T11:00:00Z') },
        { clearance_request_id: 'clr-001', actor_id: 'user-u6', action: 'SECTION_APPROVED', details: 'Security Department approved by Tariq Hassan. Gate pass cancelled.', created_at: new Date('2024-01-24T09:45:00Z') },
        { clearance_request_id: 'clr-001', actor_id: 'user-u1', action: 'HRBP_NOTIFIED', details: 'Awaiting approvals from Supply Management, ICS, Other Facilities, and Department Head.', created_at: new Date('2024-01-24T10:00:00Z') },
        // CLR-2024-002
        { clearance_request_id: 'clr-002', actor_id: 'user-u1', action: 'CLEARANCE_INITIATED', details: 'Clearance request CLR-2024-002 initiated for Mehwish Tariq (SF-2002) by Ayesha Malik. Date of leaving: 2024-02-28.', created_at: new Date('2024-01-25T09:00:00Z') },
        { clearance_request_id: 'clr-002', actor_id: 'user-u3', action: 'SECTION_APPROVED', details: 'IR Department approved by Sana Rehman.', created_at: new Date('2024-01-27T10:00:00Z') },
        { clearance_request_id: 'clr-002', actor_id: 'user-u4', action: 'SECTION_APPROVED', details: 'Supply Management approved by Bilal Ahmed.', created_at: new Date('2024-01-27T10:30:00Z') },
        { clearance_request_id: 'clr-002', actor_id: 'user-u2', action: 'SECTION_DENIED', details: 'IT Department denied by Omar Farooq. Reason: Laptop not yet returned (Dell XPS, serial DX99812). Two reminders sent with no response.', created_at: new Date('2024-01-28T14:00:00Z') },
        { clearance_request_id: 'clr-002', actor_id: 'user-u1', action: 'HRBP_NOTIFIED', details: 'HRBP Ayesha Malik notified of IT denial. Clearance status set to PENDING_HRBP pending resolution.', created_at: new Date('2024-01-28T14:05:00Z') },
        // CLR-2024-003
        { clearance_request_id: 'clr-003', actor_id: 'user-u1', action: 'CLEARANCE_INITIATED', details: 'Clearance request CLR-2024-003 initiated for Usman Ghani (SF-2003) by Ayesha Malik. Date of leaving: 2024-01-31.', created_at: new Date('2024-01-10T09:00:00Z') },
        { clearance_request_id: 'clr-003', actor_id: 'user-u3', action: 'SECTION_APPROVED', details: 'IR Department approved by Sana Rehman.', created_at: new Date('2024-01-12T10:00:00Z') },
        { clearance_request_id: 'clr-003', actor_id: 'user-u8', action: 'SECTION_APPROVED', details: 'Department Head (Kamran Baig) approved all department records and business controller items.', created_at: new Date('2024-01-15T11:00:00Z') },
        { clearance_request_id: 'clr-003', actor_id: 'user-u1', action: 'SECTION3_UNLOCKED', details: 'All Section 2 departments have approved. Section 3 (OD, HR, Finance) is now active.', created_at: new Date('2024-01-15T11:05:00Z') },
        { clearance_request_id: 'clr-003', actor_id: 'user-u9', action: 'SECTION_APPROVED', details: 'OD Department approved by Imran Sheikh. No training bond applicable.', created_at: new Date('2024-01-16T09:00:00Z') },
        // CLR-2023-047
        { clearance_request_id: 'clr-047', actor_id: 'user-u1', action: 'CLEARANCE_INITIATED', details: 'Clearance request CLR-2023-047 initiated for Hamid Siddiqui (SF-2004) by Ayesha Malik. Date of leaving: 2023-12-31.', created_at: new Date('2023-12-15T09:00:00Z') },
        { clearance_request_id: 'clr-047', actor_id: 'user-u1', action: 'SECTION3_UNLOCKED', details: 'All Section 2 departments approved. Section 3 (OD, HR, Finance) unlocked.', created_at: new Date('2023-12-22T09:00:00Z') },
        { clearance_request_id: 'clr-047', actor_id: 'user-u11', action: 'SECTION_APPROVED', details: 'Finance section approved by Kamran Baig. All financial amounts verified and settled.', created_at: new Date('2023-12-29T14:00:00Z') },
        { clearance_request_id: 'clr-047', actor_id: 'user-u1', action: 'PDF_GENERATED', details: 'Clearance PDF generated for Hamid Siddiqui.', created_at: new Date('2023-12-30T10:00:00Z') },
        { clearance_request_id: 'clr-047', actor_id: 'user-u1', action: 'COMPLETION_EMAIL_SENT', details: 'Completion email sent to Hamid Siddiqui (hamid.siddiqui@company.com) and HR records updated.', created_at: new Date('2023-12-30T10:05:00Z') },
      ],
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Database reset and re-seeded successfully.',
        summary: {
          users: 16,
          clearanceRequests: 4,
          notifications: 7,
          activityLogs: 20,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[reset-seed] Seed failed:', error)
    return NextResponse.json(
      {
        error: 'Seed Failed',
        message: error instanceof Error ? error.message : 'An unknown error occurred during seeding.',
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
