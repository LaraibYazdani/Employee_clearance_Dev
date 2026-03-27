'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { Notification } from '@/types'
import { formatRelativeTime } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Icon by notification type
───────────────────────────────────────────── */
function NotifIcon({ type }: { type: string }) {
  const base = 'w-5 h-5'
  if (type.includes('DENIED') || type.includes('REJECTION')) {
    return (
      <svg className={`${base} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (type.includes('APPROVED') || type.includes('COMPLETED')) {
    return (
      <svg className={`${base} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (type.includes('INTERVENE') || type.includes('HRBP')) {
    return (
      <svg className={`${base} text-orange-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    )
  }
  // Default: bell
  return (
    <svg className={`${base} text-indigo-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Single notification row
───────────────────────────────────────────── */
function NotifRow({
  notif,
  onRead,
}: {
  notif: Notification
  onRead: (id: string) => void
}) {
  const router = useRouter()

  return (
    <div
      className={[
        'flex items-start gap-4 px-4 py-4 transition-colors hover:bg-gray-50',
        !notif.read ? 'bg-indigo-50/50' : '',
      ].join(' ')}
    >
      {/* Unread dot */}
      <div className="shrink-0 mt-0.5 relative">
        <div className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <NotifIcon type={notif.type} />
        </div>
        {!notif.read && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            'text-sm leading-relaxed',
            !notif.read ? 'font-medium text-gray-900' : 'text-gray-700',
          ].join(' ')}
        >
          {notif.message}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatRelativeTime(notif.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {notif.clearance_request_id && (
          <button
            onClick={() => {
              onRead(notif.id)
              router.push(`/clearance/${notif.clearance_request_id}`)
            }}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
          >
            View Clearance
          </button>
        )}
        {!notif.read && (
          <button
            onClick={() => onRead(notif.id)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
          >
            Mark read
          </button>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */
function NotifSkeleton() {
  return (
    <div className="animate-pulse flex items-start gap-4 px-4 py-4">
      <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function NotificationsPage() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  )

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : (data.notifications ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(
    async (notifId: string) => {
      if (!token) return
      // Optimistically update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      )
      try {
        await fetch(`/api/notifications/${notifId}/read`, {
          method: 'PATCH',
          headers: authHeaders(),
        })
      } catch {
        // revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, read: false } : n))
        )
      }
    },
    [token, authHeaders]
  )

  const markAllAsRead = useCallback(async () => {
    if (!token) return
    setMarkingAll(true)
    const prev = [...notifications]
    setNotifications((n) => n.map((item) => ({ ...item, read: true })))
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: authHeaders(),
      })
    } catch {
      setNotifications(prev)
    } finally {
      setMarkingAll(false)
    }
  }, [token, authHeaders, notifications])

  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)
  const hasUnread = unread.length > 0

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasUnread
              ? `${unread.length} unread notification${unread.length !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            loading={markingAll}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <NotifSkeleton key={i} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No notifications yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Notifications will appear here when there is activity on your
              clearances.
            </p>
          </div>
        ) : (
          <>
            {/* Unread group */}
            {unread.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Unread ({unread.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {unread.map((n) => (
                    <NotifRow key={n.id} notif={n} onRead={markAsRead} />
                  ))}
                </div>
              </div>
            )}

            {/* Divider between groups */}
            {unread.length > 0 && read.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Earlier
                </span>
              </div>
            )}

            {/* Read group */}
            {read.length > 0 && (
              <div className="divide-y divide-gray-100">
                {read.map((n) => (
                  <NotifRow key={n.id} notif={n} onRead={markAsRead} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
