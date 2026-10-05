import { describe, expect, it } from 'vitest'
import {
  addMonths,
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

  it('returns half-open month bounds', () => {
    expect(monthBounds('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-03-01' })
  })

  it('formats a month label', () => {
    expect(formatMonth('2026-10-05')).toBe('October 2026')
  })
})

describe('month URL params', () => {
  it('round-trips', () => {
    expect(fromMonthParam(toMonthParam('2026-10-05'))).toBe('2026-10-01')
  })

  it.each([null, '', '2026-13', '2026-1', 'abc', '2026-10-01'])('rejects %j', (param) => {
    expect(fromMonthParam(param)).toBeNull()
  })
})
