import { addMonths, formatMonth, monthStart, todayISO, type ISODate } from '../lib/dates.ts'

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
        ‹
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
        ›
      </button>
      {month !== current && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(current)}>
          This month
        </button>
      )}
    </div>
  )
}
