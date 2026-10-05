import { describe, expect, it } from 'vitest'
import {
  addMonths,
  daysInMonth,
  defaultExpenseDate,
  formatShortDay,
  formatDay,
  formatMonth,
  fromMonthParam,
  monthBounds,
  monthStart,
  toISODate,
  toMonthParam,
} from './dates.ts'

describe('toISODate', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toISODate(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31')
    expect(toISODate(new Date(2026, 1, 1, 0, 1))).toBe('2026-02-01')
  })

  it('pads years to four digits', () => {
    const d = new Date(2000, 0, 1)
    d.setFullYear(50, 5, 1)
    expect(toISODate(d)).toBe('0050-06-01')
  })
})

describe('month helpers', () => {
  it('finds the start of a month', () => {
    expect(monthStart('2026-10-17')).toBe('2026-10-01')
  })

  it('adds months across year boundaries', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-01')
  })

  it('does not map two-digit years into the 1900s', () => {
    expect(addMonths('0050-06-01', 1)).toBe('0050-07-01')
    expect(addMonths('0099-12-01', 1)).toBe('0100-01-01')
    expect(formatMonth('0050-06-01')).toBe('June 50')
    expect(formatDay('0050-06-01')).not.toMatch(/1950/)
  })

  it('returns half-open month bounds', () => {
    expect(monthBounds('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-03-01' })
  })

  it('formats a month label', () => {
    expect(formatMonth('2026-10-05')).toBe('October 2026')
  })

  it('formats a short axis label', () => {
    expect(formatShortDay('2026-10-05')).toBe('5 Oct')
  })

  it('formats a day label', () => {
    expect(formatDay('2026-10-05')).toBe('Mon, 5 Oct')
  })
})

describe('daysInMonth', () => {
  it.each([
    ['2026-01-15', 31],
    ['2026-02-01', 28],
    ['2024-02-01', 29],
    ['2026-04-30', 30],
    ['2026-12-01', 31],
  ])('%s has %i days', (date, days) => {
    expect(daysInMonth(date)).toBe(days)
  })
})

describe('defaultExpenseDate', () => {
  it('is today when viewing the current month', () => {
    expect(defaultExpenseDate('2026-10-01', '2026-10-06')).toBe('2026-10-06')
  })

  it('is the 1st when viewing another month', () => {
    expect(defaultExpenseDate('2026-09-01', '2026-10-06')).toBe('2026-09-01')
  })

  it('follows the real date as it changes', () => {
    expect(defaultExpenseDate('2026-10-01', '2026-10-07')).toBe('2026-10-07')
    // Month rolled over while viewing October: fall back to Oct 1st.
    expect(defaultExpenseDate('2026-10-01', '2026-11-01')).toBe('2026-10-01')
  })
})

describe('month URL params', () => {
  it('round-trips', () => {
    expect(fromMonthParam(toMonthParam('2026-10-05'))).toBe('2026-10-01')
  })

  it('accepts 1900–2999', () => {
    expect(fromMonthParam('1900-01')).toBe('1900-01-01')
    expect(fromMonthParam('2999-12')).toBe('2999-12-01')
  })

  it.each([null, '', '2026-13', '2026-1', 'abc', '2026-10-01', '0050-06', '0000-01', '1899-12', '3000-01'])(
    'rejects %j',
    (param) => {
      expect(fromMonthParam(param)).toBeNull()
    },
  )
})
