'use client'

import React, { useState } from 'react'
import { ClearanceSection } from '@/types'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'

interface HRBPInterventionProps {
  section: ClearanceSection
  clearanceId: string
  onRerouted: () => void
}

export default function HRBPIntervention({
  section,
  clearanceId,
  onRerouted,
}: HRBPInterventionProps) {
  const { token } = useAuth()
  const [resolutionNote, setResolutionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReroute = async () => {
    if (!token || !resolutionNote.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/clearance/${clearanceId}/reroute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: section.id,
          resolution_note: resolutionNote,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Re-routing failed')
      }
      onRerouted()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (section.status !== 'DENIED') return null

  return (
    <div className="space-y-4">
      {/* Alert header */}
      <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-200 px-4 py-4">
        <div className="shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-orange-800">
            HRBP Intervention Required
          </p>
          <p className="text-sm text-orange-700 mt-0.5">
            This section was denied by{' '}
            <span className="font-medium">
              {section.approver_name ?? 'the department approver'}
            </span>
            . Review the reason below and add a resolution note to re-route
            back to the department.
          </p>
        </div>
      </div>

      {/* Denial reason */}
      {section.note ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
            Denial Reason
          </p>
          <p className="text-sm text-red-800 leading-relaxed">{section.note}</p>
        </div>
      ) : (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600 italic">No denial reason provided.</p>
        </div>
      )}

      {/* Resolution note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Resolution Note{' '}
          <span className="text-red-500">*</span>
        </label>
        <textarea
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          rows={4}
          placeholder="Describe the resolution or instructions for the department approver..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none transition"
        />
        <p className="text-xs text-gray-400 mt-1">
          This note will be visible to the approver when the section is
          re-routed.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          className="bg-orange-500 text-white hover:bg-orange-600 border-transparent focus:ring-orange-400"
          loading={submitting}
          disabled={!resolutionNote.trim()}
          onClick={handleReroute}
        >
          Re-route to Department
        </Button>
      </div>
    </div>
  )
}
