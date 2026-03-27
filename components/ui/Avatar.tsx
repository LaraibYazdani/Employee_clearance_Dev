'use client'

import React from 'react'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps {
  name?: string
  src?: string
  size?: AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Simple deterministic color based on name
const bgColors = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
]

function getColor(name?: string): string {
  if (!name) return bgColors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return bgColors[Math.abs(hash) % bgColors.length]
}

export default function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name)
  const color = getColor(name)
  const sizeClass = sizeClasses[size]

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'User avatar'}
        className={['rounded-full object-cover', sizeClass, className].join(' ')}
      />
    )
  }

  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0',
        color,
        sizeClass,
        className,
      ].join(' ')}
      aria-label={name ?? 'User'}
    >
      {initials}
    </span>
  )
}
