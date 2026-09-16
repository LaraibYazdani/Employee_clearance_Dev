'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ObjectionThread, ObjectionMessage } from '@/types'
import { useAuth } from '@/lib/auth-context'

interface ObjectionChatProps {
  threads: ObjectionThread[]
  clearanceId: string
  isPayrollManager: boolean
  onResolved: () => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

interface SingleThreadProps {
  thread: ObjectionThread
  clearanceId: string
  isPayrollManager: boolean
  currentUserId: string
  token: string
  onResolved: () => void
}

function SingleThread({
  thread,
  clearanceId,
  isPayrollManager,
  currentUserId,
  token,
  onResolved,
}: SingleThreadProps) {
  const [messages, setMessages] = useState<ObjectionMessage[]>(thread.messages ?? [])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!draft.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/clearance/${clearanceId}/objections/${thread.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: draft.trim() }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to send message')
      }
      const msg: ObjectionMessage = await res.json()
      setMessages((prev) => [...prev, msg])
      setDraft('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const resolve = async () => {
    if (!confirm('Mark this objection as resolved? The item and section will return to Approved status.')) return
    setResolving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/clearance/${clearanceId}/objections/${thread.id}/resolve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to resolve')
      }
      onResolved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve')
      setResolving(false)
    }
  }

  const isResolved = thread.status === 'RESOLVED'
  const canPost =
    !isResolved &&
    (isPayrollManager || currentUserId === thread.assigned_approver_id)

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/40 overflow-hidden">
      {/* Thread header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-900 truncate">
              Objection: {thread.clearance_item?.description ?? 'Item'}
            </p>
            <p className="text-xs text-orange-600">
              Raised by {thread.raised_by?.full_name} &bull; Assigned to {thread.assigned_approver?.full_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isResolved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
              Open
            </span>
          )}
          {isPayrollManager && !isResolved && (
            <button
              type="button"
              onClick={resolve}
              disabled={resolving}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Resolution Reached
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center italic py-4">No messages yet.</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <span className="text-[10px] text-gray-400 px-1">
                    {msg.sender?.full_name ?? 'Unknown'} &bull; {formatTime(msg.created_at)}
                  </span>
                  <div
                    className={[
                      'px-3 py-2 rounded-xl text-sm leading-snug',
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm',
                    ].join(' ')}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canPost && (
        <div className="px-4 pb-3 pt-1 border-t border-orange-100 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Send
          </button>
        </div>
      )}

      {error && (
        <p className="px-4 pb-3 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

export default function ObjectionChat({
  threads,
  clearanceId,
  isPayrollManager,
  onResolved,
}: ObjectionChatProps) {
  const { token, user } = useAuth()
  if (!token || !user) return null
  if (threads.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-orange-200" />
        <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
          Objection {threads.length > 1 ? `Threads (${threads.length})` : 'Thread'}
        </span>
        <div className="flex-1 h-px bg-orange-200" />
      </div>
      {threads.map((thread) => (
        <SingleThread
          key={thread.id}
          thread={thread}
          clearanceId={clearanceId}
          isPayrollManager={isPayrollManager}
          currentUserId={user.id}
          token={token}
          onResolved={onResolved}
        />
      ))}
    </div>
  )
}
