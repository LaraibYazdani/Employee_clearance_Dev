'use client'

import React, { useState, useMemo, useRef } from 'react'
import { ClearanceSection, ClearanceItem, ClearanceItemAttachment } from '@/types'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'

interface ItemRow extends ClearanceItem {
  localComments: string
  localDeductibleDescription: string
  localDeductibleAmount: string
  localAttachments: ClearanceItemAttachment[]
}

interface SectionActionFormProps {
  section: ClearanceSection
  clearanceId: string
  clearanceStatus: string
  showDeductibles: boolean
  onActionComplete: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Attachment panel for a single item
// ---------------------------------------------------------------------------
interface ItemAttachmentPanelProps {
  item: ItemRow
  clearanceId: string
  clearanceStatus: string
  onAttachmentAdded: (itemId: string, attachment: ClearanceItemAttachment) => void
  onAttachmentDeleted: (itemId: string, attachmentId: string) => void
}

function ItemAttachmentPanel({
  item,
  clearanceId,
  clearanceStatus,
  onAttachmentAdded,
  onAttachmentDeleted,
}: ItemAttachmentPanelProps) {
  const { token, user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isCompleted = clearanceStatus === 'COMPLETED'
  const canUpload = !isCompleted

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(
        `/api/clearance/${clearanceId}/items/${item.id}/attachments`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onAttachmentAdded(item.id, data as ClearanceItemAttachment)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId)
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Delete failed')
      }
      onAttachmentDeleted(item.id, attachmentId)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const handleView = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/attachments/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load file')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      alert('Could not open file. Please try again.')
    }
  }

  const canDeleteAttachment = (att: ClearanceItemAttachment) =>
    !isCompleted && (att.uploaded_by_id === user?.id || user?.roles.includes('SUPER_ADMIN'))

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      {item.localAttachments.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {item.localAttachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              {att.mime_type === 'application/pdf' ? (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              <span className="flex-1 truncate font-medium">{att.original_name}</span>
              <span className="text-gray-400 shrink-0">{formatBytes(att.file_size)}</span>
              {att.uploaded_by && (
                <span className="text-gray-400 shrink-0 hidden sm:inline">{att.uploaded_by.full_name}</span>
              )}
              <button
                type="button"
                onClick={() => handleView(att.id)}
                className="text-indigo-600 hover:text-indigo-800 shrink-0 transition-colors"
                title="View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              {canDeleteAttachment(att) && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  disabled={deletingId === att.id}
                  className="text-red-400 hover:text-red-600 shrink-0 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === att.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !canUpload && <p className="text-xs text-gray-400 italic mb-2">No attachments.</p>
      )}

      {canUpload && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Add attachment
              </>
            )}
          </button>
          <span className="text-xs text-gray-400">JPEG · PNG · GIF · WebP · PDF — max 10 MB</span>
        </div>
      )}

      {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export default function SectionActionForm({
  section,
  clearanceId,
  clearanceStatus,
  showDeductibles,
  onActionComplete,
}: SectionActionFormProps) {
  const { token, user } = useAuth()

  const [items, setItems] = useState<ItemRow[]>(
    (section.items ?? []).map((item) => ({
      ...item,
      localComments: item.comments ?? '',
      localDeductibleDescription: item.deductible_description ?? '',
      localDeductibleAmount: item.deductible_amount ?? '',
      localAttachments: item.attachments ?? [],
    }))
  )
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [savingDeductible, setSavingDeductible] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isCompleted = clearanceStatus === 'COMPLETED'
  const isApproved = section.status === 'APPROVED'
  const isDenied = section.status === 'DENIED'
  const isLocked = section.status === 'LOCKED'
  // Full read-only: section acted on OR clearance completed
  const isReadOnly = isApproved || isDenied || isLocked || isCompleted

  // Items visible to this user:
  // - Read-only views → show all (HRBP, payroll, employee reviewing an approved section)
  // - Active pending section with item-level assignments → only assigned items
  const visibleItems = useMemo(() => {
    if (!user) return items
    if (user.roles.includes('SUPER_ADMIN')) return items
    if (user.roles.includes('PAYROLL_MANAGER')) return items
    if (user.roles.includes('HRBP')) return items
    // For read-only views, show everything
    if (isReadOnly) return items
    const hasItemLevelAssignments = items.some(
      (item) => (item.assigned_approvers?.length ?? 0) > 0
    )
    if (!hasItemLevelAssignments) return items
    // Active pending section: only show items assigned to this user
    return items.filter((item) =>
      item.assigned_approvers?.some((a) => a.id === user.id)
    )
  }, [items, user, isReadOnly])

  const updateItemComments = (id: string, comments: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, localComments: comments } : item)))
  }

  const updateDeductibleDesc = (id: string, val: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, localDeductibleDescription: val } : item)))
  }

  const updateDeductibleAmount = (id: string, val: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, localDeductibleAmount: val } : item)))
  }

  const handleAttachmentAdded = (itemId: string, attachment: ClearanceItemAttachment) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, localAttachments: [...item.localAttachments, attachment] }
          : item
      )
    )
  }

  const handleAttachmentDeleted = (itemId: string, attachmentId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, localAttachments: item.localAttachments.filter((a) => a.id !== attachmentId) }
          : item
      )
    )
  }

  const toggleAttachments = (itemId: string) => {
    setExpandedAttachments((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  // Save deductible fields for a single item (post-approval edit)
  const saveDeductible = async (itemId: string) => {
    if (!token) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    setSavingDeductible(itemId)
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deductible_description: item.localDeductibleDescription || null,
          deductible_amount: item.localDeductibleAmount !== '' ? item.localDeductibleAmount : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save deductible')
    } finally {
      setSavingDeductible(null)
    }
  }

  // Determine if current user can edit deductible fields for a given item
  const canEditDeductible = (item: ItemRow): boolean => {
    if (isCompleted) return false
    if (!user) return false
    if (user.roles.includes('SUPER_ADMIN')) return true
    // Any of the assigned approvers can edit
    if (
      (item.assigned_approvers?.length ?? 0) > 0 &&
      item.assigned_approvers!.some((a) => a.id === user.id)
    ) return true
    // No item-level assignment: section-level approver owns all items
    if (!(item.assigned_approvers?.length) && section.approver_id === user.id) return true
    return false
  }

  const saveComments = async () => {
    if (!token) return
    setSavingDeductible('comments')
    setError(null)
    try {
      await Promise.all(
        visibleItems.map((item) =>
          fetch(`/api/clearance/${clearanceId}/items/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ comments: item.localComments }),
          })
        )
      )
      onActionComplete()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save comments')
    } finally {
      setSavingDeductible(null)
    }
  }

  const submitAction = async (action: 'APPROVE') => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      // Approve all visible items automatically
      const submitItems = visibleItems.map((i) => ({
        id: i.id,
        item_key: i.item_key,
        status: 'APPROVED',
        comments: i.localComments,
        deductible_description: i.localDeductibleDescription || null,
        deductible_amount: i.localDeductibleAmount !== '' ? i.localDeductibleAmount : null,
      }))

      const res = await fetch(`/api/clearance/${clearanceId}/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, items: submitItems }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Action failed')
      }
      onActionComplete()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const hasItemAssignments = items.some((i) => (i.assigned_approvers?.length ?? 0) > 0)
  // Show deductible columns: controlled by parent (based on role) or if item has show_deductibles flag
  const showDeductibleCol = showDeductibles || items.some((i) => i.show_deductibles)

  return (
    <div className="space-y-4">
      {/* Status info banner */}
      {isReadOnly && (
        <div
          className={[
            'rounded-lg px-4 py-3 text-sm border',
            isApproved
              ? 'bg-green-50 text-green-800 border-green-200'
              : isDenied
              ? 'bg-red-50 text-red-800 border-red-200'
              : isCompleted
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-gray-50 text-gray-600 border-gray-200',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 font-medium">
            <Badge status={isCompleted ? 'COMPLETED' : section.status} />
            <span>
              {isApproved && `Approved by ${section.approver_name ?? 'approver'}`}
              {isDenied && `Denied by ${section.approver_name ?? 'approver'}`}
              {isLocked && 'Waiting for previous sections to be completed'}
              {isCompleted && !isApproved && !isDenied && 'Clearance has been completed'}
            </span>
          </div>
          {section.note && (
            <p className="mt-1.5 text-xs opacity-80 italic">&ldquo;{section.note}&rdquo;</p>
          )}
        </div>
      )}

      {/* Assigned approver info */}
      {section.approver_name && !isReadOnly && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Assigned to <span className="font-medium text-gray-700">{section.approver_name}</span>
        </div>
      )}

      {/* Items table */}
      {visibleItems.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">
                  Checklist Item
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">
                  Comments
                </th>
                {showDeductibleCol && (
                  <>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[18%]">
                      Deductible Desc.
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[13%]">
                      Amt (PKR)
                    </th>
                  </>
                )}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">
                  Files
                </th>
                {hasItemAssignments && (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">
                    Assigned
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleItems.map((item) => {
                const editDeductible = canEditDeductible(item)
                const showItemDeductibles = showDeductibleCol && (showDeductibles || item.show_deductibles)
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={
                        item.status === 'APPROVED'
                          ? 'bg-green-50/40'
                          : item.status === 'NA'
                          ? 'bg-gray-50/60'
                          : ''
                      }
                    >
                      {/* Description */}
                      <td className="px-3 py-2.5 text-gray-800 align-middle font-medium text-xs">
                        {item.description}
                      </td>
                      {/* Comments */}
                      <td className="px-3 py-2.5 align-middle">
                        {isCompleted || isDenied || isLocked ? (
                          <span className="text-gray-600 text-xs">{item.localComments || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.localComments}
                            onChange={(e) => updateItemComments(item.id, e.target.value)}
                            placeholder="Add comments..."
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
                          />
                        )}
                      </td>
                      {/* Deductible fields */}
                      {showDeductibleCol && (
                        <>
                          <td className="px-3 py-2.5 align-middle">
                            {showItemDeductibles ? (
                              editDeductible && !isCompleted ? (
                                <input
                                  type="text"
                                  value={item.localDeductibleDescription}
                                  onChange={(e) => updateDeductibleDesc(item.id, e.target.value)}
                                  onBlur={() => isApproved && saveDeductible(item.id)}
                                  placeholder="e.g. Notice period"
                                  className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none"
                                />
                              ) : (
                                <span className="text-gray-600 text-xs">{item.localDeductibleDescription || '—'}</span>
                              )
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            {showItemDeductibles ? (
                              editDeductible && !isCompleted ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.localDeductibleAmount}
                                    onChange={(e) => updateDeductibleAmount(item.id, e.target.value)}
                                    onBlur={() => isApproved && saveDeductible(item.id)}
                                    placeholder="0.00"
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none"
                                  />
                                  {savingDeductible === item.id && (
                                    <svg className="w-3.5 h-3.5 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">
                                  {item.localDeductibleAmount ? `PKR ${Number(item.localDeductibleAmount).toLocaleString()}` : '—'}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        </>
                      )}
                      {/* Status */}
                      <td className="px-3 py-2.5 align-middle">
                        <Badge status={item.status} />
                      </td>
                      {/* Attachments toggle */}
                      <td className="px-3 py-2.5 align-middle">
                        <button
                          type="button"
                          onClick={() => toggleAttachments(item.id)}
                          className={[
                            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                            expandedAttachments.has(item.id)
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
                          ].join(' ')}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {item.localAttachments.length > 0
                            ? `${item.localAttachments.length}`
                            : '+'}
                        </button>
                      </td>
                      {/* Assigned to */}
                      {hasItemAssignments && (
                        <td className="px-3 py-2.5 text-xs text-gray-600 align-middle">
                          {(item.assigned_approvers?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.assigned_approvers!.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 truncate max-w-[80px]"
                                  title={a.name}
                                >
                                  {a.name.split(' ')[0]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                    {expandedAttachments.has(item.id) && (
                      <tr>
                        <td
                          colSpan={
                            2 +
                            (showDeductibleCol ? 2 : 0) +
                            1 +
                            1 +
                            (hasItemAssignments ? 1 : 0)
                          }
                          className="p-0"
                        >
                          <ItemAttachmentPanel
                            item={item}
                            clearanceId={clearanceId}
                            clearanceStatus={clearanceStatus}
                            onAttachmentAdded={handleAttachmentAdded}
                            onAttachmentDeleted={handleAttachmentDeleted}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          {items.some((item) => (item.assigned_approvers?.length ?? 0) > 0)
            ? 'No checklist items assigned to you for this section.'
            : 'No checklist items for this section.'}
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Single approve button — only when section is pending and user can act */}
      {!isReadOnly && visibleItems.length > 0 && (
        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => submitAction('APPROVE')}
            loading={submitting}
            className="bg-green-600 text-white hover:bg-green-700 border-transparent focus:ring-green-500"
          >
            Approve
          </Button>
        </div>
      )}

      {/* Save comments button — visible after approval until clearance is completed */}
      {isApproved && !isCompleted && visibleItems.length > 0 && (
        <div className="flex gap-3 pt-1">
          <Button
            onClick={saveComments}
            loading={savingDeductible === 'comments'}
            className="bg-indigo-600 text-white hover:bg-indigo-700 border-transparent focus:ring-indigo-500"
          >
            Save Comments
          </Button>
        </div>
      )}
    </div>
  )
}
