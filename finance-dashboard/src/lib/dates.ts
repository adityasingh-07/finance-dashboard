// Dates are 'YYYY-MM-DD' strings (what Postgres `date` columns serialise to),
// always interpreted in the user's local timezone. Never go through
// toISOString(), which converts to UTC and can shift the day.

export type ISODate = string

const LOCALE = 'en-AU'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parts(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/** Local calendar date of a Date object. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** First day of the month containing `date`. */
export function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

/** First day of the month `n` months from the month containing `date`. */
export function addMonths(date: ISODate, n: number): ISODate {
  const [y, m] = parts(date)
  return toISODate(new Date(y, m - 1 + n, 1))
}

/** [start, end) bounds of the month containing `date`, for range queries. */
export function monthBounds(date: ISODate): { start: ISODate; end: ISODate } {
  return { start: monthStart(date), end: addMonths(date, 1) }
}

/** '2026-10-05' -> 'October 2026' */
export function formatMonth(date: ISODate): string {
  const [y, m] = parts(date)
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
}

/** '2026-10-05' -> 'Mon 5 Oct' */
export function formatDay(date: ISODate): string {
  const [y, m, d] = parts(date)
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(y, m - 1, d))
}

/** Month as used in URLs: '2026-10'. */
export function toMonthParam(date: ISODate): string {
  return date.slice(0, 7)
}

/** Parses a '2026-10' URL param; null if malformed. */
export function fromMonthParam(param: string | null): ISODate | null {
  if (!param || !/^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return null
  return `${param}-01`
}
