// Money is integer cents everywhere; these are the only conversions to and
// from human-readable amounts.

const LOCALE = 'en-AU'
const CURRENCY = 'AUD'

const currencyFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
})

/** 123456 -> "$1,234.56" */
export function formatCents(cents: number): string {
  return currencyFormat.format(cents / 100)
}

/** 1250 -> "12.50", for pre-filling inputs. */
export function centsToInput(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const frac = String(Math.abs(cents % 100)).padStart(2, '0')
  return `${whole}.${frac}`
}

// Optional "$", digits with optional correct thousands separators, up to 2 decimals.
const AMOUNT_PATTERN = /^\$?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{1,2}))?$/

/**
 * Parses user input like "12.5", "$1,234.56" or ".99" into cents without
 * going through floating point. Returns null for anything invalid, negative,
 * or zero (unless allowZero).
 */
export function parseAmountToCents(
  input: string,
  { allowZero = false }: { allowZero?: boolean } = {},
): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim())
  if (!match) return null

  const [, wholePart, fracPart] = match
  if (wholePart === '' && fracPart === undefined) return null

  const whole = Number(wholePart.replaceAll(',', '') || '0')
  const frac = Number((fracPart ?? '').padEnd(2, '0'))
  const cents = whole * 100 + frac

  if (!Number.isSafeInteger(cents)) return null
  if (cents < 0 || (cents === 0 && !allowZero)) return null
  return cents
}
