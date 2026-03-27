'use client'

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  required?: boolean
  className?: string
}

export default function Input({
  label,
  error,
  required,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        required={required}
        className={[
          'block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'transition-colors duration-150',
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
