'use client'

import React from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
}

export default function DashboardLayout({
  children,
  showSidebar = true,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
