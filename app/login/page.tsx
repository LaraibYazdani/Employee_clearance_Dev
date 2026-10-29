'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { IS_TEST_SERVER } from '@/lib/site-config'

function getRoleRedirect(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return '/admin'
  if (roles.includes('HRBP')) return '/dashboard/hrbp'
  if (roles.includes('FINANCE_MANAGER')) return '/dashboard/hrbp'
  if (roles.some((r) => r.startsWith('DEPT_APPROVER_')) || roles.includes('LINE_MANAGER')) return '/dashboard/approver'
  return '/clearance'
}

export default function LoginPage() {
  const { login, loginWithToken, isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [iasLoading, setIasLoading] = useState(false)

  const handleIasLogin = async () => {
    setIasLoading(true)
    try {
      const res = await fetch('/api/auth/ias')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('SAP login is not configured. Please contact your administrator.')
        setIasLoading(false)
      }
    } catch {
      setError('Could not connect to SAP. Please try again.')
      setIasLoading(false)
    }
  }

  // Handle IAS callback token
  useEffect(() => {
    const iasToken = searchParams.get('ias_token')
    const iasError = searchParams.get('ias_error')
    if (iasError) {
      setError('SAP login failed. Please try again or use your Employee ID and password.')
      return
    }
    if (iasToken) {
      setSubmitting(true)
      loginWithToken(iasToken).then((result) => {
        if (!result.success) {
          setError(result.error ?? 'SAP login failed. Please try again.')
          setSubmitting(false)
        }
        // Success redirect handled by the authenticated useEffect below
      })
    }
  }, [searchParams, loginWithToken])

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace(getRoleRedirect(user.roles))
    }
  }, [isAuthenticated, isLoading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await login(email.trim(), password)

    if (!result.success) {
      setError(result.error ?? 'Invalid credentials. Please try again.')
      setSubmitting(false)
      return
    }

    // Redirect is handled by the useEffect above after user state updates
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/auth-bg.jpeg')" }}
      />
      {/* Blur + dark overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/40" />
      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-center">
          <div className="flex items-center justify-center h-12 w-12 mx-auto rounded-xl bg-white/20 mb-4">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">
            Packages Group
            {IS_TEST_SERVER && (
              <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">
                Testing
              </span>
            )}
          </h1>
          <p className="text-indigo-200 text-sm mt-1">Employee Clearance Portal</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Sign in to your account</h2>
          <p className="text-xs text-gray-500 mb-6">
            The login method has changed. Use the button below to sign in with your SAP SuccessFactors account.
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* SAP IAS SSO button — primary action */}
          <button
            type="button"
            onClick={handleIasLogin}
            disabled={iasLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#0070F2] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0060d0] transition-colors disabled:opacity-70"
          >
            {iasLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="4" fill="white" fillOpacity="0.2"/>
                <text x="4" y="17" fontSize="11" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">SAP</text>
              </svg>
            )}
            {iasLoading ? 'Redirecting to SAP...' : 'Sign in with SAP SuccessFactors'}
          </button>

          {/* Admin fallback — collapsed by default */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowAdminLogin((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mx-auto"
            >
              <svg className={`h-3 w-3 transition-transform ${showAdminLogin ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Admin / manual login
            </button>

            {showAdminLogin && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <Input
                  label="Employee ID or Email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. 10009673"
                  required
                  autoComplete="username"
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting}
                  className="w-full"
                >
                  Sign in
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-6 text-xs text-gray-300">
        &copy; {new Date().getFullYear()} Packages Group &mdash; All rights reserved
        {IS_TEST_SERVER && <> &mdash; Development/Testing Server</>}
      </p>
    </div>
  )
}
