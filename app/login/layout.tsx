import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | Employee Clearance Portal',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
