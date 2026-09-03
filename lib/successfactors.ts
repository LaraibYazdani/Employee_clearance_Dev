/**
 * SAP SuccessFactors Integration
 * - SF_MOCK_MODE=true  → uses local mock data (dev/test)
 * - SF_MOCK_MODE=false → live SAML Bearer OAuth flow against api44.sapsf.com
 */

// ---------------------------------------------------------------------------
// Company code → display name map
// ---------------------------------------------------------------------------
export const COMPANY_CODE_MAP: Record<string, string> = {
  '1000': 'PL',
  '1100': 'PCL',
  '1200': 'BSPL',
  '1300': 'DIC',
  '1400': 'Tripack',
  '1500': 'StarchPack',
  '1600': 'PREL',
  '1700': 'OMYA',
  '5100': 'IGI General',
  '5200': 'IGI Life',
  '5300': 'IGI Finex',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SFUserProfile {
  userId: string
  displayName: string
  firstName: string
  lastName: string
  email: string
  title: string
  payGrade: string
  division: string
  department: string
  hireDate: string | null
  dateOfBirth: string | null
  emplStatus: string
  employmentType: string
  costCenter: string
  username: string
  companyCode?: string
  companyName?: string
}

export interface SFEmpJob {
  userId: string
  payGrade: string
  jobTitle: string
  localJobTitle: string
  businessUnit: string
  company: string
  costCenter: string
  managerId: string
  emplStatus: string
  companyEntryDate: string | null
}

// ---------------------------------------------------------------------------
// Token cache (in-memory)
// ---------------------------------------------------------------------------
let tokenCache: { token: string; expiresAt: number } | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function parseSFDate(sfDate: string | null | undefined): Date | null {
  if (!sfDate) return null
  const match = sfDate.match(/\/Date\((\d+)/)
  if (!match) return null
  return new Date(parseInt(match[1], 10))
}

function isMock(): boolean {
  return process.env.SF_MOCK_MODE === 'true'
}

const SF_BASE_URL = process.env.SF_BASE_URL ?? 'https://api44.sapsf.com'
const SF_COMPANY_ID = process.env.SF_COMPANY_ID ?? 'packagesli'
const SF_CLIENT_ID = process.env.SF_CLIENT_ID ?? ''
const SF_PRIVATE_KEY = process.env.SF_PRIVATE_KEY ?? ''
const SF_ECADMIN_USER_ID = process.env.SF_ECADMIN_USER_ID ?? 'ECAdmin'
const SF_API_USER = process.env.SF_API_USER ?? ''
const SF_API_PASS = process.env.SF_API_PASS ?? ''

/** Basic Auth credentials for the SF service account (used for data lookups) */
function getServiceAccountHeaders(): Record<string, string> {
  const credentials = Buffer.from(`${SF_API_USER}@${SF_COMPANY_ID}:${SF_API_PASS}`).toString('base64')
  return { Authorization: `Basic ${credentials}`, Accept: 'application/json' }
}

// ---------------------------------------------------------------------------
// LIVE: Token management
// ---------------------------------------------------------------------------
async function buildPemKey(): Promise<string> {
  // SF_PRIVATE_KEY is stored as base64(inner_base64_key + "###company_id")
  // Decode outer base64 → inner base64 key string + suffix
  const decoded = Buffer.from(SF_PRIVATE_KEY, 'base64').toString('utf8')
  const innerBase64 = decoded.includes('###') ? decoded.split('###')[0].trim() : decoded.trim()
  // Wrap with PKCS#8 PEM headers
  return `-----BEGIN PRIVATE KEY-----\n${innerBase64}\n-----END PRIVATE KEY-----`
}

async function generateSAMLAssertion(): Promise<string> {
  // SF_PRIVATE_KEY is sent as-is (raw value) — SF's /oauth/idp handles key parsing internally
  const params = new URLSearchParams()
  params.append('user_id', SF_ECADMIN_USER_ID)
  params.append('token_url', `${SF_BASE_URL}/oauth/token`)
  params.append('private_key', SF_PRIVATE_KEY)
  params.append('client_id', SF_CLIENT_ID)

  const res = await fetch(`${SF_BASE_URL}/oauth/idp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[SF] SAML generation failed (${res.status}): ${text}`)
  }

  return res.text()
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const samlXml = await generateSAMLAssertion()
  // /oauth/idp already returns a base64-encoded SAML assertion — send it as-is
  const params = new URLSearchParams()
  params.append('client_id', SF_CLIENT_ID)
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:saml2-bearer')
  params.append('company_id', SF_COMPANY_ID)
  params.append('assertion', samlXml)

  const res = await fetch(`${SF_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[SF] Token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }

  return tokenCache.token
}

async function sfGet(path: string): Promise<any> {
  const token = await getAccessToken()
  const res = await fetch(`${SF_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[SF] GET ${path} failed (${res.status}): ${text}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// LIVE: Data functions
// ---------------------------------------------------------------------------

/** Fetch profile using the service account credentials */
export async function getUserProfileWithBasicAuth(
  userId: string,
  _password: string
): Promise<SFUserProfile | null> {
  try {
    const url = `${SF_BASE_URL}/odata/v2/User?$filter=userId eq '${userId}'&$format=json`
    const res = await fetch(url, {
      headers: getServiceAccountHeaders(),
    })
    if (!res.ok) {
      console.error(`[SF] getUserProfileWithBasicAuth failed (${res.status})`)
      return null
    }
    const data = await res.json()
    const result = data?.d?.results?.[0]
    if (!result) return null
    return parseUserResult(result, userId)
  } catch (err) {
    console.error('[SF] getUserProfileWithBasicAuth error:', err)
    return null
  }
}

/** Fetch EmpJob using the service account credentials */
export async function getEmpJobWithBasicAuth(
  userId: string,
  _password: string
): Promise<SFEmpJob | null> {
  try {
    const url = `${SF_BASE_URL}/odata/v2/EmpJob?$filter=userId eq '${userId}'&$format=json&$select=userId,payGrade,jobTitle,localJobTitle,businessUnit,company,costCenter,managerId,emplStatus,companyEntryDate`
    const res = await fetch(url, {
      headers: getServiceAccountHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.d?.results?.[0]
    if (!result) return null
    return {
      userId: result.userId,
      payGrade: result.payGrade ?? '',
      jobTitle: result.jobTitle ?? '',
      localJobTitle: result.localJobTitle ?? '',
      businessUnit: result.businessUnit ?? '',
      company: result.company ?? '',
      costCenter: result.costCenter ?? '',
      managerId: result.managerId ?? '',
      emplStatus: result.emplStatus ?? '',
      companyEntryDate: result.companyEntryDate ?? null,
    }
  } catch (err) {
    console.error('[SF] getEmpJobWithBasicAuth error:', err)
    return null
  }
}

/** Fetch HRBP using the service account credentials */
export async function getHRBPWithBasicAuth(
  userId: string,
  _password: string
): Promise<{ hrbpId: string } | null> {
  try {
    const url = `${SF_BASE_URL}/odata/v2/EmpJobRelationships?$filter=userId eq '${userId}'&$format=json`
    const res = await fetch(url, {
      headers: getServiceAccountHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const results = data?.d?.results ?? []
    const hrbpRecord = results.find((r: any) => r.relationshipType === '18570')
    if (!hrbpRecord) return null
    return { hrbpId: hrbpRecord.relUserId }
  } catch (err) {
    console.error('[SF] getHRBPWithBasicAuth error:', err)
    return null
  }
}

function parseUserResult(result: any, userId: string): SFUserProfile {
  return {
    userId: result.userId,
    displayName: result.displayName ?? `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim(),
    firstName: result.firstName ?? '',
    lastName: result.lastName ?? '',
    email: result.email ?? `${userId}@packagesli.com`,
    title: result.title ?? '',
    payGrade: result.payGrade ?? '',
    division: result.division ?? '',
    department: result.department ?? '',
    hireDate: result.hireDate ?? null,
    dateOfBirth: result.dateOfBirth ?? null,
    emplStatus: result.emplStatus ?? '',
    employmentType: result.employmentType ?? '',
    costCenter: result.costCenter ?? '',
    username: result.username ?? userId,
  }
}

async function liveGetUserProfile(userId: string): Promise<SFUserProfile | null> {
  try {
    const data = await sfGet(
      `/odata/v2/User?$filter=userId eq '${userId}' and (status eq 'f' or status eq 't')&$format=json`
    )
    const result = data?.d?.results?.[0]
    if (!result) return null
    return parseUserResult(result, userId)
  } catch (err) {
    console.error('[SF] liveGetUserProfile error:', err)
    return null
  }
}

async function liveGetEmpJob(userId: string): Promise<SFEmpJob | null> {
  try {
    const data = await sfGet(
      `/odata/v2/EmpJob?$filter=userId eq '${userId}'&$format=json&$select=userId,payGrade,jobTitle,localJobTitle,businessUnit,company,costCenter,managerId,emplStatus,companyEntryDate`
    )
    const result = data?.d?.results?.[0]
    if (!result) return null
    return {
      userId: result.userId,
      payGrade: result.payGrade ?? '',
      jobTitle: result.jobTitle ?? '',
      localJobTitle: result.localJobTitle ?? '',
      businessUnit: result.businessUnit ?? '',
      company: result.company ?? '',
      costCenter: result.costCenter ?? '',
      managerId: result.managerId ?? '',
      emplStatus: result.emplStatus ?? '',
      companyEntryDate: result.companyEntryDate ?? null,
    }
  } catch (err) {
    console.error('[SF] liveGetEmpJob error:', err)
    return null
  }
}

async function liveGetHRBP(userId: string): Promise<{ hrbpId: string } | null> {
  const data = await sfGet(
    `/odata/v2/EmpJobRelationships?$filter=userId eq '${userId}'&$format=json`
  )
  const results = data?.d?.results ?? []
  const hrbpRecord = results.find((r: any) => r.relationshipType === '18570')
  if (!hrbpRecord) return null
  return { hrbpId: hrbpRecord.relUserId }
}

function mapSFUserResult(r: any): SFUserProfile {
  return {
    userId: r.userId,
    displayName: r.displayName,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    title: r.title,
    payGrade: r.payGrade,
    division: r.division,
    department: r.department,
    hireDate: null,
    dateOfBirth: null,
    emplStatus: r.emplStatus,
    employmentType: '',
    costCenter: '',
    username: r.userId,
  }
}

async function liveSearchEmployees(query: string): Promise<SFUserProfile[]> {
  const isNumericId = /^\d+$/.test(query.trim())
  const results: SFUserProfile[] = []
  const seen = new Set<string>()

  // For numeric queries: exact userId match (substringof on userId is not supported by SF OData)
  if (isNumericId) {
    try {
      const data = await sfGet(
        `/odata/v2/User?$filter=userId eq '${query.trim()}' and (status eq 'f' or status eq 't')&$format=json&$top=1&$select=userId,displayName,firstName,lastName,email,title,payGrade,division,department,emplStatus`
      )
      for (const r of data?.d?.results ?? []) {
        if (!seen.has(r.userId)) { seen.add(r.userId); results.push(mapSFUserResult(r)) }
      }
    } catch (err) {
      console.error('[SF] liveSearchEmployees (userId eq) error:', err)
    }
  }

  // Name search via substringof on displayName
  try {
    const encoded = encodeURIComponent(query)
    const data = await sfGet(
      `/odata/v2/User?$filter=substringof('${encoded}',displayName) and (status eq 'f' or status eq 't')&$format=json&$top=20&$select=userId,displayName,firstName,lastName,email,title,payGrade,division,department,emplStatus`
    )
    for (const r of data?.d?.results ?? []) {
      if (!seen.has(r.userId)) { seen.add(r.userId); results.push(mapSFUserResult(r)) }
    }
  } catch (err) {
    console.error('[SF] liveSearchEmployees (displayName) error:', err)
  }

  return results
}

// ---------------------------------------------------------------------------
// Live authentication via Basic Auth
// ---------------------------------------------------------------------------
export async function authenticateWithSF(userId: string, password: string): Promise<boolean> {
  try {
    const credentials = Buffer.from(`${userId}@${SF_COMPANY_ID}:${password}`).toString('base64')
    const res = await fetch(
      `${SF_BASE_URL}/odata/v2/Background_Community?$top=1&$format=json`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
      }
    )
    return res.status === 200
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Exported functions — dispatch to mock or live
// ---------------------------------------------------------------------------
export async function getUserProfile(userId: string): Promise<SFUserProfile | null> {
  if (isMock()) {
    await mockDelay()
    const u = MOCK_USERS.find((m) => m.sf_employee_id === userId || m.sf_employee_id === `SF-${userId}`)
    if (!u) return null
    return mockToProfile(u)
  }
  return liveGetUserProfile(userId)
}

export async function getEmpJob(userId: string): Promise<SFEmpJob | null> {
  if (isMock()) {
    await mockDelay()
    return {
      userId,
      payGrade: 'G3',
      jobTitle: 'Employee',
      localJobTitle: 'Employee',
      businessUnit: 'Operations',
      company: '1000',
      costCenter: 'CC001',
      managerId: '',
      emplStatus: '18203',
      companyEntryDate: null,
    }
  }
  return liveGetEmpJob(userId)
}

export async function getHRBP(userId: string): Promise<{ hrbpId: string } | null> {
  if (isMock()) {
    await mockDelay()
    const u = MOCK_USERS.find((m) => m.sf_employee_id === userId)
    if (!u?.hrbp_sf_id) return null
    return { hrbpId: u.hrbp_sf_id }
  }
  return liveGetHRBP(userId)
}

/**
 * Reverse HRBP lookup — returns true if the given SF user is an HRBP for any employee.
 * Used at login to auto-grant the HRBP portal role.
 */
export async function checkIsHRBP(sfEmployeeId: string): Promise<boolean> {
  if (isMock()) {
    await mockDelay()
    return MOCK_USERS.some((m) => m.hrbp_sf_id === sfEmployeeId)
  }
  try {
    const path = `/odata/v2/EmpJobRelationships?$filter=relUserId eq '${sfEmployeeId}' and relationshipType eq '18570'&$top=1&$format=json&$select=userId`
    const data = await sfGet(path)
    const results = data?.d?.results ?? []
    return results.length > 0
  } catch (err) {
    console.error('[SF] checkIsHRBP error:', err)
    return false
  }
}

export async function getLineManager(managerId: string): Promise<SFUserProfile | null> {
  if (isMock()) {
    await mockDelay()
    const u = MOCK_USERS.find((m) => m.sf_employee_id === managerId)
    if (!u) return null
    return mockToProfile(u)
  }
  return liveGetUserProfile(managerId)
}

export async function searchEmployees(query: string): Promise<SFUserProfile[]> {
  if (isMock()) {
    await mockDelay()
    const q = query.toLowerCase()
    return MOCK_USERS.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) || u.sf_employee_id.toLowerCase().includes(q)
    ).map(mockToProfile)
  }
  return liveSearchEmployees(query)
}

export async function getUserPhoto(userId: string): Promise<string | null> {
  if (isMock()) return null
  try {
    const data = await sfGet(`/odata/v2/Photo?$filter=userId eq '${userId}'&$format=json`)
    return data?.d?.results?.[0]?.photo ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Legacy mock authenticateUser (kept for backwards compat with mock mode)
// ---------------------------------------------------------------------------
export async function authenticateUser(
  email: string,
  password: string
): Promise<SFMockUser | null> {
  if (!isMock()) return null
  await mockDelay()
  const user = MOCK_USERS.find((u) => u.email === email)
  if (!user || password !== MOCK_PASSWORD) return null
  return user
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_PASSWORD = 'password123'

export interface SFMockUser {
  sf_employee_id: string
  full_name: string
  email: string
  designation: string
  department: string
  grade: string
  division: string
  company: string
  roles: string[]
  hrbp_sf_id?: string
  line_manager_sf_id?: string
}

const MOCK_USERS: SFMockUser[] = [
  { sf_employee_id: 'SF-1001', full_name: 'Ayesha Malik', email: 'ayesha.malik@company.com', designation: 'HR Business Partner', department: 'Human Resources', grade: 'M3', division: 'People & Culture', company: 'Packages Ltd.', roles: ['HRBP'] },
  { sf_employee_id: 'SF-1002', full_name: 'Omar Farooq', email: 'omar.farooq@company.com', designation: 'IT Manager', department: 'Information Technology', grade: 'M2', division: 'Technology', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_IT'] },
  { sf_employee_id: 'SF-1003', full_name: 'Sana Rehman', email: 'sana.rehman@company.com', designation: 'IR Manager', department: 'Industrial Relations', grade: 'M2', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_IR'] },
  { sf_employee_id: 'SF-1004', full_name: 'Bilal Ahmed', email: 'bilal.ahmed@company.com', designation: 'Supply Chain Manager', department: 'Supply Management', grade: 'M2', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_SUPPLY'] },
  { sf_employee_id: 'SF-1005', full_name: 'Nadia Khan', email: 'nadia.khan@company.com', designation: 'ICS Head', department: 'Internal Customer Services', grade: 'M3', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_ICS'] },
  { sf_employee_id: 'SF-1006', full_name: 'Tariq Hassan', email: 'tariq.hassan@company.com', designation: 'Security Manager', department: 'Security', grade: 'M2', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_SECURITY'] },
  { sf_employee_id: 'SF-1007', full_name: 'Farrukh Mirza', email: 'farrukh.mirza@company.com', designation: 'Facilities Manager', department: 'Facilities', grade: 'M2', division: 'Operations', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_OTHER'] },
  { sf_employee_id: 'SF-1008', full_name: 'Zara Qureshi', email: 'zara.qureshi@company.com', designation: 'Regional Sales Director', department: 'Sales', grade: 'M4', division: 'Commercial', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_HEAD'] },
  { sf_employee_id: 'SF-1009', full_name: 'Imran Sheikh', email: 'imran.sheikh@company.com', designation: 'OD Manager', department: 'Organizational Development', grade: 'M2', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_OD'] },
  { sf_employee_id: 'SF-1010', full_name: 'Rabia Siddiqui', email: 'rabia.siddiqui@company.com', designation: 'Manager HR Operations', department: 'Human Resources', grade: 'M3', division: 'People & Culture', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_HR'] },
  { sf_employee_id: 'SF-1011', full_name: 'Kamran Baig', email: 'kamran.baig@company.com', designation: 'Financial Controller', department: 'Finance', grade: 'M4', division: 'Finance & Accounts', company: 'Packages Ltd.', roles: ['DEPT_APPROVER_FINANCE'] },
  { sf_employee_id: 'SF-1012', full_name: 'Hassan Raza', email: 'hassan.raza@company.com', designation: 'System Administrator', department: 'Human Resources', grade: 'M1', division: 'People & Culture', company: 'Packages Ltd.', roles: ['SUPER_ADMIN'] },
  { sf_employee_id: 'SF-2001', full_name: 'Ali Raza', email: 'ali.raza@company.com', designation: 'Senior Sales Executive', department: 'Sales', grade: 'G3', division: 'Commercial', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_sf_id: 'SF-1001', line_manager_sf_id: 'SF-1008' },
  { sf_employee_id: 'SF-2002', full_name: 'Mehwish Tariq', email: 'mehwish.tariq@company.com', designation: 'Software Engineer', department: 'Information Technology', grade: 'G3', division: 'Technology', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_sf_id: 'SF-1001', line_manager_sf_id: 'SF-1002' },
  { sf_employee_id: 'SF-2003', full_name: 'Usman Ghani', email: 'usman.ghani@company.com', designation: 'Finance Analyst', department: 'Finance', grade: 'G3', division: 'Finance & Accounts', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_sf_id: 'SF-1001', line_manager_sf_id: 'SF-1011' },
  { sf_employee_id: 'SF-2004', full_name: 'Hamid Siddiqui', email: 'hamid.siddiqui@company.com', designation: 'Network Engineer', department: 'Information Technology', grade: 'G3', division: 'Technology', company: 'Packages Ltd.', roles: ['EMPLOYEE'], hrbp_sf_id: 'SF-1001', line_manager_sf_id: 'SF-1002' },
]

function mockDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 200 + Math.random() * 200))
}

function mockToProfile(u: SFMockUser): SFUserProfile {
  return {
    userId: u.sf_employee_id,
    displayName: u.full_name,
    firstName: u.full_name.split(' ')[0],
    lastName: u.full_name.split(' ').slice(1).join(' '),
    email: u.email,
    title: u.designation,
    payGrade: u.grade,
    division: u.division,
    department: u.department,
    hireDate: null,
    dateOfBirth: null,
    emplStatus: '18203',
    employmentType: 'Regular',
    costCenter: 'CC001',
    username: u.sf_employee_id,
    companyCode: '1000',
    companyName: u.company,
  }
}
