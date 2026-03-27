'use client'

import React from 'react'

type StatusKey =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DENIED'
  | 'PENDING_HRBP'
  | 'APPROVED'
  | 'NA'
  | 'LOCKED'
  | 'DRAFT'
  | 'CANCELLED'
  | 'FLAGGED'
  | string

interface BadgeProps {
  status: StatusKey
  className?: string
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  DENIED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  PENDING_HRBP: 'bg-orange-100 text-orange-800 border-orange-200',
  NA: 'bg-gray-100 text-gray-600 border-gray-200',
  LOCKED: 'bg-gray-100 text-gray-600 border-gray-200',
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  FLAGGED: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  CANCELLED: 'Cancelled',
  PENDING_HRBP: 'Pending HRBP',
  NA: 'N/A',
  LOCKED: 'Locked',
  DRAFT: 'Draft',
  FLAGGED: 'Flagged',
}

export default function Badge({ status, className = '' }: BadgeProps) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const label = statusLabels[status] ?? status

  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        style,
        className,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
