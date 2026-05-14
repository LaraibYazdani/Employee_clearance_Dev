import { User } from '@/types'

/**
 * Format a date string/Date object to a PKT display string (dd MMM yyyy).
 */
export function formatDatePKT(date: string | Date): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  })
}

/**
 * Format relative time — e.g. "2 hours ago", "3 days ago".
 */
export function formatRelativeTime(date: string | Date): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return 'just now'
  if (diffSecs < 3600) {
    const mins = Math.floor(diffSecs / 60)
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  }
  if (diffSecs < 86400) {
    const hours = Math.floor(diffSecs / 3600)
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }
  if (diffSecs < 2592000) {
    const days = Math.floor(diffSecs / 86400)
    return `${days} day${days !== 1 ? 's' : ''} ago`
  }
  if (diffSecs < 31536000) {
    const months = Math.floor(diffSecs / 2592000)
    return `${months} month${months !== 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffSecs / 31536000)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

/**
 * Get user initials for avatar display (first + last name initials).
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Format a number as PKR currency string.
 */
export function formatPKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Check if a user has a specific portal role.
 */
export function hasRole(user: User, role: string): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(role)
}

/**
 * Check if a user has any of the given portal roles.
 */
export function hasAnyRole(user: User, roles: string[]): boolean {
  if (!Array.isArray(user?.roles)) return false
  return roles.some((r) => user.roles.includes(r))
}

/**
 * Map a user's roles to their section_key in the clearance workflow.
 * Returns the first matching key, or null if none found.
 */
export function getUserSectionKey(user: User): string | null {
  if (!user?.roles) return null
  const roleToSection: Record<string, string> = {
    DEPT_APPROVER_IR: 'IR_DEPT',
    DEPT_APPROVER_IT: 'IT_DEPT',
    DEPT_APPROVER_SUPPLY: 'SUPPLY_MGMT',
    DEPT_APPROVER_ICS: 'ICS_DEPT',
    DEPT_APPROVER_SECURITY: 'SECURITY',
    DEPT_APPROVER_OTHER: 'OTHER_FACILITIES',
    DEPT_APPROVER_HEAD: 'DEPT_HEAD',
    DEPT_APPROVER_OD: 'OD_DEPT',
    DEPT_APPROVER_HR: 'HR_DEPT',
    DEPT_APPROVER_FINANCE: 'FINANCE',
  }
  for (const role of user.roles) {
    if (roleToSection[role]) return roleToSection[role]
  }
  return null
}

/**
 * Get a human-readable label for a section key.
 */
export function getSectionLabel(sectionKey: string): string {
  const labels: Record<string, string> = {
    SECTION_1_HR_ISSUE: 'Section 1 — HR Issue',
    IR_DEPT: 'Industrial Relations',
    IT_DEPT: 'IT Department',
    SUPPLY_MGMT: 'Supply Management',
    ICS_DEPT: 'Internal Customer Services',
    SECURITY: 'Security',
    OTHER_FACILITIES: 'Other (Facilities)',
    DEPT_HEAD: 'Departmental Head',
    LINE_MANAGER: 'Department Head',
    OD_DEPT: 'Organizational Development',
    HR_DEPT: 'HR Department',
    FINANCE: 'Finance',
  }
  return labels[sectionKey] ?? sectionKey
}

/**
 * Calculate days remaining until a given date.
 * Returns negative for overdue.
 */
export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
