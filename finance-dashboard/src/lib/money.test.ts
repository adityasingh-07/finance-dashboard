import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, formatCentsShort, parseAmountToCents } from './money.ts'

describe('parseAmountToCents', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['.99', 99],
    ['0.01', 1],
    ['$12.34', 1234],
    ['1,234.56', 123456],
    ['1,234,567', 123456700],
    ['  7.10  ', 710],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents)
  })

  it('avoids floating-point error', () => {
    // 0.1 + 0.2 style bugs: 19.99 * 100 === 1998.9999999999998 in floats
    expect(parseAmountToCents('19.99')).toBe(1999)
    expect(parseAmountToCents('1.15')).toBe(115)
  })

  it.each(['', '.', '12.', '12.345', '-5', 'abc', '1,23.00', '12,34', '1.2.3', '$'])(
    'rejects %j',
    (input) => {
      expect(parseAmountToCents(input)).toBeNull()
    },
  )

  it('rejects zero unless allowed', () => {
    expect(parseAmountToCents('0')).toBeNull()
    expect(parseAmountToCents('0.00')).toBeNull()
    expect(parseAmountToCents('0', { allowZero: true })).toBe(0)
  })
})

describe('formatCents', () => {
  it('formats as AUD', () => {
    expect(formatCents(123456)).toBe('$1,234.56')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(0)).toBe('$0.00')
  })
})

describe('formatCentsShort', () => {
  it('rounds to whole dollars', () => {
    expect(formatCentsShort(123456)).toBe('$1,235')
    expect(formatCentsShort(123449)).toBe('$1,234')
    expect(formatCentsShort(0)).toBe('$0')
  })
})

describe('centsToInput', () => {
  it('round-trips through parseAmountToCents', () => {
    for (const cents of [1, 99, 100, 1250, 123456]) {
      expect(parseAmountToCents(centsToInput(cents))).toBe(cents)
    }
  })
})
