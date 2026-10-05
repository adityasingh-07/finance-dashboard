import { describe, expect, it } from 'vitest'
import { summarizeBudgets } from './budgets.ts'
import {
  buildCategoryRows,
  buildDashboardView,
  buildHero,
  buildInsight,
  buildPaceSeries,
  monthProgress,
  overBudgetSentence,
  type CategoryRow,
  type CategorySummaryRow,
  type DailyRow,
} from './dashboard.ts'

describe('monthProgress', () => {
  it('counts today in full for the current month', () => {
    expect(monthProgress('2026-10-01', '2026-10-06')).toEqual({
      phase: 'current',
      daysInMonth: 31,
      elapsedDays: 6,
      fraction: 6 / 31,
    })
  })

  it('treats past months as complete and future months as not started', () => {
    expect(monthProgress('2026-09-01', '2026-10-06')).toMatchObject({ phase: 'past', elapsedDays: 30, fraction: 1 })
    expect(monthProgress('2026-11-01', '2026-10-06')).toMatchObject({ phase: 'future', elapsedDays: 0, fraction: 0 })
  })

  it('accepts any day within the month', () => {
    expect(monthProgress('2026-10-20', '2026-10-31')).toMatchObject({ phase: 'current', elapsedDays: 31, fraction: 1 })
  })
})

function daily(cumulative: number[], budgeted: number[]): DailyRow[] {
  return cumulative.map((c, i) => ({
    spent_on: `2026-02-${String(i + 1).padStart(2, '0')}`,
    cumulative_cents: c,
    budgeted_cumulative_cents: budgeted[i],
  }))
}

describe('buildPaceSeries', () => {
  const rows = daily([100, 300, 300, 600], [50, 150, 150, 400])
  const current = { phase: 'current' as const, daysInMonth: 4, elapsedDays: 2, fraction: 0.5 }

  it('uses budgeted spending and a straight pace line when budgets exist', () => {
    const series = buildPaceSeries(rows, { hasBudgets: true, budgetCents: 1000 }, current)
    expect(series.measure).toBe('budgeted')
    expect(series.actual).toEqual([50, 150, null, null])
    expect(series.pace).toEqual([250, 500, 750, 1000])
    expect(series.days[0]).toBe('2026-02-01')
  })

  it('falls back to all spending and no pace line without budgets', () => {
    const past = { phase: 'past' as const, daysInMonth: 4, elapsedDays: 4, fraction: 1 }
    const series = buildPaceSeries(rows, { hasBudgets: false, budgetCents: 0 }, past)
    expect(series.measure).toBe('all')
    expect(series.actual).toEqual([100, 300, 300, 600])
    expect(series.pace).toBeNull()
  })

  it('has no actual points for a future month', () => {
    const future = { phase: 'future' as const, daysInMonth: 4, elapsedDays: 0, fraction: 0 }
    expect(buildPaceSeries(rows, { hasBudgets: true, budgetCents: 1000 }, future).actual).toEqual([null, null, null, null])
  })

  it('rounds pace to whole cents', () => {
    const three = daily([0, 0, 0], [0, 0, 0])
    const p = { phase: 'current' as const, daysInMonth: 3, elapsedDays: 1, fraction: 1 / 3 }
    expect(buildPaceSeries(three, { hasBudgets: true, budgetCents: 1000 }, p).pace).toEqual([333, 667, 1000])
  })
})

const summary: CategorySummaryRow[] = [
  { category_id: 'a', name: 'Rent', color: '#2563EB', spent_cents: 200000, limit_cents: 200000 },
  { category_id: 'b', name: 'Dining Out', color: '#EA580C', spent_cents: 33183, limit_cents: 30000 },
  { category_id: 'c', name: 'Health', color: '#DC2626', spent_cents: 0, limit_cents: 10000 },
  { category_id: 'd', name: 'Other', color: '#6B7280', spent_cents: 0, limit_cents: null },
  { category_id: 'e', name: 'Books', color: '#7C3AED', spent_cents: 16817, limit_cents: null },
]

describe('buildCategoryRows', () => {
  const rows = buildCategoryRows(summary)

  it('drops categories with no spend and no budget, sorts by spend', () => {
    expect(rows.map((r) => r.name)).toEqual(['Rent', 'Dining Out', 'Books', 'Health'])
  })

  it('computes share of total spend and overspend', () => {
    expect(rows[0]).toMatchObject({ sharePct: 80, overByCents: 0, limitCents: 200000 })
    expect(rows[1]).toMatchObject({ sharePct: 13.3, overByCents: 3183 })
    expect(rows[2]).toMatchObject({ sharePct: 6.7, overByCents: 0, limitCents: null })
    expect(rows[3]).toMatchObject({ sharePct: 0, spentCents: 0, limitCents: 10000 })
  })

  it('handles a month with no spending', () => {
    const empty = buildCategoryRows([{ ...summary[2] }])
    expect(empty).toHaveLength(1)
    expect(empty[0].sharePct).toBe(0)
  })
})

const row = (name: string, overByCents: number): CategoryRow => ({
  id: name, name, color: '#000000', spentCents: 0, limitCents: 0, sharePct: 0, overByCents,
})

describe('overBudgetSentence', () => {
  it('is null when nothing is over', () => {
    expect(overBudgetSentence([row('Rent', 0)])).toBeNull()
  })

  it('lists categories worst first', () => {
    expect(overBudgetSentence([row('Dining Out', 3183), row('Health', 17140)])).toBe(
      'Over budget in Health (+$171.40) and Dining Out (+$31.83).',
    )
    expect(overBudgetSentence([row('A', 100)])).toBe('Over budget in A (+$1.00).')
    expect(overBudgetSentence([row('A', 300), row('B', 200), row('C', 100)])).toBe(
      'Over budget in A (+$3.00), B (+$2.00) and C (+$1.00).',
    )
  })

  it('summarises long lists', () => {
    expect(overBudgetSentence([row('A', 400), row('B', 300), row('C', 200), row('D', 100)])).toBe(
      'Over budget in A (+$4.00), B (+$3.00) and 2 more.',
    )
  })
})

describe('buildInsight', () => {
  const totals = (spent: number, limit: number) => summarizeBudgets([{ spent_cents: spent, limit_cents: limit }])
  const current = (elapsedDays: number, daysInMonth = 30) =>
    ({ phase: 'current', daysInMonth, elapsedDays, fraction: elapsedDays / daysInMonth }) as const

  it('says nothing without budgets or for future months', () => {
    expect(buildInsight(summarizeBudgets([{ spent_cents: 500, limit_cents: null }]), [], current(10), 'October 2026')).toBeNull()
    expect(buildInsight(totals(0, 1000), [], { phase: 'future', daysInMonth: 30, elapsedDays: 0, fraction: 0 }, 'x')).toBeNull()
  })

  it('states what is left and the daily allowance when within budget', () => {
    expect(buildInsight(totals(50000, 100000), [], current(15), 'October 2026')).toEqual({
      tone: 'good',
      label: 'Within budget',
      message: 'You have $500.00 left for the remaining 15 days, about $33.33 a day.',
      detail: null,
    })
  })

  it('does not cry wolf when a big bill lands early in the month', () => {
    // Rent paid on day 1 is 42% of the budget; nothing is over.
    const insight = buildInsight(totals(230000, 545000), [], current(1, 31), 'x')
    expect(insight?.tone).toBe('good')
    expect(insight?.message).toBe('You have $3,150.00 left for the remaining 30 days, about $105.00 a day.')
  })

  it('rounds the daily allowance down', () => {
    // $100.00 over 3 days is $33.333...; never overstate it.
    expect(buildInsight(totals(0, 10000), [], current(27), 'x')?.message).toBe(
      'You have $100.00 left for the remaining 3 days, about $33.33 a day.',
    )
  })

  it('uses singular "day" and handles the last day', () => {
    expect(buildInsight(totals(0, 10000), [], current(29), 'x')?.message).toBe(
      'You have $100.00 left for the remaining 1 day, about $100.00 a day.',
    )
    expect(buildInsight(totals(0, 10000), [], current(30), 'x')?.message).toBe(
      'You have $100.00 left on the last day of the month.',
    )
  })

  it('flags being over budget, with days left', () => {
    expect(buildInsight(totals(120000, 100000), [], current(20), 'x')?.message).toBe(
      "You're $200.00 over budget with 10 days left.",
    )
    expect(buildInsight(totals(120000, 100000), [], current(29), 'x')?.message).toBe(
      "You're $200.00 over budget with 1 day left.",
    )
    expect(buildInsight(totals(120000, 100000), [], current(30), 'x')?.message).toBe(
      "You're $200.00 over budget on the last day of the month.",
    )
  })

  it('summarises finished months', () => {
    const past = { phase: 'past', daysInMonth: 30, elapsedDays: 30, fraction: 1 } as const
    expect(buildInsight(totals(90000, 100000), [], past, 'September 2026')?.message).toBe(
      'You finished September 2026 $100.00 under budget.',
    )
    expect(buildInsight(totals(100000, 100000), [], past, 'September 2026')?.message).toBe(
      'You finished September 2026 exactly on budget.',
    )
    expect(buildInsight(totals(110000, 100000), [], past, 'September 2026')).toMatchObject({
      tone: 'critical',
      message: 'You finished September 2026 $100.00 over budget.',
    })
  })

  it('names overspent categories even when the month as a whole is fine', () => {
    const insight = buildInsight(totals(40000, 100000), [row('Dining Out', 3183)], current(15), 'x')
    expect(insight).toMatchObject({ tone: 'good', detail: 'Over budget in Dining Out (+$31.83).' })
  })

  it('treats a $0 budget with no spending as within budget', () => {
    expect(buildInsight(totals(0, 0), [], current(10), 'x')).toMatchObject({
      tone: 'good',
      message: 'You have $0.00 left for the remaining 20 days, about $0.00 a day.',
    })
  })
})

describe('buildDashboardView', () => {
  it('derives everything from the data month, not the selected one', () => {
    const view = buildDashboardView(
      {
        month: '2026-09-01',
        summary: [{ category_id: 'a', name: 'Rent', color: '#000000', spent_cents: 90000, limit_cents: 100000 }],
        daily: daily([90000], [90000]),
      },
      '2026-10-06',
    )
    expect(view.label).toBe('September 2026')
    expect(view.progress.phase).toBe('past')
    expect(view.totals.remainingCents).toBe(10000)
    expect(view.insight?.message).toBe('You finished September 2026 $100.00 under budget.')
    expect(view.pace.pace).toEqual([100000])
    expect(view.hero.figure).toBe('$100 under')
  })
})

describe('buildHero', () => {
  const current = { phase: 'current', daysInMonth: 30, elapsedDays: 10, fraction: 1 / 3 } as const
  const past = { phase: 'past', daysInMonth: 30, elapsedDays: 30, fraction: 1 } as const
  const future = { phase: 'future', daysInMonth: 30, elapsedDays: 0, fraction: 0 } as const
  const budgeted = (spent: number, limit: number) => summarizeBudgets([{ spent_cents: spent, limit_cents: limit }])
  const unbudgeted = (spent: number) => summarizeBudgets([{ spent_cents: spent, limit_cents: null }])
  const hero = (t: ReturnType<typeof summarizeBudgets>, p: typeof current | typeof past | typeof future) =>
    buildHero(buildInsight(t, [], p, 'October 2026'), t, p, 'October 2026')

  it('leads with what is left, reusing the insight sentence', () => {
    expect(hero(budgeted(231766, 500000), current)).toEqual({
      figure: '$2,682 left',
      tone: 'good',
      sentence: 'You have $2,682.34 left for the remaining 20 days, about $134.11 a day.',
      detail: null,
    })
  })

  it('says how far over, and how a past month finished', () => {
    expect(hero(budgeted(120000, 100000), current)).toMatchObject({ figure: '$200 over', tone: 'critical' })
    expect(hero(budgeted(90000, 100000), past).figure).toBe('$100 under')
    expect(hero(budgeted(100000, 100000), past).figure).toBe('On budget')
    expect(hero(budgeted(130000, 100000), past).figure).toBe('$300 over')
  })

  it('falls back to spending without budgets', () => {
    expect(hero(unbudgeted(4250), current)).toEqual({
      figure: '$43 spent',
      tone: 'neutral',
      sentence: 'Set budgets to see how much is left.',
      detail: null,
    })
    expect(hero(unbudgeted(0), current).sentence).toBe('Nothing spent in October 2026 yet. Set budgets to see how much is left.')
  })

  it('handles months that have not started', () => {
    expect(hero(budgeted(0, 545000), future)).toMatchObject({ figure: '$5,450 budgeted', sentence: "October 2026 hasn't started yet." })
    expect(hero(unbudgeted(0), future).figure).toBe('Not started')
  })
})
