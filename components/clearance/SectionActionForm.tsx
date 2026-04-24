'use client'

import React, { useState, useMemo, useRef } from 'react'
import { ClearanceSection, ClearanceItem, ClearanceItemAttachment } from '@/types'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'

type ItemStatus = 'PENDING' | 'NA' | 'APPROVED' | 'FLAGGED'

interface ItemRow extends ClearanceItem {
  localStatus: ItemStatus
  localComments: string
  localAttachments: ClearanceItemAttachment[]
}

interface SectionActionFormProps {
  section: ClearanceSection
  clearanceId: string
  onActionComplete: () => void
}

const itemStatusOptions: { value: ItemStatus; label: string; color: string }[] = [
  { value: 'APPROVED', label: 'Approved', color: 'bg-green-500 text-white border-green-500' },
]

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
  isReadOnly: boolean
  onAttachmentAdded: (itemId: string, attachment: ClearanceItemAttachment) => void
  onAttachmentDeleted: (itemId: string, attachmentId: string) => void
}

function ItemAttachmentPanel({
  item,
  clearanceId,
  isReadOnly,
  onAttachmentAdded,
  onAttachmentDeleted,
}: ItemAttachmentPanelProps) {
  const { token, user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canUpload = !isReadOnly && item.localStatus !== 'APPROVED'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected after deletion
    e.target.value = ''

    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(
        `/api/clearance/${clearanceId}/items/${item.id}/attachments`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
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
      const res = await fetch(
        `/api/clearance/${clearanceId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
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

  const handleView = (attachmentId: string) => {
    window.open(
      `/api/clearance/${clearanceId}/attachments/${attachmentId}`,
      '_blank'
    )
  }

  const canDeleteAttachment = (att: ClearanceItemAttachment) =>
    item.localStatus !== 'APPROVED' && (att.uploaded_by_id === user?.id || user?.roles.includes('SUPER_ADMIN'))

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      {/* Existing attachments */}
      {item.localAttachments.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {item.localAttachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              {/* Icon */}
              {att.mime_type === 'application/pdf' ? (
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {/* Name + size */}
              <span className="flex-1 truncate font-medium">{att.original_name}</span>
              <span className="text-gray-400 shrink-0">{formatBytes(att.file_size)}</span>
              {att.uploaded_by && (
                <span className="text-gray-400 shrink-0 hidden sm:inline">
                  {att.uploaded_by.full_name}
                </span>
              )}
              {/* View */}
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
              {/* Delete */}
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
        !canUpload && (
          <p className="text-xs text-gray-400 italic mb-2">No attachments.</p>
        )
      )}

      {/* Upload button */}
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

      {uploadError && (
        <p className="mt-2 text-xs text-red-600">{uploadError}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export default function SectionActionForm({
  section,
  clearanceId,
  onActionComplete,
}: SectionActionFormProps) {
  const { token, user } = useAuth()

  const [items, setItems] = useState<ItemRow[]>(
    (section.items ?? []).map((item) => ({
      ...item,
      localStatus: item.status as ItemStatus,
      localComments: item.comments ?? '',
      localAttachments: item.attachments ?? [],
    }))
  )
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleItems = useMemo(() => {
    if (!user) return items
    // Super admins always see everything
    if (user.roles.includes('SUPER_ADMIN')) return items
    const hasItemLevelAssignments = items.some((item) => item.assigned_approver_id)
    if (!hasItemLevelAssignments) return items
    // Show items assigned to this user; items with no assignment are also shown
    return items.filter(
      (item) => !item.assigned_approver_id || item.assigned_approver_id === user.id
    )
  }, [items, user])

  const updateItemStatus = (id: string, status: ItemStatus) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, localStatus: status } : item))
    )
  }

  const updateItemComments = (id: string, comments: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, localComments: comments } : item))
    )
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
          ? {
              ...item,
              localAttachments: item.localAttachments.filter((a) => a.id !== attachmentId),
            }
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

  const submitAction = async (action: 'APPROVE') => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      const visibleItemIds = new Set(visibleItems.map((i) => i.id))
      const submitItems = items
        .filter((i) => visibleItemIds.has(i.id))
        .map((i) => ({ id: i.id, item_key: i.item_key, status: i.localStatus, comments: i.localComments }))

      const res = await fetch(`/api/clearance/${clearanceId}/sections/${section.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

  const isApproved = section.status === 'APPROVED'
  const isDenied = section.status === 'DENIED'
  const isLocked = section.status === 'LOCKED'
  const isReadOnly = isApproved || isDenied || isLocked

  const hasAttachmentColumn = true // always show the column

  return (
    <div className="space-y-4">
      {/* Status info */}
      {isReadOnly && (
        <div
          className={[
            'rounded-lg px-4 py-3 text-sm border',
            isApproved
              ? 'bg-green-50 text-green-800 border-green-200'
              : isDenied
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-gray-50 text-gray-600 border-gray-200',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 font-medium">
            <Badge status={section.status} />
            <span>
              {isApproved && `Approved by ${section.approver_name ?? 'approver'}`}
              {isDenied && `Denied by ${section.approver_name ?? 'approver'}`}
              {isLocked && 'Waiting for previous sections to be completed'}
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
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/5">
                  Checklist Item
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/5">
                  Comments
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Result
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Attachments
                </th>
                {items.some((item) => item.assigned_approver_id) && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Assigned To
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleItems.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className={
                      item.localStatus === 'APPROVED'
                        ? 'bg-green-50/40'
                        : item.localStatus === 'NA'
                        ? 'bg-gray-50/60'
                        : ''
                    }
                  >
                    {/* Description */}
                    <td className="px-4 py-3 text-gray-800 align-middle font-medium">
                      {item.description}
                    </td>
                    {/* Comments */}
                    <td className="px-4 py-3 align-middle">
                      {isReadOnly ? (
                        <span className="text-gray-600">{item.localComments || '—'}</span>
                      ) : (
                        <input
                          type="text"
                          value={item.localComments}
                          onChange={(e) => updateItemComments(item.id, e.target.value)}
                          placeholder="Add comments..."
                          className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
                        />
                      )}
                    </td>
                    {/* Result */}
                    <td className="px-4 py-3 align-middle">
                      {isReadOnly ? (
                        <Badge status={item.localStatus} />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {itemStatusOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateItemStatus(item.id, opt.value)}
                              className={[
                                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                item.localStatus === opt.value
                                  ? opt.color
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
                              ].join(' ')}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    {/* Attachments toggle */}
                    <td className="px-4 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => toggleAttachments(item.id)}
                        className={[
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          expandedAttachments.has(item.id)
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
                        ].join(' ')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {item.localAttachments.length > 0
                          ? `${item.localAttachments.length} file${item.localAttachments.length > 1 ? 's' : ''}`
                          : 'Attach'}
                      </button>
                    </td>
                    {/* Assigned to */}
                    {items.some((i) => i.assigned_approver_id) && (
                      <td className="px-4 py-3 text-xs text-gray-600 align-middle">
                        {item.assigned_approver_name ? (
                          <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                            {item.assigned_approver_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Not assigned</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* Attachment panel — spans all columns */}
                  {expandedAttachments.has(item.id) && (
                    <tr>
                      <td
                        colSpan={
                          4 + (items.some((i) => i.assigned_approver_id) ? 1 : 0)
                        }
                        className="p-0"
                      >
                        <ItemAttachmentPanel
                          item={item}
                          clearanceId={clearanceId}
                          isReadOnly={isReadOnly}
                          onAttachmentAdded={handleAttachmentAdded}
                          onAttachmentDeleted={handleAttachmentDeleted}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          {items.some((item) => item.assigned_approver_id)
            ? 'No checklist items assigned to you for this section.'
            : 'No checklist items for this section.'}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {!isReadOnly && visibleItems.length > 0 && (
        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => submitAction('APPROVE')}
            loading={submitting}
            className="bg-green-600 text-white hover:bg-green-700 border-transparent focus:ring-green-500"
          >
            Approve Section
          </Button>
        </div>
      )}
    </div>
  )
}
