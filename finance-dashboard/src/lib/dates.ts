// Dates are 'YYYY-MM-DD' strings (what Postgres `date` columns serialise to),
// always interpreted in the user's local timezone. Never go through
// toISOString(), which converts to UTC and can shift the day.

export type ISODate = string

const LOCALE = 'en-AU'

const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function parts(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/**
 * Local Date for a calendar day. `new Date(y, m, d)` maps years 0–99 to
 * 1900–1999, so set the year explicitly. `monthIndex` and `day` may
 * overflow (e.g. month 12 rolls into next year), like the Date constructor.
 */
function localDate(year: number, monthIndex: number, day: number): Date {
  const d = new Date(2000, 0, 1)
  d.setFullYear(year, monthIndex, day)
  return d
}

/** Local calendar date of a Date object. */
export function toISODate(d: Date): ISODate {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
  return toISODate(localDate(y, m - 1 + n, 1))
}

/** [start, end) bounds of the month containing `date`, for range queries. */
export function monthBounds(date: ISODate): { start: ISODate; end: ISODate } {
  return { start: monthStart(date), end: addMonths(date, 1) }
}

/** Default date for a new expense: today if it falls in `month`, else the 1st of `month`. */
export function defaultExpenseDate(month: ISODate, today: ISODate = todayISO()): ISODate {
  return monthStart(today) === monthStart(month) ? today : monthStart(month)
}

/** '2026-10-05' -> 'October 2026' */
export function formatMonth(date: ISODate): string {
  const [y, m] = parts(date)
  return monthFormat.format(localDate(y, m - 1, 1))
}

/** '2026-10-05' -> 'Mon, 5 Oct' */
export function formatDay(date: ISODate): string {
  const [y, m, d] = parts(date)
  return dayFormat.format(localDate(y, m - 1, d))
}

/** Month as used in URLs: '2026-10'. */
export function toMonthParam(date: ISODate): string {
  return date.slice(0, 7)
}

/**
 * Parses a '2026-10' URL param; null if malformed or outside 1900–2999 (a
 * plausible range that also keeps queries inside what Postgres accepts).
 */
export function fromMonthParam(param: string | null): ISODate | null {
  if (!param || !/^(19|2\d)\d{2}-(0[1-9]|1[0-2])$/.test(param)) return null
  return `${param}-01`
}

/** Earliest and latest expense dates the forms accept. */
export const MIN_DATE: ISODate = '1900-01-01'
export const MAX_DATE: ISODate = '2999-12-31'
