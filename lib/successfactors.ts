/**
 * SuccessFactors Integration Module
 *
 * In SF_MOCK_MODE=true, all functions operate against the mock user dataset.
 * In SF_MOCK_MODE=false, stub functions throw NotImplementedError for live API integration.
 */

export interface SFUser {
  sf_employee_id: string
  full_name: string
  email: string
  designation: string
  department: string
  grade: string
  division: string
  company: string
  roles: string[]
  hrbp_id?: string
  line_manager_id?: string
}

const MOCK_PASSWORD = 'password123'

const mockUsers: SFUser[] = [
  {
    sf_employee_id: 'SF-1001',
    full_name: 'Ayesha Malik',
    email: 'ayesha.malik@company.com',
    designation: 'HR Business Partner',
    department: 'Human Resources',
    grade: 'M3',
    division: 'People & Culture',
    company: 'Company',
    roles: ['HRBP'],
  },
  {
    sf_employee_id: 'SF-1002',
    full_name: 'Omar Farooq',
    email: 'omar.farooq@company.com',
    designation: 'IT Manager',
    department: 'Information Technology',
    grade: 'M2',
    division: 'Technology',
    company: 'Company',
    roles: ['DEPT_APPROVER_IT'],
  },
  {
    sf_employee_id: 'SF-1003',
    full_name: 'Sana Rehman',
    email: 'sana.rehman@company.com',
    designation: 'IR Manager',
    department: 'Industrial Relations',
    grade: 'M2',
    division: 'People & Culture',
    company: 'Company',
    roles: ['DEPT_APPROVER_IR'],
  },
  {
    sf_employee_id: 'SF-1004',
    full_name: 'Bilal Ahmed',
    email: 'bilal.ahmed@company.com',
    designation: 'Supply Chain Manager',
    department: 'Supply Management',
    grade: 'M2',
    division: 'Operations',
    company: 'Company',
    roles: ['DEPT_APPROVER_SUPPLY'],
  },
  {
    sf_employee_id: 'SF-1005',
    full_name: 'Nadia Khan',
    email: 'nadia.khan@company.com',
    designation: 'ICS Head',
    department: 'Internal Customer Services',
    grade: 'M3',
    division: 'Operations',
    company: 'Company',
    roles: ['DEPT_APPROVER_ICS'],
  },
  {
    sf_employee_id: 'SF-1006',
    full_name: 'Tariq Hassan',
    email: 'tariq.hassan@company.com',
    designation: 'Security Manager',
    department: 'Security',
    grade: 'M2',
    division: 'Operations',
    company: 'Company',
    roles: ['DEPT_APPROVER_SECURITY'],
  },
  {
    sf_employee_id: 'SF-1007',
    full_name: 'Farrukh Mirza',
    email: 'farrukh.mirza@company.com',
    designation: 'Facilities Manager',
    department: 'Facilities',
    grade: 'M2',
    division: 'Operations',
    company: 'Company',
    roles: ['DEPT_APPROVER_OTHER'],
  },
  {
    sf_employee_id: 'SF-1008',
    full_name: 'Zara Qureshi',
    email: 'zara.qureshi@company.com',
    designation: 'Regional Sales Director',
    department: 'Sales',
    grade: 'M4',
    division: 'Commercial',
    company: 'Company',
    roles: ['DEPT_APPROVER_HEAD'],
  },
  {
    sf_employee_id: 'SF-1009',
    full_name: 'Imran Sheikh',
    email: 'imran.sheikh@company.com',
    designation: 'OD Manager',
    department: 'Organizational Development',
    grade: 'M2',
    division: 'People & Culture',
    company: 'Company',
    roles: ['DEPT_APPROVER_OD'],
  },
  {
    sf_employee_id: 'SF-1010',
    full_name: 'Rabia Siddiqui',
    email: 'rabia.siddiqui@company.com',
    designation: 'Manager HR Operations',
    department: 'Human Resources',
    grade: 'M3',
    division: 'People & Culture',
    company: 'Company',
    roles: ['DEPT_APPROVER_HR'],
  },
  {
    sf_employee_id: 'SF-1011',
    full_name: 'Kamran Baig',
    email: 'kamran.baig@company.com',
    designation: 'Financial Controller',
    department: 'Finance',
    grade: 'M4',
    division: 'Finance & Accounts',
    company: 'Company',
    roles: ['DEPT_APPROVER_FINANCE'],
  },
  {
    sf_employee_id: 'SF-1012',
    full_name: 'Hassan Raza',
    email: 'hassan.raza@company.com',
    designation: 'System Administrator',
    department: 'Human Resources',
    grade: 'M1',
    division: 'People & Culture',
    company: 'Company',
    roles: ['SUPER_ADMIN'],
  },
  {
    sf_employee_id: 'SF-2001',
    full_name: 'Ali Raza',
    email: 'ali.raza@company.com',
    designation: 'Senior Sales Executive',
    department: 'Sales',
    grade: 'G3',
    division: 'Commercial',
    company: 'Company',
    roles: ['EMPLOYEE'],
    hrbp_id: 'SF-1001',
    line_manager_id: 'SF-1008',
  },
  {
    sf_employee_id: 'SF-2002',
    full_name: 'Mehwish Tariq',
    email: 'mehwish.tariq@company.com',
    designation: 'Software Engineer',
    department: 'Information Technology',
    grade: 'G3',
    division: 'Technology',
    company: 'Company',
    roles: ['EMPLOYEE'],
    hrbp_id: 'SF-1001',
    line_manager_id: 'SF-1002',
  },
  {
    sf_employee_id: 'SF-2003',
    full_name: 'Usman Ghani',
    email: 'usman.ghani@company.com',
    designation: 'Finance Analyst',
    department: 'Finance',
    grade: 'G3',
    division: 'Finance & Accounts',
    company: 'Company',
    roles: ['EMPLOYEE'],
    hrbp_id: 'SF-1001',
    line_manager_id: 'SF-1011',
  },
  {
    sf_employee_id: 'SF-2004',
    full_name: 'Hamid Siddiqui',
    email: 'hamid.siddiqui@company.com',
    designation: 'Network Engineer',
    department: 'Information Technology',
    grade: 'G3',
    division: 'Technology',
    company: 'Company',
    roles: ['EMPLOYEE'],
    hrbp_id: 'SF-1001',
    line_manager_id: 'SF-1002',
  },
]

/**
 * Simulates network delay for mock API calls.
 */
function mockDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 201) + 200 // 200–400ms
  return new Promise((resolve) => setTimeout(resolve, delay))
}

function isMockMode(): boolean {
  return process.env.SF_MOCK_MODE === 'true'
}

function throwNotImplemented(fnName: string): never {
  throw new Error(`NotImplementedError: ${fnName} is not implemented for live SuccessFactors API. Set SF_MOCK_MODE=true for development.`)
}

/**
 * Search employees by name or SF Employee ID (employees only — roles containing EMPLOYEE).
 */
export async function searchEmployees(query: string): Promise<SFUser[]> {
  if (!isMockMode()) throwNotImplemented('searchEmployees')

  await mockDelay()

  const q = query.toLowerCase().trim()
  return mockUsers.filter((u) => {
    const isEmployee = u.roles.includes('EMPLOYEE')
    const matchesQuery =
      u.full_name.toLowerCase().includes(q) ||
      u.sf_employee_id.toLowerCase().includes(q)
    return isEmployee && matchesQuery
  })
}

/**
 * Get full employee profile by SF Employee ID.
 */
export async function getEmployeeById(sfId: string): Promise<SFUser | null> {
  if (!isMockMode()) throwNotImplemented('getEmployeeById')

  await mockDelay()

  return mockUsers.find((u) => u.sf_employee_id === sfId) ?? null
}

/**
 * Get the HRBP assigned to an employee.
 */
export async function getHRBPForEmployee(sfId: string): Promise<SFUser | null> {
  if (!isMockMode()) throwNotImplemented('getHRBPForEmployee')

  await mockDelay()

  const employee = mockUsers.find((u) => u.sf_employee_id === sfId)
  if (!employee || !employee.hrbp_id) return null

  return mockUsers.find((u) => u.sf_employee_id === employee.hrbp_id) ?? null
}

/**
 * Get the line manager of an employee.
 */
export async function getLineManager(sfId: string): Promise<SFUser | null> {
  if (!isMockMode()) throwNotImplemented('getLineManager')

  await mockDelay()

  const employee = mockUsers.find((u) => u.sf_employee_id === sfId)
  if (!employee || !employee.line_manager_id) return null

  return mockUsers.find((u) => u.sf_employee_id === employee.line_manager_id) ?? null
}

/**
 * Get the roles array for a user.
 */
export async function getUserRoles(sfId: string): Promise<string[]> {
  if (!isMockMode()) throwNotImplemented('getUserRoles')

  await mockDelay()

  const user = mockUsers.find((u) => u.sf_employee_id === sfId)
  return user?.roles ?? []
}

/**
 * Authenticate a user by email and password.
 * In mock mode, all users share the password "password123".
 * Returns the SFUser on success, or null on failure.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<SFUser | null> {
  if (!isMockMode()) throwNotImplemented('authenticateUser')

  await mockDelay()

  if (password !== MOCK_PASSWORD) return null

  return mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

export { mockUsers }
