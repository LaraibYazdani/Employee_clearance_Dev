'use client'

import React, { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'

const COMPANY_CODES: Record<string, string> = {
  '1000': 'PL — Packages Ltd.',
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

interface Assignment {
  id: string
  company_code: string
  section_key: string
  item_key: string
  approver: { id: string; full_name: string; email: string; designation: string }
}

interface SectionItem {
  item_key: string
  description: string
  assignment: Assignment | null
}

interface Section {
  section_key: string
  section_label: string
  items: SectionItem[]
}

interface UserSearchResult {
  id: string
  full_name: string
  email: string
  designation: string
  fromSF?: boolean
  sf_employee_id?: string
}

interface SFImportResult {
  sf_employee_id: string
  full_name: string
  email: string
  designation: string
  department: string
  grade: string
  inDb: boolean
  dbId: string | null
}

export default function ApproverManagementPage() {
  const { token } = useAuth()
  const [selectedCompany, setSelectedCompany] = useState('1000')
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [payrollManager, setPayrollManager] = useState<Assignment | null>(null)

  // Payroll manager assignment state
  const [pmEditing, setPmEditing] = useState(false)
  const [pmQuery, setPmQuery] = useState('')
  const [pmDbResults, setPmDbResults] = useState<UserSearchResult[]>([])
  const [pmSfResults, setPmSfResults] = useState<SFImportResult[]>([])
  const [pmSfLoading, setPmSfLoading] = useState(false)
  const [pmImporting, setPmImporting] = useState(false)
  const [pmSaving, setPmSaving] = useState(false)
  const [pmError, setPmError] = useState<string | null>(null)

  // User search state per cell
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({})
  const [searchResults, setSearchResults] = useState<Record<string, UserSearchResult[]>>({})
  const [sfResults, setSfResults] = useState<Record<string, SFImportResult[]>>({})
  const [sfLoading, setSfLoading] = useState<Record<string, boolean>>({})
  const [activeSearch, setActiveSearch] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)

  // Bulk assign state
  const [bulkSection, setBulkSection] = useState<string | null>(null)
  const [bulkUser, setBulkUser] = useState<UserSearchResult | null>(null)
  const [bulkQuery, setBulkQuery] = useState('')
  const [bulkResults, setBulkResults] = useState<UserSearchResult[]>([])
  const [bulkSfResults, setBulkSfResults] = useState<SFImportResult[]>([])
  const [bulkSfLoading, setBulkSfLoading] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Per-item assign error
  const [assignError, setAssignError] = useState<string | null>(null)

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token])

  const fetchMatrix = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/approvers?company=${selectedCompany}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setSections(data.sections ?? [])
        setPayrollManager(data.payrollManager ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [token, selectedCompany, authHeaders])

  useEffect(() => { fetchMatrix() }, [fetchMatrix])

  const searchUsers = async (query: string, cellKey: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults((prev) => ({ ...prev, [cellKey]: [] }))
      setSfResults((prev) => ({ ...prev, [cellKey]: [] }))
      return
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSearchResults((prev) => ({ ...prev, [cellKey]: data.slice(0, 8) }))
      }
    } catch { /* ignore */ }
  }

  const searchSF = async (query: string, cellKey: string) => {
    if (!query.trim() || query.length < 2) return
    setSfLoading((prev) => ({ ...prev, [cellKey]: true }))
    try {
      const res = await fetch(`/api/admin/sf-import?q=${encodeURIComponent(query)}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data: SFImportResult[] = await res.json()
        setSfResults((prev) => ({ ...prev, [cellKey]: data.slice(0, 8) }))
      }
    } catch { /* ignore */ }
    finally {
      setSfLoading((prev) => ({ ...prev, [cellKey]: false }))
    }
  }

  const searchBulkUsers = async (query: string) => {
    setBulkQuery(query)
    if (!query.trim() || query.length < 2) { setBulkResults([]); setBulkSfResults([]); return }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBulkResults(data.slice(0, 8))
      }
    } catch { /* ignore */ }
  }

  const searchBulkSF = async (query: string) => {
    if (!query.trim() || query.length < 2) return
    setBulkSfLoading(true)
    try {
      const res = await fetch(`/api/admin/sf-import?q=${encodeURIComponent(query)}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data: SFImportResult[] = await res.json()
        setBulkSfResults(data.slice(0, 8))
      }
    } catch { /* ignore */ }
    finally {
      setBulkSfLoading(false)
    }
  }

  // Import from SF then assign (per-item)
  const importAndAssign = async (
    sfUser: SFImportResult,
    sectionKey: string,
    itemKey: string,
    cellKey: string
  ) => {
    setImporting(cellKey)
    setAssignError(null)
    try {
      let dbId = sfUser.dbId
      if (!sfUser.inDb) {
        const res = await fetch('/api/admin/sf-import', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sf_user_id: sfUser.sf_employee_id }),
        })
        if (!res.ok) {
          const data = await res.json()
          setAssignError(data.error ?? 'Import failed')
          return
        }
        const imported = await res.json()
        dbId = imported.user.id
      }
      await assignApprover(sectionKey, itemKey, { id: dbId!, full_name: sfUser.full_name, email: sfUser.email, designation: sfUser.designation }, cellKey)
    } finally {
      setImporting(null)
    }
  }

  // Import from SF then bulk-assign
  const importAndBulkAssign = async (sfUser: SFImportResult, sectionKey: string) => {
    setBulkSaving(true)
    setBulkError(null)
    try {
      let dbId = sfUser.dbId
      if (!sfUser.inDb) {
        const res = await fetch('/api/admin/sf-import', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sf_user_id: sfUser.sf_employee_id }),
        })
        if (!res.ok) {
          const data = await res.json()
          setBulkError(data.error ?? 'Import failed')
          return
        }
        const imported = await res.json()
        dbId = imported.user.id
      }
      await bulkAssignWithUser(sectionKey, { id: dbId!, full_name: sfUser.full_name, email: sfUser.email, designation: sfUser.designation })
    } finally {
      setBulkSaving(false)
    }
  }

  const assignApprover = async (
    sectionKey: string,
    itemKey: string,
    approver: UserSearchResult,
    cellKey: string
  ) => {
    setSaving(cellKey)
    setAssignError(null)
    try {
      const res = await fetch('/api/admin/approvers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: sectionKey,
          item_key: itemKey,
          approver_id: approver.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setAssignError(data.message ?? 'Assignment failed')
        return
      }
      setActiveSearch(null)
      setSearchQuery((prev) => ({ ...prev, [cellKey]: '' }))
      setSearchResults((prev) => ({ ...prev, [cellKey]: [] }))
      setSfResults((prev) => ({ ...prev, [cellKey]: [] }))
      await fetchMatrix()
    } finally {
      setSaving(null)
    }
  }

  const removeApprover = async (sectionKey: string, itemKey: string) => {
    try {
      await fetch('/api/admin/approvers', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: sectionKey,
          item_key: itemKey,
        }),
      })
      await fetchMatrix()
    } catch { /* ignore */ }
  }

  const bulkAssignWithUser = async (sectionKey: string, user: UserSearchResult) => {
    setBulkSaving(true)
    setBulkError(null)
    try {
      const res = await fetch('/api/admin/approvers/bulk', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: sectionKey,
          approver_id: user.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setBulkError(data.message ?? 'Assignment failed')
        return
      }
      setBulkSection(null)
      setBulkUser(null)
      setBulkQuery('')
      setBulkResults([])
      setBulkSfResults([])
      await fetchMatrix()
    } finally {
      setBulkSaving(false)
    }
  }

  const bulkAssign = async (sectionKey: string) => {
    if (!bulkUser) return
    await bulkAssignWithUser(sectionKey, bulkUser)
  }

  const searchPmUsers = async (query: string) => {
    setPmQuery(query)
    if (!query.trim() || query.length < 2) { setPmDbResults([]); setPmSfResults([]); return }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setPmDbResults((await res.json()).slice(0, 8))
    } catch { /* ignore */ }
  }

  const searchPmSF = async () => {
    if (!pmQuery.trim() || pmQuery.length < 2) return
    setPmSfLoading(true)
    try {
      const res = await fetch(`/api/admin/sf-import?q=${encodeURIComponent(pmQuery)}`, {
        headers: authHeaders(),
      })
      if (res.ok) setPmSfResults((await res.json()).slice(0, 8))
    } catch { /* ignore */ }
    finally { setPmSfLoading(false) }
  }

  const assignPayrollManager = async (approver: UserSearchResult) => {
    setPmSaving(true)
    setPmError(null)
    try {
      const res = await fetch('/api/admin/approvers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: 'PAYROLL_MANAGER',
          item_key: 'section',
          approver_id: approver.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPmError(data.message ?? 'Assignment failed')
        return
      }
      setPmEditing(false)
      setPmQuery('')
      setPmDbResults([])
      setPmSfResults([])
      await fetchMatrix()
    } finally {
      setPmSaving(false)
    }
  }

  const importAndAssignPm = async (sfUser: SFImportResult) => {
    setPmImporting(true)
    setPmError(null)
    try {
      let dbId = sfUser.dbId
      if (!sfUser.inDb) {
        const res = await fetch('/api/admin/sf-import', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ sf_user_id: sfUser.sf_employee_id }),
        })
        if (!res.ok) {
          const data = await res.json()
          setPmError(data.error ?? 'Import failed')
          return
        }
        dbId = (await res.json()).user.id
      }
      await assignPayrollManager({ id: dbId!, full_name: sfUser.full_name, email: sfUser.email, designation: sfUser.designation })
    } finally {
      setPmImporting(false)
    }
  }

  const removePayrollManager = async () => {
    try {
      await fetch('/api/admin/approvers', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: 'PAYROLL_MANAGER',
          item_key: 'section',
        }),
      })
      await fetchMatrix()
    } catch { /* ignore */ }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approver Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Assign approvers per company, section, and sub-item
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchMatrix}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Global assign error */}
        {assignError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{assignError}</span>
            <button onClick={() => setAssignError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Company selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Select Company
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(COMPANY_CODES).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setSelectedCompany(code)}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                  selectedCompany === code
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Payroll Manager card */}
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-purple-50 border-b border-purple-100">
            <div>
              <h3 className="text-sm font-semibold text-purple-900">Payroll Manager</h3>
              <p className="text-xs text-purple-600 mt-0.5">Final sign-off approver for all clearances in this company</p>
            </div>
            {!pmEditing && (
              <button
                onClick={() => { setPmEditing(true); setPmQuery(''); setPmDbResults([]); setPmSfResults([]); setPmError(null) }}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium px-3 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                {payrollManager ? 'Change' : 'Assign'}
              </button>
            )}
          </div>

          <div className="px-5 py-4">
            {pmError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {pmError}
              </div>
            )}

            {pmEditing ? (
              <div className="flex items-start gap-3 flex-wrap">
                <div className="relative flex-1 min-w-64">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={pmQuery}
                      onChange={(e) => searchPmUsers(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="flex-1 rounded-lg border border-purple-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={searchPmSF}
                      disabled={pmSfLoading || pmQuery.length < 2}
                      className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1.5 rounded border border-purple-200 hover:bg-purple-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {pmSfLoading ? 'Searching…' : 'Search SF'}
                    </button>
                    <button
                      onClick={() => { setPmEditing(false); setPmError(null) }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded border border-gray-200"
                    >
                      Cancel
                    </button>
                  </div>

                  {(pmDbResults.length > 0 || pmSfResults.length > 0) && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                      {pmDbResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => assignPayrollManager(u)}
                          disabled={pmSaving}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm"
                        >
                          <span className="font-medium text-gray-800">{u.full_name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                        </button>
                      ))}
                      {pmSfResults.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 border-t border-purple-100">
                            SuccessFactors Results
                          </div>
                          {pmSfResults.map((u) => (
                            <button
                              key={u.sf_employee_id}
                              onClick={() => importAndAssignPm(u)}
                              disabled={pmSaving || pmImporting}
                              className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm flex items-center justify-between"
                            >
                              <span>
                                <span className="font-medium text-gray-800">{u.full_name}</span>
                                <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${u.inDb ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {u.inDb ? 'Assign' : 'Import & Assign'}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : payrollManager ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {payrollManager.approver.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{payrollManager.approver.full_name}</p>
                    <p className="text-xs text-gray-400">{payrollManager.approver.designation} &bull; {payrollManager.approver.email}</p>
                  </div>
                </div>
                <button
                  onClick={removePayrollManager}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No payroll manager assigned for this company.</p>
            )}
          </div>
        </div>

        {/* Sections */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No sections found
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => {
              const cellKey = (itemKey: string) => `${section.section_key}::${itemKey}`
              const isBulkOpen = bulkSection === section.section_key

              return (
                <div key={section.section_key} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800">{section.section_label}</h3>
                    <button
                      onClick={() => {
                        setBulkSection(isBulkOpen ? null : section.section_key)
                        setBulkUser(null)
                        setBulkQuery('')
                        setBulkResults([])
                        setBulkSfResults([])
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                      Bulk Assign Section
                    </button>
                  </div>

                  {/* Bulk assign panel */}
                  {isBulkOpen && (
                    <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-medium text-indigo-700">
                          Assign one person to ALL items in {section.section_label}:
                        </span>
                        <div className="relative flex-1 min-w-48">
                          <input
                            type="text"
                            value={bulkQuery}
                            onChange={(e) => searchBulkUsers(e.target.value)}
                            placeholder="Search by name or ID..."
                            className="w-full rounded-lg border border-indigo-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                          />
                          {(bulkResults.length > 0 || bulkSfResults.length > 0) && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                              {bulkResults.map((u) => (
                                <button
                                  key={u.id}
                                  onClick={() => { setBulkUser(u); setBulkQuery(u.full_name); setBulkResults([]); setBulkSfResults([]) }}
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm"
                                >
                                  <span className="font-medium text-gray-800">{u.full_name}</span>
                                  <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                                </button>
                              ))}
                              {bulkSfResults.length > 0 && (
                                <>
                                  <div className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border-t border-indigo-100">
                                    SuccessFactors Results
                                  </div>
                                  {bulkSfResults.map((u) => (
                                    <button
                                      key={u.sf_employee_id}
                                      onClick={() => importAndBulkAssign(u, section.section_key)}
                                      disabled={bulkSaving}
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center justify-between"
                                    >
                                      <span>
                                        <span className="font-medium text-gray-800">{u.full_name}</span>
                                        <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                                      </span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${u.inDb ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {u.inDb ? 'Assign' : 'Import & Assign'}
                                      </span>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Search SF button */}
                        <button
                          type="button"
                          onClick={() => searchBulkSF(bulkQuery)}
                          disabled={bulkSfLoading || bulkQuery.length < 2}
                          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          {bulkSfLoading ? 'Searching SF…' : 'Search SF'}
                        </button>
                        <Button
                          size="sm"
                          disabled={!bulkUser || bulkSaving}
                          loading={bulkSaving}
                          onClick={() => bulkAssign(section.section_key)}
                          className="bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                        >
                          Apply to All
                        </Button>
                        <button
                          onClick={() => { setBulkSection(null); setBulkError(null) }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                      {bulkError && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {bulkError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items table */}
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/5">Sub-Item</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Approver</th>
                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {section.items.map((item) => {
                        const ck = cellKey(item.item_key)
                        const isEditing = activeSearch === ck
                        const isSavingThis = saving === ck || importing === ck
                        const cellSfResults = sfResults[ck] ?? []
                        const cellDbResults = searchResults[ck] ?? []

                        return (
                          <tr key={item.item_key} className="hover:bg-gray-50/50">
                            <td className="px-5 py-3 text-gray-800 font-medium">{item.description}</td>
                            <td className="px-5 py-3">
                              {isEditing ? (
                                <div className="relative">
                                  <div className="flex gap-1.5">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={searchQuery[ck] ?? ''}
                                      onChange={(e) => {
                                        setSearchQuery((prev) => ({ ...prev, [ck]: e.target.value }))
                                        searchUsers(e.target.value, ck)
                                        setSfResults((prev) => ({ ...prev, [ck]: [] }))
                                      }}
                                      placeholder="Search by name or ID..."
                                      className="flex-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => searchSF(searchQuery[ck] ?? '', ck)}
                                      disabled={sfLoading[ck] || (searchQuery[ck] ?? '').length < 2}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                                    >
                                      {sfLoading[ck] ? '…' : 'SF'}
                                    </button>
                                  </div>
                                  {(cellDbResults.length > 0 || cellSfResults.length > 0) && (
                                    <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                                      {cellDbResults.map((u) => (
                                        <button
                                          key={u.id}
                                          onClick={() => assignApprover(section.section_key, item.item_key, u, ck)}
                                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm"
                                        >
                                          <span className="font-medium text-gray-800">{u.full_name}</span>
                                          <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                                        </button>
                                      ))}
                                      {cellSfResults.length > 0 && (
                                        <>
                                          <div className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border-t border-indigo-100">
                                            SuccessFactors Results
                                          </div>
                                          {cellSfResults.map((u) => (
                                            <button
                                              key={u.sf_employee_id}
                                              onClick={() => importAndAssign(u, section.section_key, item.item_key, ck)}
                                              disabled={isSavingThis}
                                              className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center justify-between"
                                            >
                                              <span>
                                                <span className="font-medium text-gray-800">{u.full_name}</span>
                                                <span className="text-gray-400 ml-2 text-xs">{u.designation}</span>
                                              </span>
                                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${u.inDb ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {u.inDb ? 'Assign' : 'Import & Assign'}
                                              </span>
                                            </button>
                                          ))}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : item.assignment ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {item.assignment.approver.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{item.assignment.approver.full_name}</p>
                                    <p className="text-xs text-gray-400">{item.assignment.approver.designation}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isEditing ? (
                                  <button
                                    onClick={() => { setActiveSearch(null); setSfResults((prev) => ({ ...prev, [ck]: [] })) }}
                                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveSearch(ck)
                                      setSearchQuery((prev) => ({ ...prev, [ck]: '' }))
                                      setSearchResults((prev) => ({ ...prev, [ck]: [] }))
                                      setSfResults((prev) => ({ ...prev, [ck]: [] }))
                                    }}
                                    disabled={isSavingThis}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors"
                                  >
                                    {item.assignment ? 'Change' : 'Assign'}
                                  </button>
                                )}
                                {item.assignment && !isEditing && (
                                  <button
                                    onClick={() => removeApprover(section.section_key, item.assignment!.item_key)}
                                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
