import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import TestServerBanner from '@/components/layout/TestServerBanner'
import { IS_TEST_SERVER } from '@/lib/site-config'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: IS_TEST_SERVER ? '[DEV] Employee Exit Clearance Portal' : 'Employee Exit Clearance Portal',
  description: 'Manage employee exit clearance requests and approvals',
  keywords: ['employee', 'clearance', 'exit', 'HR', 'portal'],
  authors: [{ name: 'HR Department' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <TestServerBanner />
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
