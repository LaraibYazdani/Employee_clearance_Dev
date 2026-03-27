'use client'

import React from 'react'

interface CardProps {
  title?: string
  className?: string
  children: React.ReactNode
}

export default function Card({ title, className = '', children }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden',
        className,
      ].join(' ')}
    >
      {title && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
