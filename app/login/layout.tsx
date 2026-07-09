import type { Metadata } from 'next'
import { IS_TEST_SERVER } from '@/lib/site-config'

export const metadata: Metadata = {
  title: IS_TEST_SERVER ? '[DEV] Sign In | Employee Clearance Portal' : 'Sign In | Employee Clearance Portal',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
