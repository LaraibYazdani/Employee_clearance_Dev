'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function DashboardRedirect() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated || !user) {
      router.replace('/login')
      return
    }

    const roles = user.roles ?? []

    if (roles.includes('SUPER_ADMIN')) {
      router.replace('/admin')
    } else if (roles.includes('HRBP')) {
      router.replace('/dashboard/hrbp')
    } else if (roles.some((r) => r.startsWith('DEPT_APPROVER_'))) {
      router.replace('/dashboard/approver')
    } else {
      // EMPLOYEE or unknown role
      router.replace('/dashboard/hrbp')
    }
  }, [user, isLoading, isAuthenticated, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin h-8 w-8 text-indigo-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
