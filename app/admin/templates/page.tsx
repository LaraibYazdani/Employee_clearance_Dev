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

interface ItemTemplate {
  id: string
  item_key: string
  description: string
  sort_order: number
}

interface SectionTemplate {
  id: string
  section_key: string
  label: string
  phase: number
  sort_order: number
  items: ItemTemplate[]
}

export default function ClearanceTemplatesPage() {
  const { token } = useAuth()
  const [selectedCompany, setSelectedCompany] = useState('1000')
  const [sections, setSections] = useState<SectionTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add section form state
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSection, setNewSection] = useState({
    section_key: '',
    label: '',
    phase: 2,
    sort_order: 0,
  })
  const [addingSec, setAddingSec] = useState(false)
  const [addSecError, setAddSecError] = useState<string | null>(null)

  // Add item form state (keyed by section id)
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ item_key: '', description: '', sort_order: 0 })
  const [addingItem, setAddingItem] = useState(false)
  const [addItemError, setAddItemError] = useState<string | null>(null)

  // Delete confirm state
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const fetchSections = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/templates?companyCode=${selectedCompany}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load templates')
      setSections(await res.json())
    } catch {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [token, selectedCompany])

  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  // ── Add section ─────────────────────────────────────────────────────────────
  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault()
    setAddingSec(true)
    setAddSecError(null)
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_code: selectedCompany,
          section_key: newSection.section_key.trim().toUpperCase(),
          label: newSection.label.trim(),
          phase: newSection.phase,
          sort_order: newSection.sort_order,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add section')
      setNewSection({ section_key: '', label: '', phase: 2, sort_order: 0 })
      setShowAddSection(false)
      await fetchSections()
    } catch (err: any) {
      setAddSecError(err.message)
    } finally {
      setAddingSec(false)
    }
  }

  // ── Delete section ───────────────────────────────────────────────────────────
  async function handleDeleteSection(id: string) {
    setDeletingSectionId(id)
    try {
      await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchSections()
    } finally {
      setDeletingSectionId(null)
    }
  }

  // ── Update section phase/sort ────────────────────────────────────────────────
  async function handleUpdateSection(id: string, patch: { phase?: number; sort_order?: number; label?: string }) {
    await fetch(`/api/admin/templates/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    })
    await fetchSections()
  }

  // ── Add item ─────────────────────────────────────────────────────────────────
  async function handleAddItem(e: React.FormEvent, sectionId: string) {
    e.preventDefault()
    setAddingItem(true)
    setAddItemError(null)
    try {
      const res = await fetch(`/api/admin/templates/${sectionId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_key: newItem.item_key.trim().toLowerCase().replace(/\s+/g, '_'),
          description: newItem.description.trim(),
          sort_order: newItem.sort_order,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add item')
      setNewItem({ item_key: '', description: '', sort_order: 0 })
      setAddingItemFor(null)
      await fetchSections()
    } catch (err: any) {
      setAddItemError(err.message)
    } finally {
      setAddingItem(false)
    }
  }

  // ── Delete item ──────────────────────────────────────────────────────────────
  async function handleDeleteItem(itemId: string) {
    setDeletingItemId(itemId)
    try {
      await fetch(`/api/admin/templates/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchSections()
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clearance Form Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage sections and checklist items per company. New clearances use these templates.
          </p>
        </div>

        {/* Company selector */}
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {Object.entries(COMPANY_CODES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
              No templates configured for this company.
              <br />
              New clearances will fall back to PL (1000) templates.
            </div>
          )}

          {sections.map((section) => (
            <div
              key={section.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Section header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {section.label}
                  </span>
                  <span className="rounded font-mono text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500">
                    {section.section_key}
                  </span>
                  {/* Phase toggle */}
                  <span
                    className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium ${
                      section.phase === 2
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                    title="Click to toggle phase"
                    onClick={() =>
                      handleUpdateSection(section.id, { phase: section.phase === 2 ? 3 : 2 })
                    }
                  >
                    Phase {section.phase}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setAddingItemFor(section.id)
                      setNewItem({ item_key: '', description: '', sort_order: section.items.length })
                      setAddItemError(null)
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add item
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    disabled={deletingSectionId === section.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {deletingSectionId === section.id ? 'Deleting…' : 'Delete section'}
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="divide-y divide-gray-50">
                {section.items.length === 0 && addingItemFor !== section.id && (
                  <p className="px-5 py-3 text-xs text-gray-400 italic">No items yet.</p>
                )}

                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-gray-400 shrink-0">{item.item_key}</span>
                      <span className="text-sm text-gray-700 truncate">{item.description}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingItemId === item.id}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0 disabled:opacity-50"
                    >
                      {deletingItemId === item.id ? '…' : 'Remove'}
                    </button>
                  </div>
                ))}

                {/* Add item inline form */}
                {addingItemFor === section.id && (
                  <form
                    onSubmit={(e) => handleAddItem(e, section.id)}
                    className="px-5 py-3 bg-indigo-50/50 space-y-2"
                  >
                    {addItemError && (
                      <p className="text-xs text-red-600">{addItemError}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        placeholder="item_key (e.g. laptop)"
                        value={newItem.item_key}
                        onChange={(e) => setNewItem({ ...newItem, item_key: e.target.value })}
                        className="flex-1 min-w-[140px] rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="flex-[2] min-w-[200px] rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={addingItem}>
                        {addingItem ? 'Adding…' : 'Add Item'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingItemFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}

          {/* Add section */}
          {showAddSection ? (
            <form
              onSubmit={handleAddSection}
              className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-3"
            >
              <p className="text-sm font-semibold text-gray-800">New Section</p>
              {addSecError && (
                <p className="text-xs text-red-600">{addSecError}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  placeholder="Section key (e.g. IT_DEPT)"
                  value={newSection.section_key}
                  onChange={(e) =>
                    setNewSection({ ...newSection, section_key: e.target.value })
                  }
                  className="flex-1 min-w-[160px] rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Label (e.g. IT Department)"
                  value={newSection.label}
                  onChange={(e) => setNewSection({ ...newSection, label: e.target.value })}
                  className="flex-[2] min-w-[200px] rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  required
                />
                <select
                  value={newSection.phase}
                  onChange={(e) =>
                    setNewSection({ ...newSection, phase: Number(e.target.value) })
                  }
                  className="rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value={2}>Phase 2 (concurrent)</option>
                  <option value={3}>Phase 3 (after phase 2)</option>
                </select>
                <input
                  type="number"
                  placeholder="Sort order"
                  value={newSection.sort_order}
                  onChange={(e) =>
                    setNewSection({ ...newSection, sort_order: Number(e.target.value) })
                  }
                  className="w-28 rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addingSec}>
                  {addingSec ? 'Adding…' : 'Add Section'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddSection(false)
                    setAddSecError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddSection(true)
                setNewSection({
                  section_key: '',
                  label: '',
                  phase: 2,
                  sort_order: sections.length,
                })
              }}
              className="w-full border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
            >
              + Add Section
            </Button>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
