'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { User } from '@/types'
import { formatDatePKT } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface FormData {
  issued_by: string
  issuance_date: string
  receiving_date: string
  date_of_leaving: string
}

/* ─────────────────────────────────────────────
   Step indicator
───────────────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  const steps = ['Employee Search', 'Review & Fill', 'Confirm & Submit']
  return (
    <ol className="flex items-center w-full mb-8">
      {steps.map((label, idx) => {
        const step = idx + 1
        const done = current > step
        const active = current === step
        return (
          <li
            key={step}
            className={[
              'flex items-center',
              idx < steps.length - 1
                ? 'flex-1 after:content-[""] after:flex-1 after:h-0.5 after:mx-2 after:border-t-2 ' +
                  (done
                    ? 'after:border-indigo-400'
                    : 'after:border-gray-200')
                : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                  done
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : active
                    ? 'bg-white border-indigo-600 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-400',
                ].join(' ')}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </span>
              <span
                className={[
                  'text-sm font-medium hidden sm:block',
                  active ? 'text-indigo-700' : done ? 'text-indigo-400' : 'text-gray-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ─────────────────────────────────────────────
   Step 1: Employee Search
───────────────────────────────────────────── */
function EmployeeSearch({
  token,
  onSelect,
}: {
  token: string | null
  onSelect: (emp: User) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !token) {
        setResults([])
        setOpen(false)
        return
      }
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setResults(Array.isArray(data) ? data : (data.users ?? []))
          setOpen(true)
        }
      } finally {
        setSearching(false)
      }
    },
    [token]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative max-w-xl mx-auto">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Search Employee by Name or Employee ID
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Type name or employee ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none transition"
        />
        {searching && (
          <span className="absolute inset-y-0 right-3 flex items-center">
            <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((emp) => (
            <li key={emp.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex flex-col gap-0.5"
                onClick={() => {
                  onSelect(emp)
                  setQuery(emp.full_name)
                  setOpen(false)
                }}
              >
                <span className="font-medium text-gray-900 text-sm">{emp.full_name}</span>
                <span className="text-xs text-gray-500">
                  {emp.sf_employee_id} &bull; {emp.department ?? 'N/A'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && !searching && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-4 text-sm text-gray-500 text-center">
          No employees found for "{query}"
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Field display helper
───────────────────────────────────────────── */
function ReadonlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </span>
      <span className="block text-sm font-medium text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 min-h-[2.25rem]">
        {value || '—'}
      </span>
    </div>
  )
}

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Summary Row
───────────────────────────────────────────── */
function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex py-2 border-b border-gray-100 last:border-0">
      <span className="w-48 text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function InitiateClearancePage() {
  const router = useRouter()
  const { token } = useAuth()

  const [step, setStep] = useState(1)
  // Extended user type that may include date_of_leaving from the clearance context
  const [selectedEmployee, setSelectedEmployee] = useState<(User & { date_of_leaving?: string }) | null>(null)
  const [formData, setFormData] = useState<FormData>({
    issued_by: '',
    issuance_date: '',
    receiving_date: '',
    date_of_leaving: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = (field: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const canContinueStep2 =
    formData.issued_by.trim() !== '' &&
    formData.issuance_date !== '' &&
    formData.receiving_date !== '' &&
    (selectedEmployee?.date_of_leaving || formData.date_of_leaving) !== ''

  const handleSubmit = async () => {
    if (!selectedEmployee || !token) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/clearance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          issuedBy: formData.issued_by,
          issuanceDate: formData.issuance_date || undefined,
          receivingDate: formData.receiving_date || undefined,
          dateOfLeaving:
            formData.date_of_leaving || selectedEmployee.date_of_leaving,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Submission failed')
      }
      const data = await res.json()
      const newId = data.id ?? data.clearance?.id
      router.push(`/clearance/${newId}`)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const effectiveDOL =
    formData.date_of_leaving || (selectedEmployee as any)?.date_of_leaving

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Initiate New Clearance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete all steps to create an employee exit clearance request
          </p>
        </div>

        <StepIndicator current={step} />

        {/* Step 1 */}
        {step === 1 && (
          <Card title="Step 1: Search Employee">
            <div className="py-6">
              <EmployeeSearch token={token} onSelect={(emp) => {
                setSelectedEmployee(emp)
              }} />
              {selectedEmployee && (
                <div className="mt-6 max-w-xl mx-auto p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
                  <p className="font-semibold">{selectedEmployee.full_name}</p>
                  <p className="text-indigo-600">
                    {selectedEmployee.sf_employee_id} &bull;{' '}
                    {selectedEmployee.department}
                  </p>
                </div>
              )}
              <div className="flex justify-end mt-8 max-w-xl mx-auto">
                <Button
                  disabled={!selectedEmployee}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && selectedEmployee && (
          <Card title="Step 2: Review &amp; Fill Details">
            <div className="space-y-6">
              {/* Read-only employee info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Employee Information (from SAP / SF)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <ReadonlyField
                    label="Employee #"
                    value={selectedEmployee.sf_employee_id}
                  />
                  <ReadonlyField
                    label="Full Name"
                    value={selectedEmployee.full_name}
                  />
                  <ReadonlyField label="Grade" value={selectedEmployee.grade} />
                  <ReadonlyField
                    label="Designation"
                    value={selectedEmployee.designation}
                  />
                  <ReadonlyField
                    label="Department"
                    value={selectedEmployee.department}
                  />
                  <ReadonlyField
                    label="Division"
                    value={selectedEmployee.division}
                  />
                  <ReadonlyField
                    label="Company"
                    value={selectedEmployee.company}
                  />
                  <ReadonlyField
                    label="Date of Leaving (SF)"
                    value={(selectedEmployee as any).date_of_leaving
                      ? formatDatePKT((selectedEmployee as any).date_of_leaving)
                      : undefined}
                  />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* HRBP fill-in fields */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Clearance Details (filled by HRBP)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Issued By"
                    value={formData.issued_by}
                    onChange={setField('issued_by')}
                    required
                  />
                  <InputField
                    label="Issuance Date"
                    type="date"
                    value={formData.issuance_date}
                    onChange={setField('issuance_date')}
                    required
                  />
                  <InputField
                    label="Receiving Date"
                    type="date"
                    value={formData.receiving_date}
                    onChange={setField('receiving_date')}
                    required
                  />
                  {!(selectedEmployee as any).date_of_leaving && (
                    <InputField
                      label="Date of Leaving"
                      type="date"
                      value={formData.date_of_leaving}
                      onChange={setField('date_of_leaving')}
                      required
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={!canContinueStep2} onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && selectedEmployee && (
          <Card title="Step 3: Confirm &amp; Submit">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please review all information before submitting. A clearance
                workflow will be initiated immediately upon submission.
              </p>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Employee Details
                </h4>
                <SummaryRow label="Full Name" value={selectedEmployee.full_name} />
                <SummaryRow label="Employee #" value={selectedEmployee.sf_employee_id} />
                <SummaryRow label="Grade" value={selectedEmployee.grade} />
                <SummaryRow label="Designation" value={selectedEmployee.designation} />
                <SummaryRow label="Department" value={selectedEmployee.department} />
                <SummaryRow label="Division" value={selectedEmployee.division} />
                <SummaryRow label="Company" value={selectedEmployee.company} />
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Clearance Details
                </h4>
                <SummaryRow label="Issued By" value={formData.issued_by} />
                <SummaryRow
                  label="Issuance Date"
                  value={formData.issuance_date ? formatDatePKT(formData.issuance_date) : undefined}
                />
                <SummaryRow
                  label="Receiving Date"
                  value={formData.receiving_date ? formatDatePKT(formData.receiving_date) : undefined}
                />
                <SummaryRow
                  label="Date of Leaving"
                  value={effectiveDOL ? formatDatePKT(effectiveDOL) : undefined}
                />
              </div>

              {submitError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button loading={submitting} onClick={handleSubmit}>
                  Submit Clearance
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
