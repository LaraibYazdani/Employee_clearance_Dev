'use client'

import React from 'react'
import { ClearanceSection } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatRelativeTime, getSectionLabel } from '@/lib/utils'

interface ApproverSummaryPanelProps {
  clearanceId: string
  sections: ClearanceSection[]
  onRefresh?: () => void
}

const borderColors: Record<string, string> = {
  PENDING: 'border-l-yellow-400',
  APPROVED: 'border-l-green-500',
  DENIED: 'border-l-red-500',
  LOCKED: 'border-l-gray-300',
}

const bgColors: Record<string, string> = {
  PENDING: 'bg-yellow-50',
  APPROVED: 'bg-green-50',
  DENIED: 'bg-red-50',
  LOCKED: 'bg-gray-50',
}

export default function ApproverSummaryPanel({
  sections,
  onRefresh,
}: ApproverSummaryPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Section Progress</h3>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        )}
      </div>

      {/* Section list */}
      <div className="divide-y divide-gray-100">
        {sections.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No sections found.
          </p>
        )}
        {sections.map((section) => {
          const border = borderColors[section.status] ?? 'border-l-gray-200'
          const bg = bgColors[section.status] ?? 'bg-gray-50'
          return (
            <div
              key={section.id}
              className={[
                'px-4 py-3 border-l-4 transition-colors',
                border,
                bg,
              ].join(' ')}
            >
              {/* Section name + badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate block">
                    {section.label || getSectionLabel(section.section_key)}
                  </span>
                  {section.approver_name && (
                    <span className="text-xs text-gray-500 truncate block mt-0.5">
                      {section.approver_name}
                    </span>
                  )}
                </div>
                <Badge status={section.status} />
              </div>

              {/* Timestamp */}
              {(section.status === 'APPROVED' || section.status === 'DENIED') &&
                section.decision_at && (
                  <div className="mt-1.5 text-xs text-gray-500">
                    <p>{formatRelativeTime(section.decision_at)}</p>
                  </div>
                )}

              {/* Note */}
              {section.note && (
                <p className="mt-1.5 text-xs text-gray-500 italic leading-relaxed">
                  &quot;{section.note}&quot;
                </p>
              )}

              {/* Lock icon */}
              {section.status === 'LOCKED' && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Awaiting previous sections
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
