'use client'

import React, { useState } from 'react'
import { ClearanceSection, ClearanceItem } from '@/types'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'

type ItemStatus = 'PENDING' | 'NA' | 'APPROVED' | 'FLAGGED'

interface ItemRow extends ClearanceItem {
  localStatus: ItemStatus
  localComments: string
}

interface SectionActionFormProps {
  section: ClearanceSection
  clearanceId: string
  onActionComplete: () => void
}

const itemStatusOptions: { value: ItemStatus; label: string }[] = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'NA', label: 'N/A' },
  { value: 'PENDING', label: 'Pending' },
]

export default function SectionActionForm({
  section,
  clearanceId,
  onActionComplete,
}: SectionActionFormProps) {
  const { token } = useAuth()

  const [items, setItems] = useState<ItemRow[]>(
    (section.items ?? []).map((item) => ({
      ...item,
      localStatus: item.status as ItemStatus,
      localComments: item.comments ?? '',
    }))
  )
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Deny modal state
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [denyComment, setDenyComment] = useState('')

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

  const submitAction = async (action: 'APPROVE' | 'DENY', comment?: string) => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/clearance/${clearanceId}/sections/${section.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            note: action === 'DENY' ? (comment ?? denyComment) : note,
            items: items.map((i) => ({
              id: i.id,
              status: i.localStatus,
              comments: i.localComments,
            })),
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Action failed')
      }
      setShowDenyModal(false)
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

  return (
    <div className="space-y-4">
      {/* Status info */}
      {isReadOnly && (
        <div
          className={[
            'rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2',
            isApproved
              ? 'bg-green-50 text-green-800 border border-green-200'
              : isDenied
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200',
          ].join(' ')}
        >
          <Badge status={section.status} />
          <span>
            {isApproved && `Section approved by ${section.approver_name ?? 'approver'}`}
            {isDenied && `Section denied by ${section.approver_name ?? 'approver'}`}
            {isLocked && 'Waiting for previous sections to be completed'}
          </span>
        </div>
      )}

      {/* Items table */}
      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/5">
                  Description
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/5">
                  Comments
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-800 align-top">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isReadOnly ? (
                      <span className="text-gray-600">{item.localComments || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.localComments}
                        onChange={(e) =>
                          updateItemComments(item.id, e.target.value)
                        }
                        placeholder="Add comments..."
                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
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
                                ? opt.value === 'APPROVED'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : opt.value === 'NA'
                                  ? 'bg-gray-400 text-white border-gray-400'
                                  : 'bg-yellow-400 text-white border-yellow-400'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          No checklist items for this section.
        </p>
      )}

      {/* Section note */}
      {!isReadOnly && (
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add a note for this section..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none transition"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => submitAction('APPROVE')}
            loading={submitting}
            className="bg-green-600 text-white hover:bg-green-700 border-transparent focus:ring-green-500"
          >
            Approve Section
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowDenyModal(true)}
            disabled={submitting}
          >
            Deny Section
          </Button>
        </div>
      )}

      {/* Deny modal */}
      {showDenyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Deny Section
            </h3>
            <p className="text-sm text-gray-600">
              Please provide a reason for denial. This will be visible to the
              HRBP.
            </p>
            <textarea
              value={denyComment}
              onChange={(e) => setDenyComment(e.target.value)}
              rows={4}
              placeholder="Reason for denial (required)..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none resize-none"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDenyModal(false)
                  setDenyComment('')
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={submitting}
                disabled={!denyComment.trim()}
                onClick={() => submitAction('DENY', denyComment)}
              >
                Confirm Denial
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
