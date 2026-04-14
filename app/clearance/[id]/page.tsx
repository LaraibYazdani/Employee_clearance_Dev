'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ApproverSummaryPanel from '@/components/clearance/ApproverSummaryPanel'
import SectionActionForm from '@/components/clearance/SectionActionForm'
import HRBPIntervention from '@/components/clearance/HRBPIntervention'
import FinanceSection from '@/components/clearance/FinanceSection'
import { useAuth } from '@/lib/auth-context'
import { ClearanceRequest, ClearanceSection, Notification } from '@/types'
import {
  formatDatePKT,
  formatRelativeTime,
  getUserSectionKey,
  getSectionLabel,
  hasRole,
  hasAnyRole,
} from '@/lib/utils'

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */
function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-10 bg-gray-200 rounded-lg w-2/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Detail field
───────────────────────────────────────────── */
function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="block text-sm font-medium text-gray-800 mt-0.5">
        {value || '—'}
      </span>
    </div>
  )
}

function QueryBadge({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  const colorMap: Record<string, string> = {
    YES: 'bg-green-100 text-green-700 border-green-200',
    NO: 'bg-red-100 text-red-700 border-red-200',
    NA: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <div>
      <span className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </span>
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorMap[value] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
        {value}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Activity log item
───────────────────────────────────────────── */
function ActivityItem({ item }: { item: Notification }) {
  return (
    <div className="flex gap-3 py-2">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
        <svg
          className="w-3.5 h-3.5 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 leading-relaxed">{item.message}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatRelativeTime(item.created_at)}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function ClearanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, token } = useAuth()
  const id = params.id as string

  const [clearance, setClearance] = useState<ClearanceRequest | null>(null)
  const [activity, setActivity] = useState<Notification[]>([])
  const [financeEntries, setFinanceEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  )

  const fetchClearance = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/clearance/${id}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load clearance')
      const data: ClearanceRequest = await res.json()
      setClearance(data)
      if (!activeSection && data.sections && data.sections.length > 0) {
        setActiveSection(data.sections[0].section_key)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading clearance')
    } finally {
      setLoading(false)
    }
  }, [token, id, authHeaders, activeSection])

  const fetchActivity = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/clearance/${id}/activity`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setActivity(Array.isArray(data) ? data.slice(0, 5) : [])
      }
    } catch {
      // Non-critical — ignore
    }
  }, [token, id, authHeaders])

  const fetchFinanceEntries = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/clearance/${id}/finance`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setFinanceEntries(Array.isArray(data) ? data : [])
      }
    } catch {
      // Non-critical — ignore
    }
  }, [token, id, authHeaders])

  useEffect(() => {
    fetchClearance()
    fetchActivity()
    fetchFinanceEntries()
  }, [fetchClearance, fetchActivity, fetchFinanceEntries])

  // Poll every 30 seconds
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchClearance()
      fetchActivity()
    }, 30000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchClearance, fetchActivity])

  const handleRefresh = () => {
    setLoading(true)
    fetchClearance()
    fetchActivity()
    fetchFinanceEntries()
  }

  /* Role checks */
  const isHRBP = user ? hasRole(user, 'HRBP') : false
  const isSuperAdmin = user ? hasRole(user, 'SUPER_ADMIN') : false
  const userSectionKey = user ? getUserSectionKey(user) : null
  const isDeptApprover =
    user
      ? hasAnyRole(user, [
          'DEPT_APPROVER_IR',
          'DEPT_APPROVER_IT',
          'DEPT_APPROVER_SUPPLY',
          'DEPT_APPROVER_ICS',
          'DEPT_APPROVER_SECURITY',
          'DEPT_APPROVER_OTHER',
          'DEPT_APPROVER_HEAD',
          'DEPT_APPROVER_OD',
          'DEPT_APPROVER_HR',
          'DEPT_APPROVER_FINANCE',
        ])
      : false

  const sections = clearance?.sections ?? []
  const currentSection = sections.find((s) => s.section_key === activeSection)

  const canActOnSection = (sec: ClearanceSection): boolean => {
    if (sec.status === 'LOCKED') return false
    if (sec.status !== 'PENDING') return false
    if (isSuperAdmin) return true
    if (isHRBP) return false
    // Allow if the user is the assigned approver for this section
    if (sec.approver_id && sec.approver_id === user?.id) return true
    // Allow if the user has the matching role for this section
    if (isDeptApprover && userSectionKey === sec.section_key) return true
    return false
  }

  const handleDownloadPDF = async () => {
    if (!token) return
    const res = await fetch(`/api/clearance/${id}/pdf`, {
      headers: authHeaders(),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clearance-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  /* ── Render ── */
  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  if (error || !clearance) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-red-600 font-medium text-lg">
            {error ?? 'Clearance not found'}
          </p>
          <Button className="mt-4" variant="ghost" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const emp = clearance.employee

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
          {clearance.status === 'COMPLETED' && (
            <Button size="sm" onClick={handleDownloadPDF}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Employee header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
              {emp?.full_name
                ? emp.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {emp?.full_name ?? '—'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {emp?.sf_employee_id} &bull; {emp?.designation ?? '—'}
              </p>
            </div>
          </div>
          <Badge status={clearance.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <DetailField label="Grade" value={emp?.grade} />
          <DetailField label="Department" value={emp?.department} />
          <DetailField label="Division" value={emp?.division} />
          <DetailField
            label="Date of Leaving"
            value={clearance.date_of_leaving ? formatDatePKT(clearance.date_of_leaving) : undefined}
          />
        </div>

        {(clearance.laptop_buyback || clearance.vehicle_loan || clearance.sim_transfer || clearance.other_query) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Employee Queries
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <QueryBadge label="Laptop Buyback" value={clearance.laptop_buyback} />
              <QueryBadge label="Vehicle Loan" value={clearance.vehicle_loan} />
              <QueryBadge label="SIM Transfer" value={clearance.sim_transfer} />
            </div>
            {clearance.other_query && (
              <div className="mt-3">
                <DetailField label="Other Query" value={clearance.other_query} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Center: section tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="border-b border-gray-100 overflow-x-auto">
              <nav className="flex px-4 min-w-max" aria-label="Section tabs">
                {sections.map((sec) => {
                  const isActive = activeSection === sec.section_key
                  const isUserSection = isDeptApprover && userSectionKey === sec.section_key
                  return (
                    <button
                      key={sec.section_key}
                      onClick={() => setActiveSection(sec.section_key)}
                      className={[
                        'relative py-3 px-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex items-center gap-1.5',
                        isActive
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700',
                        isUserSection && !isActive
                          ? 'text-indigo-500 font-semibold'
                          : '',
                      ].join(' ')}
                    >
                      {sec.status === 'LOCKED' && (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      {getSectionLabel(sec.section_key)}
                      <span
                        className={[
                          'w-2 h-2 rounded-full shrink-0',
                          sec.status === 'APPROVED'
                            ? 'bg-green-500'
                            : sec.status === 'DENIED'
                            ? 'bg-red-500'
                            : sec.status === 'LOCKED'
                            ? 'bg-gray-300'
                            : 'bg-yellow-400',
                        ].join(' ')}
                      />
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Tab content */}
            <div className="p-6">
              {!currentSection ? (
                <p className="text-sm text-gray-400">Select a section above.</p>
              ) : currentSection.status === 'LOCKED' ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-gray-500 font-medium">Section Locked</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Waiting for previous sections to be completed.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Section status header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      {getSectionLabel(currentSection.section_key)}
                    </h3>
                    <Badge status={currentSection.status} />
                  </div>

                  {/* Finance section gets its own component */}
                  {currentSection.section_key === 'FINANCE' ? (
                    <FinanceSection
                      key={currentSection.id + currentSection.status}
                      clearanceId={id}
                      entries={financeEntries}
                      isApprover={
                        isDeptApprover && userSectionKey === 'FINANCE'
                          || (currentSection.approver_id != null && currentSection.approver_id === user?.id)
                      }
                      sectionStatus={currentSection.status}
                      onActionComplete={handleRefresh}
                    />
                  ) : (
                    <>
                      {/* HRBP intervention for denied sections */}
                      {isHRBP && currentSection.status === 'DENIED' && (
                        <HRBPIntervention
                          section={currentSection}
                          clearanceId={id}
                          onRerouted={handleRefresh}
                        />
                      )}

                      {/* Section action form — shown to the approver for action, or read-only when already actioned */}
                      {(canActOnSection(currentSection) || currentSection.status === 'APPROVED' || isSuperAdmin) && (
                        <SectionActionForm
                          key={currentSection.id + currentSection.status}
                          section={currentSection}
                          clearanceId={id}
                          onActionComplete={handleRefresh}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Approver summary */}
          <ApproverSummaryPanel
            clearanceId={id}
            sections={sections}
            onRefresh={handleRefresh}
          />

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Activity Log
              </h3>
              <button
                onClick={() => router.push(`/clearance/${id}/activity`)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                View All
              </button>
            </div>
            <div className="px-4 divide-y divide-gray-50">
              {activity.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No activity yet.
                </p>
              ) : (
                activity.map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* PDF download (only when completed) */}
          {clearance.status === 'COMPLETED' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800 mb-2">
                Clearance Completed
              </p>
              <p className="text-xs text-green-600 mb-3">
                All sections have been approved. You can now download the
                clearance certificate.
              </p>
              <Button
                className="w-full bg-green-600 text-white hover:bg-green-700 border-transparent"
                onClick={handleDownloadPDF}
              >
                Download PDF Certificate
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
