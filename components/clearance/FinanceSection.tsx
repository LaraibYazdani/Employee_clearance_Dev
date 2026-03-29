'use client'

import React, { useState, useCallback } from 'react'
import { FinanceEntry } from '@/types'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { formatPKR } from '@/lib/utils'

type GroupKey = 'PAYABLES' | 'INVENTORY' | 'ERS' | 'PAYROLL_FUNDS'

const GROUP_LABELS: Record<GroupKey, string> = {
  PAYABLES: 'Payables',
  INVENTORY: 'Inventory',
  ERS: 'ERS',
  PAYROLL_FUNDS: 'Payroll & Funds',
}

const GROUP_ORDER: GroupKey[] = ['PAYABLES', 'INVENTORY', 'ERS', 'PAYROLL_FUNDS']

interface FinanceSectionProps {
  clearanceId: string
  entries: FinanceEntry[]
  isApprover: boolean
  sectionStatus: string
  onActionComplete?: () => void
}

interface LocalEntry extends FinanceEntry {
  localAmount: string
}

export default function FinanceSection({
  clearanceId,
  entries,
  isApprover,
  sectionStatus,
  onActionComplete,
}: FinanceSectionProps) {
  const { token } = useAuth()

  const [localEntries, setLocalEntries] = useState<LocalEntry[]>(
    entries.map((e) => ({
      ...e,
      localAmount: e.amount_pkr !== undefined && e.amount_pkr !== null
        ? String(e.amount_pkr)
        : '',
    }))
  )

  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const canEdit = isApprover && sectionStatus === 'PENDING'

  const updateAmount = (id: string, value: string) => {
    setLocalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, localAmount: value } : e))
    )
    setSaveSuccess(false)
  }

  const allAmountsFilled = localEntries.every(
    (e) => e.localAmount.trim() !== '' && !isNaN(Number(e.localAmount))
  )

  const buildPayload = () =>
    localEntries.map((e) => ({
      id: e.id,
      amount_pkr: e.localAmount !== '' ? Number(e.localAmount) : null,
    }))

  const handleSave = useCallback(async () => {
    if (!token) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/finance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: buildPayload(), action: 'SAVE' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Save failed')
      }
      setSaveSuccess(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [token, clearanceId, localEntries])

  const handleApprove = useCallback(async () => {
    if (!token) return
    setApproving(true)
    setApproveError(null)
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/finance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: buildPayload(), action: 'APPROVE' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Approval failed')
      }
      onActionComplete?.()
    } catch (err: unknown) {
      setApproveError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproving(false)
    }
  }, [token, clearanceId, localEntries, onActionComplete])

  const grouped = GROUP_ORDER.reduce<Record<GroupKey, LocalEntry[]>>(
    (acc, key) => {
      acc[key] = localEntries.filter((e) => e.section_group === key)
      return acc
    },
    { PAYABLES: [], INVENTORY: [], ERS: [], PAYROLL_FUNDS: [] }
  )

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map((groupKey) => {
        const groupEntries = grouped[groupKey]
        if (groupEntries.length === 0) return null
        return (
          <div key={groupKey}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {GROUP_LABELS[groupKey]}
            </h4>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                      GL Account
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-2/4">
                      Particulars
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/4">
                      Amount (PKR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {groupEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {entry.gl_account ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {entry.particulars}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            value={entry.localAmount}
                            onChange={(e) =>
                              updateAmount(entry.id, e.target.value)
                            }
                            placeholder="0"
                            className="w-full max-w-[140px] ml-auto rounded border border-gray-200 px-2 py-1 text-sm text-right text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
                          />
                        ) : (
                          <span className="text-gray-700 font-medium">
                            {entry.amount_pkr !== null &&
                            entry.amount_pkr !== undefined
                              ? formatPKR(entry.amount_pkr)
                              : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Save success */}
      {saveSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
          Amounts saved successfully.
        </div>
      )}

      {/* Errors */}
      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {approveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {approveError}
        </div>
      )}

      {/* Action buttons */}
      {canEdit && (
        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" loading={saving} onClick={handleSave}>
            Save Amounts
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700 border-transparent focus:ring-green-500"
            loading={approving}
            disabled={!allAmountsFilled || saving}
            onClick={handleApprove}
          >
            Approve Finance Section
          </Button>
        </div>
      )}

      {!canEdit && sectionStatus !== 'PENDING' && (
        <p className="text-xs text-gray-400 italic">
          Finance section is {sectionStatus.toLowerCase()}. No edits can be
          made.
        </p>
      )}
    </div>
  )
}
