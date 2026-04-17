'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User } from '@/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'clearance_token'

function setTokenCookie(token: string) {
  // Expires in 8 hours
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString()
  document.cookie = `token=${token}; path=/; expires=${expires}; SameSite=Lax`
}

function clearTokenCookie() {
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }

    // Validate token with the /api/auth/me endpoint
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token')
        return res.json()
      })
      .then((data: User) => {
        setUser(data)
        setToken(stored)
        setTokenCookie(stored)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        clearTokenCookie()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          return { success: false, error: data.message ?? 'Login failed' }
        }

        const { token: newToken, user: newUser } = data

        localStorage.setItem(TOKEN_KEY, newToken)
        setTokenCookie(newToken)
        setToken(newToken)
        setUser(newUser)

        return { success: true }
      } catch (err) {
        return { success: false, error: 'Network error. Please try again.' }
      }
    },
    []
  )

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      })
      if (!res.ok) return
      const data: User = await res.json()
      setUser(data)
    } catch {
      // Non-critical — ignore
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    clearTokenCookie()
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
