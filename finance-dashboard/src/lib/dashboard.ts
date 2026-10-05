// Shapes raw month data (category summary + daily totals) into what the
// dashboard shows: chart series, category rows and a plain-language insight.
// Pure functions, so every number on the dashboard is unit-testable.

import { summarizeBudgets, type BudgetTotals } from './budgets.ts'
import { daysInMonth, formatMonth, monthStart, type ISODate } from './dates.ts'
import { formatCents } from './money.ts'

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
// Insight
// ---------------------------------------------------------------------------

export type Insight = {
  tone: 'good' | 'critical'
  /** Short status label shown next to the icon, e.g. "On track". */
  label: string
  message: string
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
 * One plain-language read of the month. Null when there's nothing to say:
 * no budgets set, or a month that hasn't started.
 *
 * Deliberately no pace-based warnings or end-of-month projections: bills that
 * land on one day (rent on the 1st) make straight-line extrapolation cry wolf
 * every month. Everything stated here is exact arithmetic on what's happened.
 */
export function buildInsight(
  totals: BudgetTotals,
  rows: CategoryRow[],
  progress: MonthProgress,
  monthLabel: string,
): Insight | null {
  if (!totals.hasBudgets || progress.phase === 'future') return null

  const detail = overBudgetSentence(rows)
  const { remainingCents } = totals

  if (progress.phase === 'past') {
    if (remainingCents < 0) {
      return {
        tone: 'critical',
        label: 'Over budget',
        message: `You finished ${monthLabel} ${formatCents(-remainingCents)} over budget.`,
        detail,
      }
    }
    return {
      tone: 'good',
      label: 'Within budget',
      message:
        remainingCents === 0
          ? `You finished ${monthLabel} exactly on budget.`
          : `You finished ${monthLabel} ${formatCents(remainingCents)} under budget.`,
      detail,
    }
  }

  const daysLeft = progress.daysInMonth - progress.elapsedDays
  if (remainingCents < 0) {
    return {
      tone: 'critical',
      label: 'Over budget',
      message:
        daysLeft === 0
          ? `You're ${formatCents(-remainingCents)} over budget on the last day of the month.`
          : `You're ${formatCents(-remainingCents)} over budget with ${plural(daysLeft, 'day')} left.`,
      detail,
    }
  }

  if (daysLeft === 0) {
    return {
      tone: 'good',
      label: 'Within budget',
      message: `You have ${formatCents(remainingCents)} left on the last day of the month.`,
      detail,
    }
  }

  // Rounded down so the daily figure never overstates what's left.
  const perDay = Math.floor(remainingCents / daysLeft)
  return {
    tone: 'good',
    label: 'Within budget',
    message: `You have ${formatCents(remainingCents)} left for the remaining ${plural(daysLeft, 'day')}, about ${formatCents(perDay)} a day.`,
    detail,
  }
}

// ---------------------------------------------------------------------------
// Whole dashboard
// ---------------------------------------------------------------------------

export type DashboardView = {
  /** e.g. "October 2026" - the month the data belongs to. */
  label: string
  progress: MonthProgress
  totals: BudgetTotals
  rows: CategoryRow[]
  insight: Insight | null
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
    label,
    progress,
    totals,
    rows,
    insight: buildInsight(totals, rows, progress, label),
    pace: buildPaceSeries(data.daily, totals, progress),
  }
}
