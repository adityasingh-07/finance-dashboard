import { describe, expect, it } from 'vitest'
import { summarizeBudgets } from './budgets.ts'

describe('summarizeBudgets', () => {
  it('has no budgets and is never over when nothing is budgeted', () => {
    const totals = summarizeBudgets([
      { spent_cents: 50000, limit_cents: null },
      { spent_cents: 0, limit_cents: null },
    ])
    expect(totals).toEqual({
      spentCents: 50000,
      budgetCents: 0,
      budgetedSpentCents: 0,
      unbudgetedSpentCents: 50000,
      remainingCents: 0,
      hasBudgets: false,
    })
  })

  it('ignores spending in unbudgeted categories when computing remaining', () => {
    // $400 groceries budget, $100 spent; $2,000 rent with no budget.
    const totals = summarizeBudgets([
      { spent_cents: 10000, limit_cents: 40000 },
      { spent_cents: 200000, limit_cents: null },
    ])
    expect(totals.remainingCents).toBe(30000)
    expect(totals.spentCents).toBe(210000)
    expect(totals.unbudgetedSpentCents).toBe(200000)
  })

  it('goes negative when budgeted spending exceeds the budgets', () => {
    const totals = summarizeBudgets([
      { spent_cents: 45000, limit_cents: 40000 },
      { spent_cents: 1000, limit_cents: 5000 },
    ])
    expect(totals.remainingCents).toBe(-1000)
  })

  it('treats a $0 budget as a real budget', () => {
    const totals = summarizeBudgets([{ spent_cents: 500, limit_cents: 0 }])
    expect(totals.hasBudgets).toBe(true)
    expect(totals.remainingCents).toBe(-500)
  })

  it('handles an empty month', () => {
    expect(summarizeBudgets([]).hasBudgets).toBe(false)
  })
})
