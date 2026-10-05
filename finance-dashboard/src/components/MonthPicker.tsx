import { addMonths, formatMonth, monthStart, todayISO, type ISODate } from '../lib/dates.ts'

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'left' ? 'M12.5 4.5L7 10l5.5 5.5' : 'M7.5 4.5L13 10l-5.5 5.5'} />
    </svg>
  )
}

export function MonthPicker({
  month,
  onChange,
}: {
  month: ISODate
  onChange: (month: ISODate) => void
}) {
  const current = monthStart(todayISO())

  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button
        type="button"
        className="btn btn-icon"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <Chevron direction="left" />
      </button>
      <span className="month-picker-label" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        className="btn btn-icon"
        aria-label="Next month"
        onClick={() => onChange(addMonths(month, 1))}
      >
        <Chevron direction="right" />
      </button>
      {month !== current && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(current)}>
          This month
        </button>
      )}
    </div>
  )
}
