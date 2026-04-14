'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { ClearanceRequest } from '@/types'
import { formatDatePKT, getSectionLabel } from '@/lib/utils'

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-48 bg-gray-200 rounded-xl" />
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 mb-4">
        <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">No clearance initiated</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        Your clearance has not been started yet. Please contact your HRBP to initiate the process.
      </p>
    </div>
  )
}

export default function EmployeeClearancePage() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  const [clearances, setClearances] = useState<ClearanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Redirect non-employees (privileged roles have their own dashboards)
  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    const roles = user.roles ?? []
    if (roles.includes('SUPER_ADMIN')) {
      router.replace('/admin')
    } else if (roles.some((r) => r.startsWith('DEPT_APPROVER_'))) {
      router.replace('/dashboard/approver')
    }
    // HRBP and EMPLOYEE both stay here to view their own clearance status
  }, [user, isLoading, router])

  const fetchClearances = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/clearance?view=mine', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setClearances(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!isLoading && user) fetchClearances()
  }, [isLoading, user, fetchClearances])

  // Still loading auth or redirecting privileged users
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  // Don't render page content while redirecting privileged users
  const roles = user?.roles ?? []
  if (
    roles.includes('SUPER_ADMIN') ||
    roles.some((r) => r.startsWith('DEPT_APPROVER_'))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Clearance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track the status of your employee clearance process.
        </p>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : clearances.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {clearances.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Clearance header */}
              <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">
                    Clearance Request
                  </p>
                  <p className="text-sm font-mono text-gray-500 truncate max-w-xs">
                    {c.id}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={c.status} />
                  {c.date_of_leaving && (
                    <span className="text-xs text-gray-400">
                      Last day: {formatDatePKT(c.date_of_leaving)}
                    </span>
                  )}
                </div>
              </div>

              {/* Sections grid */}
              {c.sections && c.sections.length > 0 && (
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Section Status
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {c.sections.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
                      >
                        <span className="text-sm text-gray-700 truncate mr-2">
                          {getSectionLabel(s.section_key)}
                        </span>
                        <Badge status={s.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: initiated date + view details */}
              <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Initiated on {formatDatePKT(c.created_at)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/clearance/${c.id}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
