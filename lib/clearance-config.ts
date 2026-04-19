export const SECTION_KEYS = [
  'SECTION_1_HR_ISSUE', 'IR_DEPT', 'IT_DEPT', 'SUPPLY_MGMT',
  'ICS_DEPT', 'SECURITY', 'OTHER_FACILITIES', 'DEPT_HEAD',
  'OD_DEPT', 'HR_DEPT', 'FINANCE',
] as const

export const SECTION_2_KEYS = [
  'IR_DEPT', 'IT_DEPT', 'SUPPLY_MGMT', 'ICS_DEPT',
  'SECURITY', 'OTHER_FACILITIES', 'DEPT_HEAD',
] as const

export const SECTION_3_KEYS = ['OD_DEPT', 'HR_DEPT', 'FINANCE'] as const

export const SECTION_ROLE_MAP: Record<string, string> = {
  'IR_DEPT': 'DEPT_APPROVER_IR',
  'IT_DEPT': 'DEPT_APPROVER_IT',
  'SUPPLY_MGMT': 'DEPT_APPROVER_SUPPLY',
  'ICS_DEPT': 'DEPT_APPROVER_ICS',
  'SECURITY': 'DEPT_APPROVER_SECURITY',
  'OTHER_FACILITIES': 'DEPT_APPROVER_OTHER',
  'DEPT_HEAD': 'DEPT_APPROVER_HEAD',
  'OD_DEPT': 'DEPT_APPROVER_OD',
  'HR_DEPT': 'DEPT_APPROVER_HR',
  'FINANCE': 'DEPT_APPROVER_FINANCE',
}

export const SECTION_LABELS: Record<string, string> = {
  'SECTION_1_HR_ISSUE': 'Section 1 - HR Issue',
  'IR_DEPT': 'Industrial Relations Department',
  'IT_DEPT': 'IT Department',
  'SUPPLY_MGMT': 'Supply Management',
  'ICS_DEPT': 'Internal Customer Services',
  'SECURITY': 'Security',
  'OTHER_FACILITIES': 'Other (Facilities)',
  'DEPT_HEAD': 'Departmental Head',
  'OD_DEPT': 'Organizational Development',
  'HR_DEPT': 'HR Department',
  'FINANCE': 'Finance',
}

export const DEFAULT_SECTION_ITEMS: Record<string, Array<{ item_key: string; description: string }>> = {
  'IR_DEPT': [
    { item_key: 'social_security_card', description: 'Social Security Card' },
    { item_key: 'fair_price_shop', description: 'Fair Price Shop' },
    { item_key: 'uniform_locker', description: 'Other (Uniform & Locker)' },
  ],
  'IT_DEPT': [
    { item_key: 'laptop_data_clearance', description: 'Laptop/Desktop Data Clearance' },
    { item_key: 'email_sap_deactivation', description: 'Email & SAP User Account Deactivation' },
    { item_key: 'it_other', description: 'Other' },
  ],
  'SUPPLY_MGMT': [
    { item_key: 'central_stores', description: 'Central Stores' },
    { item_key: 'supply_other', description: 'Other' },
  ],
  'ICS_DEPT': [
    { item_key: 'library', description: 'Library' },
    { item_key: 'workshop', description: 'Workshop' },
    { item_key: 'ics_other', description: 'Other' },
  ],
  'SECURITY': [
    { item_key: 'gate_office', description: 'Gate Office' },
    { item_key: 'security_other', description: 'Other' },
  ],
  'OTHER_FACILITIES': [
    { item_key: 'telephone', description: 'Telephone' },
    { item_key: 'electrical', description: 'Electrical' },
  ],
  'DEPT_HEAD': [
    { item_key: 'company_data_records', description: 'Company Data/Records' },
    { item_key: 'business_controller', description: 'Business Controller' },
    { item_key: 'dept_other', description: 'Other' },
  ],
  'OD_DEPT': [
    { item_key: 'training_bond', description: 'Training Bond' },
    { item_key: 'od_other', description: 'Other' },
  ],
  'HR_DEPT': [
    { item_key: 'employee_id_access_card', description: 'Employee ID/Access Card' },
    { item_key: 'health_insurance_card', description: 'Health Insurance Card' },
    { item_key: 'sim', description: 'SIM (SIM Blocked + Email Attached)' },
    { item_key: 'cell_phone', description: 'Cell Phone' },
    { item_key: 'laptop', description: 'Laptop' },
    { item_key: 'vehicle_bike', description: 'Vehicle/Bike' },
    { item_key: 'fuel_card', description: 'Fuel Card (Received & Blocked)' },
    { item_key: 'project_buraq', description: 'Project Buraq Recovery (If Applicable)' },
    { item_key: 'hr_other', description: 'Other' },
  ],
  'FINANCE': [
    { item_key: 'section', description: 'Finance Approver' },
  ],
}

export const DEFAULT_FINANCE_ENTRIES = [
  { gl_account: '371001', particulars: 'Vendor/Imprest (Also create vendor if does not exist)', section_group: 'PAYABLES' },
  { gl_account: '856007', particulars: 'Packages Ltd.', section_group: 'PAYABLES' },
  { gl_account: '417099', particulars: 'Company Car/Bike Loan', section_group: 'INVENTORY' },
  { gl_account: null, particulars: 'Transfer of Vehicle Ownership', section_group: 'INVENTORY' },
  { gl_account: '415099', particulars: 'Laptop', section_group: 'INVENTORY' },
  { gl_account: '415099', particulars: 'Personal Entitlements', section_group: 'INVENTORY' },
  { gl_account: '642003', particulars: 'Fair Price Shop', section_group: 'INVENTORY' },
  { gl_account: '642006', particulars: 'Travelling Advance', section_group: 'ERS' },
  { gl_account: '642012', particulars: 'Other Advances', section_group: 'ERS' },
  { gl_account: null, particulars: 'Fuel Adjustment', section_group: 'ERS' },
  { gl_account: null, particulars: 'Any Unpaid Voucher', section_group: 'ERS' },
  { gl_account: '521002', particulars: 'Cycle Loan', section_group: 'PAYROLL_FUNDS' },
  { gl_account: '642001', particulars: 'Salary/HR Advance', section_group: 'PAYROLL_FUNDS' },
  { gl_account: '642004', particulars: 'Eid Advance', section_group: 'PAYROLL_FUNDS' },
  { gl_account: '642005', particulars: 'Christmas Advance', section_group: 'PAYROLL_FUNDS' },
  { gl_account: '642009', particulars: 'Other Advances', section_group: 'PAYROLL_FUNDS' },
]
