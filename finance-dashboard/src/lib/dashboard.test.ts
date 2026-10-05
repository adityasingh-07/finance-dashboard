import { describe, expect, it } from 'vitest'
import { summarizeBudgets } from './budgets.ts'
import {
  buildCategoryRows,
  buildDashboardView,
  buildHero,
  buildPaceSeries,
  heroAmount,
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

describe('heroAmount', () => {
  it('shows exact cents under $10, so small amounts never round to $0', () => {
    expect(heroAmount(30, 'up')).toBe('$0.30')
    expect(heroAmount(999, 'down')).toBe('$9.99')
    expect(heroAmount(0, 'down')).toBe('$0.00')
  })

  it('rounds in the direction that never flatters', () => {
    expect(heroAmount(268250, 'down')).toBe('$2,682')
    expect(heroAmount(268201, 'up')).toBe('$2,683')
    expect(heroAmount(268250, 'nearest')).toBe('$2,683')
    expect(heroAmount(268249, 'nearest')).toBe('$2,682')
  })
})

describe('buildHero', () => {
  const totals = (spent: number, limit: number | null) => summarizeBudgets([{ spent_cents: spent, limit_cents: limit }])
  const current = (elapsedDays: number, daysInMonth = 30) =>
    ({ phase: 'current', daysInMonth, elapsedDays, fraction: elapsedDays / daysInMonth }) as const
  const past = { phase: 'past', daysInMonth: 30, elapsedDays: 30, fraction: 1 } as const
  const future = { phase: 'future', daysInMonth: 30, elapsedDays: 0, fraction: 0 } as const
  const hero = (t: ReturnType<typeof totals>, p: Parameters<typeof buildHero>[2], rows: CategoryRow[] = []) =>
    buildHero(t, rows, p, 'October 2026')

  describe('current month with budgets', () => {
    it('states what is left and the daily allowance', () => {
      expect(hero(totals(231766, 500000), current(10))).toEqual({
        figure: '$2,682 left',
        tone: 'good',
        sentence: 'You have $2,682.34 left for the remaining 20 days, about $134.11 a day.',
        detail: null,
      })
    })

    it('never rounds the figure up past what is left', () => {
      // $2,682.50 left: rounding to nearest would claim $2,683.
      expect(hero(totals(231750, 500000), current(10)).figure).toBe('$2,682 left')
    })

    it('does not cry wolf when a big bill lands early in the month', () => {
      // Rent paid on day 1 is 42% of the budget; nothing is over.
      const h = hero(totals(230000, 545000), current(1, 31))
      expect(h.tone).toBe('good')
      expect(h.sentence).toBe('You have $3,150.00 left for the remaining 30 days, about $105.00 a day.')
    })

    it('rounds the daily allowance down', () => {
      // $100.00 over 3 days is $33.333...; never overstate it.
      expect(hero(totals(0, 10000), current(27)).sentence).toBe(
        'You have $100.00 left for the remaining 3 days, about $33.33 a day.',
      )
    })

    it('uses singular "day" and handles the last day', () => {
      expect(hero(totals(0, 10000), current(29)).sentence).toBe(
        'You have $100.00 left for the remaining 1 day, about $100.00 a day.',
      )
      expect(hero(totals(0, 10000), current(30)).sentence).toBe('You have $100.00 left on the last day of the month.')
    })

    it('flags being over budget, rounding the figure up', () => {
      expect(hero(totals(120000, 100000), current(20))).toMatchObject({
        figure: '$200 over',
        tone: 'critical',
        sentence: "You're $200.00 over budget with 10 days left.",
      })
      expect(hero(totals(120001, 100000), current(20)).figure).toBe('$201 over')
      expect(hero(totals(120000, 100000), current(29)).sentence).toBe("You're $200.00 over budget with 1 day left.")
      expect(hero(totals(120000, 100000), current(30)).sentence).toBe(
        "You're $200.00 over budget on the last day of the month.",
      )
    })

    it('shows small overspends exactly instead of "$0 over"', () => {
      expect(hero(totals(100030, 100000), current(20))).toMatchObject({ figure: '$0.30 over', tone: 'critical' })
    })

    it('names overspent categories even when the month as a whole is fine', () => {
      expect(hero(totals(40000, 100000), current(15), [row('Dining Out', 3183)])).toMatchObject({
        tone: 'good',
        detail: 'Over budget in Dining Out (+$31.83).',
      })
    })

    it('treats a $0 budget with no spending as within budget', () => {
      expect(hero(totals(0, 0), current(10))).toMatchObject({
        figure: '$0.00 left',
        tone: 'good',
        sentence: 'You have $0.00 left for the remaining 20 days, about $0.00 a day.',
      })
    })
  })

  describe('finished months', () => {
    it('says how the month finished', () => {
      expect(hero(totals(90000, 100000), past)).toMatchObject({
        figure: '$100 under',
        tone: 'good',
        sentence: 'You finished October 2026 $100.00 under budget.',
      })
      expect(hero(totals(100000, 100000), past)).toMatchObject({
        figure: 'On budget',
        sentence: 'You finished October 2026 exactly on budget.',
      })
      expect(hero(totals(130000, 100000), past)).toMatchObject({
        figure: '$300 over',
        tone: 'critical',
        sentence: 'You finished October 2026 $300.00 over budget.',
      })
    })

    it('shows small amounts exactly', () => {
      expect(hero(totals(99960, 100000), past).figure).toBe('$0.40 under')
    })

    it('does not talk about the future for a finished month without budgets', () => {
      expect(hero(totals(0, null), past)).toMatchObject({ figure: '$0.00 spent', sentence: 'Nothing was spent in October 2026.' })
      expect(hero(totals(5000, null), past)).toMatchObject({ figure: '$50 spent', sentence: 'No budgets were set for October 2026.' })
    })
  })

  describe('current month without budgets', () => {
    it('falls back to spending and suggests budgets', () => {
      expect(hero(totals(4250, null), current(10))).toEqual({
        figure: '$43 spent',
        tone: 'neutral',
        sentence: 'Set budgets to see how much is left.',
        detail: null,
      })
      expect(hero(totals(0, null), current(10)).sentence).toBe(
        'Nothing spent in October 2026 yet. Set budgets to see how much is left.',
      )
    })
  })

  describe('months that have not started', () => {
    it('says so, with or without budgets', () => {
      expect(hero(totals(0, 545000), future)).toMatchObject({
        figure: '$5,450 budgeted',
        sentence: "October 2026 hasn't started yet.",
      })
      expect(hero(totals(0, null), future)).toMatchObject({
        figure: 'Not started',
        sentence: "October 2026 hasn't started yet. You can set its budgets ahead of time.",
      })
    })

    it('acknowledges expenses already dated to it', () => {
      expect(hero(totals(12000, null), future)).toEqual({
        figure: '$120 spent',
        tone: 'neutral',
        sentence: "October 2026 hasn't started yet. $120.00 is already dated to it.",
        detail: null,
      })
      expect(hero(totals(12000, 50000), future).sentence).toBe(
        "October 2026 hasn't started yet. $120.00 is already dated to it, against a $500.00 budget.",
      )
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
    expect(view.month).toBe('2026-09-01')
    expect(view.label).toBe('September 2026')
    expect(view.progress.phase).toBe('past')
    expect(view.totals.remainingCents).toBe(10000)
    expect(view.hero).toMatchObject({ figure: '$100 under', sentence: 'You finished September 2026 $100.00 under budget.' })
    expect(view.pace.pace).toEqual([100000])
  })
})
