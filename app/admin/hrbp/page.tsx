'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'

interface HRBPUser {
  id: string
  sf_employee_id: string
  full_name: string
  email: string
  designation?: string
  department?: string
  roles: string[]
}

interface SearchResult {
  id: string
  sf_employee_id: string
  full_name: string
  email: string
  designation?: string
  roles: string[]
}

export default function HRBPManagementPage() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  const [hrbpUsers, setHrbpUsers] = useState<HRBPUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!user?.roles.includes('SUPER_ADMIN')) router.replace('/admin')
  }, [user, isLoading, router])

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  )

  const fetchHRBPs = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/hrbp', { headers: authHeaders() })
      if (res.ok) setHrbpUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    if (!isLoading && user) fetchHRBPs()
  }, [isLoading, user, fetchHRBPs])

  async function searchUsers() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    setError('')
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchQuery.trim())}`,
        { headers: authHeaders() }
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : (data.users ?? []))
      }
    } finally {
      setSearching(false)
    }
  }

  async function grantHRBP(userId: string) {
    setActionLoading(userId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/hrbp', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        setSuccess('HRBP role granted successfully.')
        setSearchResults([])
        setSearchQuery('')
        await fetchHRBPs()
      } else {
        const data = await res.json()
        setError(data.message ?? 'Failed to grant role.')
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function revokeHRBP(userId: string) {
    setActionLoading(userId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/hrbp', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        setSuccess('HRBP role revoked.')
        await fetchHRBPs()
      } else {
        const data = await res.json()
        setError(data.message ?? 'Failed to revoke role.')
      }
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HRBP Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            View all users with the HRBP role. The role is auto-granted when SF verifies an
            initiation, or you can assign it manually here.
          </p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Manual assign */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Manual Override — Assign HRBP Role</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search by name or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button variant="primary" size="sm" onClick={searchUsers} loading={searching}>
              Search
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {searchResults.map((u) => {
                const alreadyHRBP = u.roles?.includes('HRBP')
                return (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.sf_employee_id} · {u.designation ?? '—'}</p>
                    </div>
                    {alreadyHRBP ? (
                      <span className="text-xs text-green-600 font-medium">Already HRBP</span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={actionLoading === u.id}
                        onClick={() => grantHRBP(u.id)}
                      >
                        Grant HRBP
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Current HRBP list */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Current HRBPs
              {!loading && (
                <span className="ml-2 text-xs font-normal text-gray-400">{hrbpUsers.length} total</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : hrbpUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No users have the HRBP role yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {hrbpUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {u.sf_employee_id} · {u.designation ?? '—'} · {u.department ?? '—'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={actionLoading === u.id}
                    onClick={() => revokeHRBP(u.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
