import type { ReactNode } from 'react'
import type { Insight } from '../lib/dashboard.ts'

// Each status has its own icon shape as well as colour, and always a text
// label, so the state never depends on colour alone.
const ICONS: Record<Insight['tone'], ReactNode> = {
  good: (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

export function InsightCallout({ insight, dimmed = false }: { insight: Insight; dimmed?: boolean }) {
  return (
    <div className={`insight insight-${insight.tone}${dimmed ? ' is-dimmed' : ''}`} role="status">
      <span className="insight-icon">{ICONS[insight.tone]}</span>
      <p>
        <strong>{insight.label}.</strong> {insight.message}
        {insight.detail && <span className="insight-detail">{insight.detail}</span>}
      </p>
    </div>
  )
}
