'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Card from '@/components/ui/Card'

const ROLE_LABELS: Record<string, string> = {
  HRBP: 'HRBP',
  DEPT_APPROVER_IR: 'IR Dept Approver',
  DEPT_APPROVER_IT: 'IT Dept Approver',
  DEPT_APPROVER_SUPPLY: 'Supply Mgmt Approver',
  DEPT_APPROVER_ICS: 'ICS Dept Approver',
  DEPT_APPROVER_SECURITY: 'Security Approver',
  DEPT_APPROVER_OTHER: 'Other Facilities Approver',
  DEPT_APPROVER_HEAD: 'Departmental Head Approver',
  DEPT_APPROVER_OD: 'OD Dept Approver',
  DEPT_APPROVER_HR: 'HR Dept Approver',
  DEPT_APPROVER_FINANCE: 'Finance Approver',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Administrator',
}

function ProfileField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
      <dt className="text-sm text-gray-500 w-44 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">
        {value || <span className="text-gray-400 italic">Not set</span>}
      </dd>
    </div>
  )
}

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg
          className="animate-spin h-8 w-8 text-indigo-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your account information and settings
          </p>
        </div>

        {/* Avatar + Name */}
        <Card>
          <div className="flex items-center gap-4 pb-5 border-b border-gray-100 mb-5">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl select-none">
              {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.full_name}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(user.roles ?? []).map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                  >
                    {ROLE_LABELS[role] ?? role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Profile info */}
          <dl className="space-y-3">
            <ProfileField label="Employee ID" value={user.sf_employee_id} />
            <ProfileField label="Full Name" value={user.full_name} />
            <ProfileField label="Email" value={user.email} />
            <ProfileField label="Grade" value={user.grade} />
            <ProfileField label="Designation" value={user.designation} />
            <ProfileField label="Department" value={user.department} />
            <ProfileField label="Division" value={user.division} />
            <ProfileField label="Company" value={user.company} />
          </dl>

          {/* SuccessFactors note */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-2">
            <svg
              className="w-4 h-4 text-blue-400 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs text-gray-400">
              Profile information is synced from{' '}
              <span className="font-medium text-gray-500">SuccessFactors</span>.
              To update your details, please make changes in the SuccessFactors
              system. Changes will be reflected here after the next sync.
            </p>
          </div>
        </Card>

        {/* Security / Password */}
        <Card title="Security">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <svg
              className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Password managed via SuccessFactors
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                To change your password, please use the SuccessFactors portal or
                contact your HR administrator.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
