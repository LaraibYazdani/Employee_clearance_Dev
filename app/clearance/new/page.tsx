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
  date_of_leaving: string
  laptop_buyback: string
  vehicle_loan: string
  sim_transfer: string
  exit_interview: string
  other_query: string
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
interface SFResult {
  userId: string   // mapped from sf_employee_id in response
  displayName: string
  full_name: string
  email: string
  title: string
  designation: string
  payGrade: string
  department: string
  division: string
  inDb: boolean
  dbId: string | null
}

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

  // SF fallback state
  const [sfResults, setSfResults] = useState<SFResult[]>([])
  const [sfSearching, setSfSearching] = useState(false)
  const [sfError, setSfError] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [showSf, setShowSf] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !token) {
        setResults([])
        setOpen(false)
        setShowSf(false)
        setSfResults([])
        return
      }
      setSearching(true)
      setShowSf(false)
      setSfResults([])
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const users = Array.isArray(data) ? data : (data.users ?? [])
          setResults(users)
          setOpen(true)
        }
      } finally {
        setSearching(false)
      }
    },
    [token]
  )

  const searchSF = async () => {
    if (!query.trim() || !token) return
    setSfSearching(true)
    setSfResults([])
    setShowSf(true)
    try {
      const res = await fetch(`/api/clearance/employee-search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        // Normalize sf_employee_id → userId for internal use
        const normalized = (Array.isArray(data) ? data : []).map((u: any) => ({
          ...u,
          userId: u.sf_employee_id,
          displayName: u.full_name,
        }))
        setSfResults(normalized)
      }
    } catch { /* ignore */ }
    finally {
      setSfSearching(false)
    }
  }

  const importAndSelect = async (sf: SFResult) => {
    if (!token) return
    setImporting(sf.userId)
    try {
      let dbId = sf.dbId
      if (!sf.inDb) {
        const importRes = await fetch('/api/clearance/employee-search', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sf_user_id: sf.userId }),
        })
        if (!importRes.ok) return
        const data = await importRes.json()
        dbId = data.user.id
      }
      // Fetch the full user record from DB and select it
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(sf.userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const users: User[] = await res.json()
        const found = users.find((u) => u.id === dbId) ?? users[0]
        if (found) { onSelect(found); setQuery(found.full_name); setShowSf(false) }
      }
    } catch { /* ignore */ }
    finally {
      setImporting(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setShowSf(false)
    setSfResults([])
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

  const noDbResults = !searching && query.trim() && results.length === 0

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

      {/* DB results dropdown */}
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

      {/* No DB results — offer SF search */}
      {noDbResults && !showSf && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Not found in portal — search SuccessFactors?
          </span>
          <button
            type="button"
            onClick={searchSF}
            className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search SF
          </button>
        </div>
      )}

      {/* SF results */}
      {showSf && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-2 border-b border-amber-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              SuccessFactors Results
            </span>
            {sfSearching && (
              <svg className="animate-spin w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
          {sfError && (
            <p className="px-4 py-3 text-sm text-red-600">{sfError}</p>
          )}
          {!sfSearching && !sfError && sfResults.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500 text-center">No results in SuccessFactors.</p>
          )}
          {sfResults.map((sf) => (
            <div key={sf.userId} className="flex items-center justify-between px-4 py-3 border-b border-amber-100 last:border-0 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-900">{sf.displayName || sf.full_name}</p>
                <p className="text-xs text-gray-500">{sf.userId} &bull; {sf.designation || sf.department || '—'}</p>
              </div>
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${sf.inDb ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {sf.inDb ? 'In Portal' : 'SF Only'}
              </span>
              <button
                type="button"
                disabled={importing === sf.userId}
                onClick={() => importAndSelect(sf)}
                className="ml-3 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
              >
                {importing === sf.userId ? 'Importing...' : sf.inDb ? 'Select' : 'Import & Select'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Yes / No / NA toggle
───────────────────────────────────────────── */
function YesNoNa({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const options = ['YES', 'NO', 'NA']
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = value === opt
          const activeClass =
            opt === 'YES'
              ? 'bg-green-600 text-white border-green-600'
              : opt === 'NO'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-gray-500 text-white border-gray-500'
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={[
                'px-5 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                active ? activeClass : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {opt}
            </button>
          )
        })}
      </div>
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
  const { token, user } = useAuth()

  const [step, setStep] = useState(1)
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null)
  const [formData, setFormData] = useState<FormData>({
    issued_by: '',
    date_of_leaving: '',
    laptop_buyback: '',
    vehicle_loan: '',
    sim_transfer: '',
    exit_interview: '',
    other_query: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [hrbpError, setHrbpError] = useState<string | null>(null)

  // Autofill issued_by once auth resolves
  useEffect(() => {
    if (user?.full_name) {
      setFormData((prev) => ({ ...prev, issued_by: user.full_name }))
    }
  }, [user?.full_name])

  const setField = (field: keyof FormData) => (value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const canContinueStep2 =
    formData.issued_by.trim() !== '' &&
    formData.date_of_leaving !== '' &&
    formData.laptop_buyback !== '' &&
    formData.vehicle_loan !== '' &&
    formData.sim_transfer !== '' &&
    formData.exit_interview !== ''

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
          dateOfLeaving: formData.date_of_leaving || undefined,
          laptopBuyback: formData.laptop_buyback || undefined,
          vehicleLoan: formData.vehicle_loan || undefined,
          simTransfer: formData.sim_transfer || undefined,
          exitInterview: formData.exit_interview || undefined,
          otherQuery: formData.other_query || undefined,
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
                setHrbpError(null)
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
              {hrbpError && (
                <div className="mt-4 max-w-xl mx-auto rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {hrbpError}
                </div>
              )}
              <div className="flex justify-end mt-8 max-w-xl mx-auto">
                <Button
                  disabled={!selectedEmployee}
                  loading={verifying}
                  onClick={async () => {
                    if (!selectedEmployee || !token) return
                    setVerifying(true)
                    setHrbpError(null)
                    try {
                      const res = await fetch(
                        `/api/clearance/verify-hrbp?employeeId=${selectedEmployee.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      )
                      const data = await res.json()
                      if (!res.ok || data.allowed === false) {
                        setHrbpError(data.message ?? 'You are not authorised to initiate clearance for this employee.')
                        return
                      }
                      setStep(2)
                    } catch {
                      setHrbpError('Unable to verify HRBP status. Please try again.')
                    } finally {
                      setVerifying(false)
                    }
                  }}
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
                  <ReadonlyField label="Employee #" value={selectedEmployee.sf_employee_id} />
                  <ReadonlyField label="Full Name" value={selectedEmployee.full_name} />
                  <ReadonlyField label="Grade" value={selectedEmployee.grade} />
                  <ReadonlyField label="Designation" value={selectedEmployee.designation} />
                  <ReadonlyField label="Department" value={selectedEmployee.department} />
                  <ReadonlyField label="Division" value={selectedEmployee.division} />
                  <ReadonlyField label="Company" value={selectedEmployee.company} />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Employee queries */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">
                  Employee Queries
                </h4>
                <div className="space-y-5">
                  <YesNoNa
                    label="Does the employee wish to buyback the laptop?"
                    value={formData.laptop_buyback}
                    onChange={setField('laptop_buyback')}
                  />
                  <YesNoNa
                    label="Does the employee wish to settle their Vehicle Loan?"
                    value={formData.vehicle_loan}
                    onChange={setField('vehicle_loan')}
                  />
                  <YesNoNa
                    label="Does the employee want to transfer their company provided SIM card to their name?"
                    value={formData.sim_transfer}
                    onChange={setField('sim_transfer')}
                  />
                  <YesNoNa
                    label="Has the Exit Interview been conducted?"
                    value={formData.exit_interview}
                    onChange={setField('exit_interview')}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Please mention any other query
                    </label>
                    <textarea
                      value={formData.other_query}
                      onChange={(e) => setField('other_query')(e.target.value)}
                      rows={3}
                      placeholder="Optional — write any additional queries here..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Clearance details */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Clearance Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Issued By"
                    value={formData.issued_by}
                    onChange={setField('issued_by')}
                    required
                  />
                  <InputField
                    label="Date of Leaving"
                    type="date"
                    value={formData.date_of_leaving}
                    onChange={setField('date_of_leaving')}
                    required
                  />
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
                  Employee Queries
                </h4>
                <SummaryRow label="Laptop Buyback" value={formData.laptop_buyback} />
                <SummaryRow label="Vehicle Loan" value={formData.vehicle_loan} />
                <SummaryRow label="SIM Transfer" value={formData.sim_transfer} />
                <SummaryRow label="Exit Interview" value={formData.exit_interview} />
                {formData.other_query && (
                  <SummaryRow label="Other Query" value={formData.other_query} />
                )}
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Clearance Details
                </h4>
                <SummaryRow label="Issued By" value={formData.issued_by} />
                <SummaryRow
                  label="Date of Leaving"
                  value={formData.date_of_leaving ? formatDatePKT(formData.date_of_leaving) : undefined}
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
