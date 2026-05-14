'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { ClearanceRequest } from '@/types'
import {
  formatDatePKT,
  daysUntil,
  getInitials,
  getUserSectionKey,
  getSectionLabel,
} from '@/lib/utils'

type TabKey = 'pending' | 'completed'

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
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
  if (days < 0)
    return <span className="font-semibold text-red-600">Overdue</span>
  return (
    <span className="text-gray-700">
      {days} day{days !== 1 ? 's' : ''}
    </span>
  )
}

export default function ApproverDashboard() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  // Role guard — redirect users without any DEPT_APPROVER_* role
  useEffect(() => {
    if (isLoading) return
    if (!user || !user.roles.some((r) => r.startsWith('DEPT_APPROVER_'))) {
      router.replace('/clearance')
    }
  }, [user, isLoading, router])

  const [clearances, setClearances] = useState<ClearanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('pending')

  const sectionKey = user ? getUserSectionKey(user) : null

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  )

  const fetchClearances = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/clearance', { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setClearances(Array.isArray(data) ? data : (data.clearances ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    fetchClearances()
  }, [fetchClearances])

  const pending = clearances.filter(
    (c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED'
  )
  const completed = clearances.filter(
    (c) => c.status === 'COMPLETED' || c.status === 'CANCELLED'
  )

  const displayList = activeTab === 'pending' ? pending : completed

  const getSectionStatus = (c: ClearanceRequest) => {
    if (!c.sections) return null
    // Prefer server-tagged section, then fall back to role-derived key
    const sec =
      c.sections.find((s: any) => s.is_my_section) ??
      (sectionKey ? c.sections.find((s) => s.section_key === sectionKey) : null)
    return sec?.status ?? null
  }

  const initials = user ? getInitials(user.full_name) : '?'
  const roleLabel = sectionKey ? getSectionLabel(sectionKey) : 'Approver'

  return (
    <DashboardLayout>
      {/* Welcome header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.full_name ?? 'Approver'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge status="IN_PROGRESS" className="text-xs" />
              <span className="text-sm text-gray-500">{roleLabel}</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchClearances}
        >
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-5">
          <p className="text-sm text-gray-500 font-medium">Pending Approvals</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">
            {loading ? '—' : pending.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
          <p className="text-sm text-gray-500 font-medium">Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {loading ? '—' : completed.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500 font-medium">Total</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">
            {loading ? '—' : clearances.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        {/* Tab headers */}
        <div className="-mx-6 -mt-6 border-b border-gray-100 mb-6">
          <nav className="flex px-6" aria-label="Tabs">
            {(
              [
                { key: 'pending', label: 'Pending', count: pending.length },
                { key: 'completed', label: 'Completed', count: completed.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'py-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-px mr-2',
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {tab.label}
                <span
                  className={[
                    'ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold',
                    activeTab === tab.key
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600',
                  ].join(' ')}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    'Employee Name',
                    'Employee ID',
                    'Department',
                    'Date of Leaving',
                    'Days Until Leaving',
                    'Clearance Status',
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonRow key={i} cols={7} />
                ))}
              </tbody>
            </table>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">
              {activeTab === 'pending'
                ? 'No pending approvals'
                : 'No completed clearances yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === 'pending'
                ? 'You are all caught up!'
                : 'Completed items will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-100">
                  {[
                    'Employee Name',
                    'Employee ID',
                    'Department',
                    'Date of Leaving',
                    'Days Until Leaving',
                    'Clearance Status',
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
                {displayList.map((c) => {
                  const secStatus = getSectionStatus(c)
                  return (
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
                        <DaysCell dateOfLeaving={c.date_of_leaving} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={
                            secStatus === 'PENDING' ? 'primary' : 'ghost'
                          }
                          onClick={() => router.push(`/clearance/${c.id}?view=approvals`)}
                        >
                          {secStatus === 'PENDING' ? 'Review' : 'View'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
