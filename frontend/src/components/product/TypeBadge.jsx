export default function TypeBadge({ type, size = 'sm' }) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'

  if (type === 'account') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide ${pad} bg-blue-500/15 text-blue-400 border border-blue-500/25`}>
        <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Game Account
      </span>
    )
  }

  if (type === 'game_key') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide ${pad} bg-emerald-500/15 text-emerald-400 border border-emerald-500/25`}>
        <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Game Key
      </span>
    )
  }

  return null
}
