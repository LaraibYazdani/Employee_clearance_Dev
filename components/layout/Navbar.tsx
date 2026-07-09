'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import NotificationBell from '@/components/ui/NotificationBell'
import { Notification } from '@/types'
import { IS_TEST_SERVER } from '@/lib/site-config'

function getRoleBadgeLabel(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return 'Super Admin'
  if (roles.includes('HRBP')) return 'HRBP'
  if (roles.some((r) => r.startsWith('DEPT_APPROVER_'))) {
    const key = roles.find((r) => r.startsWith('DEPT_APPROVER_'))
    return key ? key.replace('DEPT_APPROVER_', '') + ' Approver' : 'Approver'
  }
  if (roles.includes('EMPLOYEE')) return 'Employee'
  return 'User'
}

interface NavLinkProps {
  href: string
  label: string
  currentPath: string
}

function NavLink({ href, label, currentPath }: NavLinkProps) {
  const isActive = currentPath.startsWith(href)
  return (
    <Link
      href={href}
      className={[
        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}

export default function Navbar() {
  const { user, logout, token } = useAuth()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNotifications(data)
          setUnreadCount(data.filter((n: Notification) => !n.read).length)
        }
      })
      .catch(() => {})
  }, [token])

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }

  const roles = user?.roles ?? []
  const isSuperAdmin = roles.includes('SUPER_ADMIN')
  const isHRBP = roles.includes('HRBP')
  const isDeptApprover = roles.some((r) => r.startsWith('DEPT_APPROVER_'))

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-indigo-600 leading-none">Packages Group</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">
                Employee Clearance Portal
                {IS_TEST_SERVER && (
                  <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">
                    Test
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Nav links */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/dashboard" label="Dashboard" currentPath={pathname} />
              {isHRBP && (
                <NavLink href="/dashboard/hrbp/new" label="New Clearance" currentPath={pathname} />
              )}
              {isDeptApprover && (
                <NavLink href="/dashboard/approver" label="My Approvals" currentPath={pathname} />
              )}
              {isSuperAdmin && (
                <NavLink href="/admin" label="Admin Panel" currentPath={pathname} />
              )}
            </nav>
          )}

          {/* Right section */}
          {user && (
            <div className="flex items-center gap-2">
              {/* Notification bell */}
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={handleMarkRead}
                onViewAll={() => {}}
              />

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Avatar name={user.full_name} size="sm" />
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-800 leading-none">{user.full_name}</p>
                    <p className="text-xs text-gray-500 leading-none mt-0.5">{getRoleBadgeLabel(roles)}</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <div className="mt-1.5">
                        <Badge status={roles[0] ?? 'EMPLOYEE'} />
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
