import { IS_TEST_SERVER, TEST_BANNER_MESSAGE } from '@/lib/site-config'

export default function TestServerBanner() {
  if (!IS_TEST_SERVER) return null

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 text-center text-xs sm:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{TEST_BANNER_MESSAGE}</span>
    </div>
  )
}
