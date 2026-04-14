export interface User {
  id: string
  sf_employee_id: string
  full_name: string
  email: string
  grade?: string
  designation?: string
  department?: string
  division?: string
  company?: string
  roles: string[]
  hrbp_id?: string
  line_manager_id?: string
  created_at: string
  updated_at: string
}

export interface ClearanceRequest {
  id: string
  employee_id: string
  initiated_by_hrbp_id: string
  status: 'DRAFT' | 'IN_PROGRESS' | 'PENDING_HRBP' | 'COMPLETED' | 'CANCELLED'
  date_of_leaving?: string
  issued_by?: string
  issuance_date?: string
  receiving_date?: string
  laptop_buyback?: string | null
  vehicle_loan?: string | null
  sim_transfer?: string | null
  other_query?: string | null
  pdf_generated: boolean
  pdf_generated_at?: string
  created_at: string
  updated_at: string
  employee?: User
  hrbp?: User
  sections?: ClearanceSection[]
}

export interface ClearanceSection {
  id: string
  clearance_request_id: string
  section_key: string
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'LOCKED'
  approver_id?: string
  approver_name?: string
  decision_at?: string
  note?: string
  items?: ClearanceItem[]
}

export interface ClearanceItem {
  id: string
  clearance_section_id: string
  item_key: string
  description: string
  comments?: string
  status: 'PENDING' | 'NA' | 'APPROVED' | 'FLAGGED'
}

export interface FinanceEntry {
  id: string
  clearance_request_id: string
  gl_account?: string
  particulars: string
  amount_pkr?: number
  section_group: 'PAYABLES' | 'INVENTORY' | 'ERS' | 'PAYROLL_FUNDS'
}

export interface Notification {
  id: string
  recipient_id: string
  clearance_request_id: string
  type: string
  message: string
  read: boolean
  created_at: string
  clearance?: ClearanceRequest
}

export type PortalRole =
  | 'HRBP'
  | 'DEPT_APPROVER_IR'
  | 'DEPT_APPROVER_IT'
  | 'DEPT_APPROVER_SUPPLY'
  | 'DEPT_APPROVER_ICS'
  | 'DEPT_APPROVER_SECURITY'
  | 'DEPT_APPROVER_OTHER'
  | 'DEPT_APPROVER_HEAD'
  | 'DEPT_APPROVER_OD'
  | 'DEPT_APPROVER_HR'
  | 'DEPT_APPROVER_FINANCE'
  | 'EMPLOYEE'
  | 'SUPER_ADMIN'
