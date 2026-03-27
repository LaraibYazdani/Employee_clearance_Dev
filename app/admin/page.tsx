'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { ClearanceRequest, User } from '@/types'
import { formatDatePKT, formatRelativeTime } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Stats {
  total: number
  active: number
  pending_intervention: number
  completed: number
}

interface AdminClearance extends ClearanceRequest {
  employee?: User
  hrbp?: User
}

interface ActivityEntry {
  id: string
  clearance_request_id: string
  actor_id: string
  action: string
  details: string
  created_at: string
  actor?: { id: string; full_name: string; email: string; roles: string[] }
  clearance_request?: {
    id: string
    status: string
    employee?: { full_name: string; sf_employee_id: string }
  }
}

type Tab = 'clearances' | 'users' | 'activity'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALL_ROLES = [
  'HRBP',
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
  'EMPLOYEE',
  'SUPER_ADMIN',
]

const ROLE_LABELS: Record<string, string> = {
  HRBP: 'HRBP',
  DEPT_APPROVER_IR: 'IR Approver',
  DEPT_APPROVER_IT: 'IT Approver',
  DEPT_APPROVER_SUPPLY: 'Supply Approver',
  DEPT_APPROVER_ICS: 'ICS Approver',
  DEPT_APPROVER_SECURITY: 'Security Approver',
  DEPT_APPROVER_OTHER: 'Other Approver',
  DEPT_APPROVER_HEAD: 'Dept Head Approver',
  DEPT_APPROVER_OD: 'OD Approver',
  DEPT_APPROVER_HR: 'HR Approver',
  DEPT_APPROVER_FINANCE: 'Finance Approver',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Admin',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_HRBP', label: 'Pending HRBP' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
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
        highlight && value > 0 ? 'border-orange-300' : 'border-gray-200',
      ].join(' ')}
    >
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span
        className={[
          'text-3xl font-bold',
          highlight && value > 0 ? 'text-orange-600' : 'text-indigo-700',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-2 mt-4">
      <Button
        size="sm"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClearancesTab
// ---------------------------------------------------------------------------
function ClearancesTab({ token }: { token: string }) {
  const router = useRouter()
  const [clearances, setClearances] = useState<AdminClearance[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchClearances = useCallback(
    async (pg: number = page) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(pg),
          pageSize: String(PAGE_SIZE),
        })
        if (search.trim()) params.set('search', search.trim())
        if (status) params.set('status', status)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)

        const res = await fetch(`/api/admin/clearances?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch clearances')
        const data = await res.json()
        setClearances(data.clearances ?? [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        setPage(pg)
      } catch (e: any) {
        setError(e.message ?? 'Error loading clearances')
      } finally {
        setLoading(false)
      }
    },
    [token, search, status, dateFrom, dateTo, page]
  )

  useEffect(() => {
    fetchClearances(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dateFrom, dateTo])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchClearances(1)
  }

  const handleAction = async (id: string, action: 'FORCE_COMPLETE' | 'CANCEL') => {
    if (
      !window.confirm(
        `Are you sure you want to ${
          action === 'FORCE_COMPLETE' ? 'force complete' : 'cancel'
        } this clearance?`
      )
    )
      return

    setActionLoading(id + action)
    try {
      const res = await fetch('/api/admin/clearances', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Action failed')
      }
      fetchClearances(page)
    } catch (e: any) {
      alert(e.message ?? 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-3 mb-4 items-end"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          />
        </div>
        <Button type="submit" loading={loading}>
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSearch('')
            setStatus('')
            setDateFrom('')
            setDateTo('')
            setTimeout(() => fetchClearances(1), 0)
          }}
        >
          Reset
        </Button>
      </form>

      <p className="text-xs text-gray-400 mb-3">{total} clearances found</p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              {[
                '#',
                'Employee',
                'Dept',
                'Status',
                'HRBP',
                'Date of Leaving',
                'Created',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : clearances.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-400 text-sm"
                >
                  No clearances found
                </td>
              </tr>
            ) : (
              clearances.map((c, idx) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">
                      {c.employee?.full_name ?? '—'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.employee?.sf_employee_id ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {c.employee?.department ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {c.hrbp?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {c.date_of_leaving ? formatDatePKT(c.date_of_leaving) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDatePKT(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/clearance/${c.id}`)}
                      >
                        View
                      </Button>
                      {c.status !== 'COMPLETED' && c.status !== 'CANCELLED' && (
                        <>
                          <button
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={actionLoading === c.id + 'FORCE_COMPLETE'}
                            onClick={() => handleAction(c.id, 'FORCE_COMPLETE')}
                          >
                            {actionLoading === c.id + 'FORCE_COMPLETE'
                              ? '...'
                              : 'Force Complete'}
                          </button>
                          <button
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={actionLoading === c.id + 'CANCEL'}
                            onClick={() => handleAction(c.id, 'CANCEL')}
                          >
                            {actionLoading === c.id + 'CANCEL' ? '...' : 'Cancel'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={(p) => fetchClearances(p)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// UsersTab
// ---------------------------------------------------------------------------
function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editRoles, setEditRoles] = useState<Record<string, string[]>>({})
  const [saveResults, setSaveResults] = useState<Record<string, 'ok' | 'err'>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      const userList: User[] = data.users ?? []
      setUsers(userList)
      const initialRoles: Record<string, string[]> = {}
      userList.forEach((u) => {
        initialRoles[u.id] = [...(u.roles ?? [])]
      })
      setEditRoles(initialRoles)
    } catch (e: any) {
      setError(e.message ?? 'Error loading users')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const toggleRole = (userId: string, role: string) => {
    setEditRoles((prev) => {
      const current = prev[userId] ?? []
      const updated = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role]
      return { ...prev, [userId]: updated }
    })
    setSaveResults((prev) => ({ ...prev, [userId]: undefined as any }))
  }

  const handleSave = async (userId: string) => {
    setSavingId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, roles: editRoles[userId] ?? [] }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setSaveResults((prev) => ({ ...prev, [userId]: 'ok' }))
      fetchUsers()
    } catch (e: any) {
      setSaveResults((prev) => ({ ...prev, [userId]: 'err' }))
      alert(e.message ?? 'Failed to save roles')
    } finally {
      setSavingId(null)
    }
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {users.map((u) => {
        const userRoles = editRoles[u.id] ?? u.roles ?? []
        const isDirty =
          JSON.stringify([...userRoles].sort()) !==
          JSON.stringify([...(u.roles ?? [])].sort())
        const result = saveResults[u.id]

        return (
          <div
            key={u.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {u.full_name}
                </p>
                <p className="text-xs text-gray-400">
                  {u.email} &nbsp;|&nbsp; ID: {u.sf_employee_id}
                </p>
                {u.department && (
                  <p className="text-xs text-gray-400">{u.department}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    size="sm"
                    loading={savingId === u.id}
                    onClick={() => handleSave(u.id)}
                  >
                    Save
                  </Button>
                )}
                {result === 'ok' && (
                  <span className="text-xs text-green-600 font-medium">Saved</span>
                )}
                {result === 'err' && (
                  <span className="text-xs text-red-600 font-medium">Error</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const active = userRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(u.id, role)}
                    className={[
                      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {ROLE_LABELS[role] ?? role}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityTab
// ---------------------------------------------------------------------------
function ActivityTab({ token }: { token: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterClearanceId, setFilterClearanceId] = useState('')
  const [filterActor, setFilterActor] = useState('')

  const fetchActivity = useCallback(
    async (pg: number = page) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(pg),
          pageSize: '20',
        })
        if (filterClearanceId.trim())
          params.set('clearanceId', filterClearanceId.trim())
        if (filterActor.trim()) params.set('actorSearch', filterActor.trim())

        const res = await fetch(`/api/admin/activity?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch activity log')
        const data = await res.json()
        setActivities(data.activities ?? [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        setPage(pg)
      } catch (e: any) {
        setError(e.message ?? 'Error loading activity log')
      } finally {
        setLoading(false)
      }
    },
    [token, filterClearanceId, filterActor, page]
  )

  useEffect(() => {
    fetchActivity(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchActivity(1)
  }

  const parseDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details)
      return parsed.message || details
    } catch {
      return details
    }
  }

  return (
    <div>
      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-3 mb-4 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Clearance ID
          </label>
          <input
            type="text"
            placeholder="Filter by clearance ID..."
            value={filterClearanceId}
            onChange={(e) => setFilterClearanceId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none w-64"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Actor Name
          </label>
          <input
            type="text"
            placeholder="Filter by actor name..."
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none w-52"
          />
        </div>
        <Button type="submit" loading={loading}>
          Filter
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFilterClearanceId('')
            setFilterActor('')
            setTimeout(() => fetchActivity(1), 0)
          }}
        >
          Reset
        </Button>
      </form>

      <p className="text-xs text-gray-400 mb-3">{total} log entries</p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              {['Clearance', 'Actor', 'Action', 'Details', 'When'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : activities.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-gray-400 text-sm"
                >
                  No activity logs found
                </td>
              </tr>
            ) : (
              activities.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-indigo-600">
                      {a.clearance_request_id.slice(0, 8)}...
                    </div>
                    <div className="text-xs text-gray-400">
                      {a.clearance_request?.employee?.full_name ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800">
                      {a.actor?.full_name ?? a.actor_id}
                    </div>
                    <div className="text-xs text-gray-400">
                      {a.actor?.email ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">
                    {parseDetails(a.details)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatRelativeTime(a.created_at)}
                    <br />
                    <span className="text-gray-300">
                      {formatDatePKT(a.created_at)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={(p) => fetchActivity(p)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPage
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const { user, token, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('clearances')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !user) {
      router.replace('/login')
      return
    }
    if (!user.roles.includes('SUPER_ADMIN')) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, user, router])

  // Fetch stats
  useEffect(() => {
    if (!token || !user?.roles.includes('SUPER_ADMIN')) return

    const fetchStats = async () => {
      try {
        const params = new URLSearchParams({ pageSize: '1' })
        const [allRes, activeRes, pendingRes, completedRes] = await Promise.all([
          fetch(`/api/admin/clearances?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/admin/clearances?status=IN_PROGRESS&pageSize=1`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/admin/clearances?status=PENDING_HRBP&pageSize=1`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/admin/clearances?status=COMPLETED&pageSize=1`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])
        const [allData, activeData, pendingData, completedData] = await Promise.all([
          allRes.json(),
          activeRes.json(),
          pendingRes.json(),
          completedRes.json(),
        ])
        setStats({
          total: allData.total ?? 0,
          active: activeData.total ?? 0,
          pending_intervention: pendingData.total ?? 0,
          completed: completedData.total ?? 0,
        })
      } catch (e) {
        console.error('Failed to load stats:', e)
      }
    }

    fetchStats()
  }, [token, user])

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

  if (!user.roles.includes('SUPER_ADMIN')) return null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'clearances', label: 'All Clearances' },
    { key: 'users', label: 'Users' },
    { key: 'activity', label: 'Activity Log' },
  ]

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            System-wide management and monitoring
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
          Super Admin
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clearances" value={stats?.total ?? 0} />
        <StatCard label="Active" value={stats?.active ?? 0} />
        <StatCard
          label="Pending Intervention"
          value={stats?.pending_intervention ?? 0}
          highlight
        />
        <StatCard label="Completed" value={stats?.completed ?? 0} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'clearances' && token && (
            <ClearancesTab token={token} />
          )}
          {activeTab === 'users' && token && <UsersTab token={token} />}
          {activeTab === 'activity' && token && (
            <ActivityTab token={token} />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
