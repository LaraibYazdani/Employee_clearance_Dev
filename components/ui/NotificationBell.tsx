'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Notification } from '@/types'

interface NotificationBellProps {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onViewAll: () => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case 'CLEARANCE_CREATED':
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-600 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      )
    case 'APPROVAL_REQUIRED':
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-yellow-100 text-yellow-600 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </span>
      )
    case 'APPROVED':
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-green-100 text-green-600 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )
    case 'DENIED':
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-red-100 text-red-600 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )
    default:
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-gray-500 shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      )
  }
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onViewAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const recentNotifications = notifications.slice(0, 8)

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-indigo-600 font-medium">{unreadCount} unread</span>
            )}
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {recentNotifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400">
                No notifications yet
              </li>
            ) : (
              recentNotifications.map((n) => (
                <li
                  key={n.id}
                  className={[
                    'flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer',
                    !n.read ? 'bg-indigo-50/40' : '',
                  ].join(' ')}
                  onClick={() => {
                    if (!n.read) onMarkRead(n.id)
                    setOpen(false)
                  }}
                >
                  {getTypeIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <p className={['text-sm leading-snug', !n.read ? 'font-medium text-gray-900' : 'text-gray-700'].join(' ')}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </li>
              ))
            )}
          </ul>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { onViewAll(); setOpen(false) }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium w-full text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
