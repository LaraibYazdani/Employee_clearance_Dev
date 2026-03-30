'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { ClearanceRequest } from '@/types'
import { formatDatePKT, daysUntil } from '@/lib/utils'

interface DashboardStats {
  active: number
  pending_intervention: number
  completed_this_month: number
  total: number
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border p-5 flex flex-col gap-1 bg-white shadow-sm',
        highlight ? 'border-red-300' : 'border-gray-200',
      ].join(' ')}
    >
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={[
            'text-3xl font-bold',
            highlight ? 'text-red-600' : 'text-indigo-700',
          ].join(' ')}
        >
          {value}
        </span>
        {highlight && value > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            Action needed
          </span>
        )}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

function DaysCell({ dateOfLeaving }: { dateOfLeaving?: string }) {
  if (!dateOfLeaving) return <span className="text-gray-400">—</span>
  const days = daysUntil(dateOfLeaving)
  if (days < 0) {
    return <span className="font-semibold text-red-600">Overdue</span>
  }
  return <span className="text-gray-700">{days} day{days !== 1 ? 's' : ''}</span>
}

export default function HRBPDashboard() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  // Role guard — redirect non-HRBP users
  useEffect(() => {
    if (isLoading) return
    if (!user || !user.roles.includes('HRBP')) {
      router.replace('/clearance')
    }
  }, [user, isLoading, router])

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [clearances, setClearances] = useState<ClearanceRequest[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingClearances, setLoadingClearances] = useState(true)

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  )

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/dashboard/stats', { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } finally {
      setLoadingStats(false)
    }
  }, [token, authHeaders])

  const fetchClearances = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/clearance', { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setClearances(Array.isArray(data) ? data : (data.clearances ?? []))
      }
    } finally {
      setLoadingClearances(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    fetchStats()
    fetchClearances()
  }, [fetchStats, fetchClearances])

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HRBP Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and monitor employee exit clearances
          </p>
        </div>
        <Button onClick={() => router.push('/clearance/new')}>
          + Initiate New Clearance
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm p-5 h-24"
            />
          ))
        ) : (
          <>
            <StatCard label="Active Clearances" value={stats?.active ?? 0} />
            <StatCard
              label="Pending Intervention"
              value={stats?.pending_intervention ?? 0}
              highlight={(stats?.pending_intervention ?? 0) > 0}
            />
            <StatCard
              label="Completed This Month"
              value={stats?.completed_this_month ?? 0}
            />
            <StatCard label="Total" value={stats?.total ?? 0} />
          </>
        )}
      </div>

      {/* Clearances table */}
      <Card title="Clearance Requests">
        {loadingClearances ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    'Employee Name',
                    'Employee #',
                    'Department',
                    'Date of Leaving',
                    'Status',
                    'Days Until Leaving',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : clearances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No active clearances</p>
            <p className="text-gray-400 text-sm mt-1">
              Initiate a clearance to get started.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push('/clearance/new')}
            >
              Initiate New Clearance
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -m-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-100">
                  {[
                    'Employee Name',
                    'Employee #',
                    'Department',
                    'Date of Leaving',
                    'Status',
                    'Days Until Leaving',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clearances.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.employee?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.employee?.sf_employee_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.employee?.department ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.date_of_leaving
                        ? formatDatePKT(c.date_of_leaving)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DaysCell dateOfLeaving={c.date_of_leaving} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/clearance/${c.id}`)}
                        >
                          View Details
                        </Button>
                        {c.status === 'PENDING_HRBP' && (
                          <Button
                            size="sm"
                            className="bg-orange-500 text-white hover:bg-orange-600 border-transparent focus:ring-orange-400"
                            onClick={() => router.push(`/clearance/${c.id}`)}
                          >
                            Intervene
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
