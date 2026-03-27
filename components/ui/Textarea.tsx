'use client'

import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  required?: boolean
  className?: string
}

export default function Textarea({
  label,
  error,
  required,
  className = '',
  id,
  ...rest
}: TextareaProps) {
  const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        required={required}
        rows={rest.rows ?? 4}
        className={[
          'block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'transition-colors duration-150 resize-y',
          error
            ? 'border-red-400 bg-red-50 focus:ring-red-400'
            : 'border-gray-300 bg-white hover:border-gray-400',
          rest.disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : '',
          className,
        ].join(' ')}
        {...rest}
      />
      {error && (
        <p className="text-xs text-red-600 mt-0.5">{error}</p>
      )}
    </div>
  )
}
