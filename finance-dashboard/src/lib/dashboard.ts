// Shapes raw month data (category summary + daily totals) into what the
// dashboard shows: chart series, category rows and a plain-language insight.
// Pure functions, so every number on the dashboard is unit-testable.

import { summarizeBudgets, type BudgetTotals } from './budgets.ts'
import { daysInMonth, formatMonth, monthStart, type ISODate } from './dates.ts'
import { formatCents, formatCentsShort } from './money.ts'

// ---------------------------------------------------------------------------
// Month progress
// ---------------------------------------------------------------------------

export type MonthProgress = {
  phase: 'past' | 'current' | 'future'
  daysInMonth: number
  /** Days of the month that have happened, counting today in full. */
  elapsedDays: number
  /** elapsedDays / daysInMonth: 0 for future months, 1 for past ones. */
  fraction: number
}

export function monthProgress(month: ISODate, today: ISODate): MonthProgress {
  const days = daysInMonth(month)
  const start = monthStart(month)
  const todayStart = monthStart(today)
  if (start < todayStart) return { phase: 'past', daysInMonth: days, elapsedDays: days, fraction: 1 }
  if (start > todayStart) return { phase: 'future', daysInMonth: days, elapsedDays: 0, fraction: 0 }
  const elapsedDays = Number(today.slice(8, 10))
  return { phase: 'current', daysInMonth: days, elapsedDays, fraction: elapsedDays / days }
}

// ---------------------------------------------------------------------------
// Pace chart
// ---------------------------------------------------------------------------

export type DailyRow = {
  spent_on: ISODate
  cumulative_cents: number
  budgeted_cumulative_cents: number
}

export type PaceSeries = {
  days: ISODate[]
  /** Running total per day; null for days that haven't happened yet. */
  actual: (number | null)[]
  /** Straight line from 0 to the month's budget; null when there are no budgets. */
  pace: number[] | null
  /**
   * 'budgeted': actual counts only spending in budgeted categories, so it is
   * comparable with the pace line. 'all': no budgets, so actual is all spending.
   */
  measure: 'budgeted' | 'all'
}

export function buildPaceSeries(
  daily: DailyRow[],
  totals: Pick<BudgetTotals, 'hasBudgets' | 'budgetCents'>,
  progress: MonthProgress,
): PaceSeries {
  const measure = totals.hasBudgets ? 'budgeted' : 'all'
  const days = daily.map((d) => d.spent_on)
  const actual = daily.map((d, i) =>
    i < progress.elapsedDays ? (measure === 'budgeted' ? d.budgeted_cumulative_cents : d.cumulative_cents) : null,
  )
  const pace = totals.hasBudgets
    ? daily.map((_, i) => Math.round((totals.budgetCents * (i + 1)) / daily.length))
    : null
  return { days, actual, pace, measure }
}

// ---------------------------------------------------------------------------
// Category chart
// ---------------------------------------------------------------------------

export type CategorySummaryRow = {
  category_id: string
  name: string
  color: string
  spent_cents: number
  limit_cents: number | null
}

export type CategoryRow = {
  id: string
  name: string
  color: string
  spentCents: number
  limitCents: number | null
  /** Share of the month's total spending, 0–100 (one decimal). */
  sharePct: number
  /** Spending above the budget; 0 when within budget or unbudgeted. */
  overByCents: number
}

/**
 * Categories worth showing for the month (anything spent or budgeted), most
 * spent first. Unused, unbudgeted categories are left out.
 */
export function buildCategoryRows(summary: CategorySummaryRow[]): CategoryRow[] {
  const total = summary.reduce((sum, r) => sum + r.spent_cents, 0)
  return summary
    .filter((r) => r.spent_cents > 0 || r.limit_cents !== null)
    .map((r) => ({
      id: r.category_id,
      name: r.name,
      color: r.color,
      spentCents: r.spent_cents,
      limitCents: r.limit_cents,
      sharePct: total > 0 ? Math.round((r.spent_cents / total) * 1000) / 10 : 0,
      overByCents: r.limit_cents !== null ? Math.max(0, r.spent_cents - r.limit_cents) : 0,
    }))
    .sort((a, b) => b.spentCents - a.spentCents || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Hero: the month's key fact
// ---------------------------------------------------------------------------

export type Hero = {
  /** The month's key fact as a short figure: "$2,682 left", "$200 over". */
  figure: string
  tone: 'good' | 'critical' | 'neutral'
  /** One plain-language sentence with the exact amounts. */
  sentence: string
  /** Categories over their budget, worst first, as a sentence (or null). */
  detail: string | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function overBudgetSentence(rows: CategoryRow[]): string | null {
  const over = rows.filter((r) => r.overByCents > 0).sort((a, b) => b.overByCents - a.overByCents)
  if (over.length === 0) return null
  const parts = over.map((r) => `${r.name} (+${formatCents(r.overByCents)})`)
  if (parts.length === 1) return `Over budget in ${parts[0]}.`
  if (parts.length <= 3) return `Over budget in ${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}.`
  return `Over budget in ${parts.slice(0, 2).join(', ')} and ${over.length - 2} more.`
}

/**
 * Amount for the giant figure. Whole dollars, rounded so the figure never
 * flatters: money left is rounded down, overspend rounded up, spending to the
 * nearest dollar. Under $10 the exact amount is shown, so $0.30 over never
 * reads as "$0 over".
 */
export function heroAmount(cents: number, round: 'down' | 'up' | 'nearest'): string {
  if (cents < 1000) return formatCents(cents)
  const dollars =
    round === 'down' ? Math.floor(cents / 100) : round === 'up' ? Math.ceil(cents / 100) : Math.round(cents / 100)
  return formatCentsShort(dollars * 100)
}

/**
 * The headline the dashboard opens with: a short figure plus one sentence.
 *
 * Deliberately no pace-based warnings or end-of-month projections: bills that
 * land on one day (rent on the 1st) make straight-line extrapolation cry wolf
 * every month. Everything stated here is exact arithmetic on what's happened.
 */
export function buildHero(
  totals: BudgetTotals,
  rows: CategoryRow[],
  progress: MonthProgress,
  monthLabel: string,
): Hero {
  const { remainingCents, spentCents, budgetCents, hasBudgets } = totals
  const detail = hasBudgets ? overBudgetSentence(rows) : null

  // A month that hasn't started can still have expenses dated to it.
  if (progress.phase === 'future') {
    if (spentCents > 0) {
      return {
        figure: `${heroAmount(spentCents, 'nearest')} spent`,
        tone: 'neutral',
        sentence: hasBudgets
          ? `${monthLabel} hasn't started yet. ${formatCents(spentCents)} is already dated to it, against a ${formatCents(budgetCents)} budget.`
          : `${monthLabel} hasn't started yet. ${formatCents(spentCents)} is already dated to it.`,
        detail,
      }
    }
    return hasBudgets
      ? { figure: `${heroAmount(budgetCents, 'nearest')} budgeted`, tone: 'neutral', sentence: `${monthLabel} hasn't started yet.`, detail: null }
      : { figure: 'Not started', tone: 'neutral', sentence: `${monthLabel} hasn't started yet. You can set its budgets ahead of time.`, detail: null }
  }

  if (!hasBudgets) {
    let sentence: string
    if (progress.phase === 'past') {
      sentence = spentCents === 0 ? `Nothing was spent in ${monthLabel}.` : `No budgets were set for ${monthLabel}.`
    } else {
      sentence =
        spentCents === 0
          ? `Nothing spent in ${monthLabel} yet. Set budgets to see how much is left.`
          : 'Set budgets to see how much is left.'
    }
    return { figure: `${heroAmount(spentCents, 'nearest')} spent`, tone: 'neutral', sentence, detail: null }
  }

  if (progress.phase === 'past') {
    if (remainingCents < 0) {
      return {
        figure: `${heroAmount(-remainingCents, 'up')} over`,
        tone: 'critical',
        sentence: `You finished ${monthLabel} ${formatCents(-remainingCents)} over budget.`,
        detail,
      }
    }
    return {
      figure: remainingCents === 0 ? 'On budget' : `${heroAmount(remainingCents, 'down')} under`,
      tone: 'good',
      sentence:
        remainingCents === 0
          ? `You finished ${monthLabel} exactly on budget.`
          : `You finished ${monthLabel} ${formatCents(remainingCents)} under budget.`,
      detail,
    }
  }

  const daysLeft = progress.daysInMonth - progress.elapsedDays
  if (remainingCents < 0) {
    return {
      figure: `${heroAmount(-remainingCents, 'up')} over`,
      tone: 'critical',
      sentence:
        daysLeft === 0
          ? `You're ${formatCents(-remainingCents)} over budget on the last day of the month.`
          : `You're ${formatCents(-remainingCents)} over budget with ${plural(daysLeft, 'day')} left.`,
      detail,
    }
  }

  const figure = `${heroAmount(remainingCents, 'down')} left`
  if (daysLeft === 0) {
    return { figure, tone: 'good', sentence: `You have ${formatCents(remainingCents)} left on the last day of the month.`, detail }
  }
  // Rounded down so the daily figure never overstates what's left.
  const perDay = Math.floor(remainingCents / daysLeft)
  return {
    figure,
    tone: 'good',
    sentence: `You have ${formatCents(remainingCents)} left for the remaining ${plural(daysLeft, 'day')}, about ${formatCents(perDay)} a day.`,
    detail,
  }
}

// ---------------------------------------------------------------------------
// Whole dashboard
// ---------------------------------------------------------------------------

export type DashboardView = {
  /** The month the data belongs to (1st of the month). */
  month: ISODate
  /** e.g. "October 2026". */
  label: string
  progress: MonthProgress
  totals: BudgetTotals
  rows: CategoryRow[]
  hero: Hero
  pace: PaceSeries
}

/** Everything the dashboard renders, derived from one month's raw data. */
export function buildDashboardView(
  data: { month: ISODate; summary: CategorySummaryRow[]; daily: DailyRow[] },
  today: ISODate,
): DashboardView {
  const progress = monthProgress(data.month, today)
  const totals = summarizeBudgets(data.summary)
  const rows = buildCategoryRows(data.summary)
  const label = formatMonth(data.month)
  return {
    month: data.month,
    label,
    progress,
    totals,
    rows,
    hero: buildHero(totals, rows, progress, label),
    pace: buildPaceSeries(data.daily, totals, progress),
  }
}
