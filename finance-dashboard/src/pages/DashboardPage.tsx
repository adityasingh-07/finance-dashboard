import { useMemo } from 'react'
import { Link } from 'react-router'
import { CategoryChart } from '../components/charts/CategoryChart.tsx'
import { ChartSkeleton } from '../components/charts/ChartCard.tsx'
import { PaceChart } from '../components/charts/PaceChart.tsx'
import { ExpenseForm } from '../components/ExpenseForm.tsx'
import { InsightCallout } from '../components/InsightCallout.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { useCategories } from '../hooks/useCategories.ts'
import { useDashboardData } from '../hooks/useDashboardData.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { buildDashboardView, type DashboardView } from '../lib/dashboard.ts'
import { todayISO, toMonthParam } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { formatCents } from '../lib/money.ts'

export function DashboardPage() {
  const [month, setMonth] = useSelectedMonth()
  const categories = useCategories()
  const dashboard = useDashboardData(month)
  const today = todayISO()

  // Everything below derives from dashboard.data.month - the month the data
  // belongs to - so while a new month loads, the previous render stays
  // consistent (and dimmed) instead of mixing two months.
  const view = useMemo(
    () => (dashboard.data ? buildDashboardView(dashboard.data, today) : null),
    [dashboard.data, today],
  )

  const dimmed = dashboard.isPlaceholderData
  const monthParam = toMonthParam(month)
  const totals = view?.totals ?? null
  const over = totals !== null && totals.hasBudgets && totals.remainingCents < 0

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {dashboard.isError && (
        <div className="form-error" role="alert">
          Couldn't load this month's numbers: {friendlyError(dashboard.error)}{' '}
          <button type="button" className="link-button" onClick={() => void dashboard.refetch()}>
            Try again
          </button>
        </div>
      )}

      {view?.insight && <InsightCallout insight={view.insight} dimmed={dimmed} />}

      <section className={`stat-row${dimmed ? ' is-dimmed' : ''}`} aria-label="Month summary">
        <div className="card">
          <div className="stat-label">Spent</div>
          <div className="stat-value">{totals ? formatCents(totals.spentCents) : '—'}</div>
          {totals && totals.hasBudgets && totals.unbudgetedSpentCents > 0 && (
            <div className="stat-note">
              {formatCents(totals.unbudgetedSpentCents)} in categories without a budget
            </div>
          )}
        </div>

        <div className="card">
          <div className="stat-label">Budget</div>
          {totals && !totals.hasBudgets ? (
            <>
              <div className="stat-value muted">No budgets</div>
              <Link className="stat-note" to={`/budgets?month=${monthParam}`}>
                Set budgets →
              </Link>
            </>
          ) : (
            <div className="stat-value">{totals ? formatCents(totals.budgetCents) : '—'}</div>
          )}
        </div>

        <div className="card">
          <div className="stat-label">{over ? 'Over budget' : 'Remaining'}</div>
          <div className={`stat-value${over ? ' over' : ''}`}>
            {totals && totals.hasBudgets ? formatCents(Math.abs(totals.remainingCents)) : '—'}
          </div>
          {totals && !totals.hasBudgets && (
            <div className="stat-note">Set a budget to track what's left</div>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="quick-add-heading">
        <div className="card-header">
          <h2 id="quick-add-heading">Quick add</h2>
          <Link to={`/expenses?month=${monthParam}`}>View all expenses →</Link>
        </div>
        {categories.isError ? (
          <p className="form-error" role="alert">
            Couldn't load your categories: {friendlyError(categories.error)}
          </p>
        ) : categories.data ? (
          <ExpenseForm categories={categories.data} month={month} />
        ) : (
          <p className="muted" role="status">
            Loading…
          </p>
        )}
      </section>

      <DashboardCharts view={view} dimmed={dimmed} loading={dashboard.isPending} />
    </>
  )
}

function DashboardCharts({
  view,
  dimmed,
  loading,
}: {
  view: DashboardView | null
  dimmed: boolean
  loading: boolean
}) {
  if (loading) {
    // First load only; later month changes keep the previous render dimmed.
    return (
      <div className="charts" aria-busy="true">
        <div className="card">
          <ChartSkeleton height={300} />
        </div>
        <div className="card">
          <ChartSkeleton height={260} />
        </div>
      </div>
    )
  }
  if (!view) return null

  const { totals, rows, pace, label, progress } = view

  if (totals.spentCents === 0 && !totals.hasBudgets) {
    return (
      <section className="card empty-state" aria-label="Charts">
        <strong>
          {progress.phase === 'future' ? `${label} hasn't started yet` : `No expenses in ${label} yet`}
        </strong>
        {progress.phase === 'future'
          ? 'Set budgets for it ahead of time, or pick another month.'
          : 'Add your first one above and your charts will appear here.'}
      </section>
    )
  }

  return (
    <div className="charts">
      <PaceChart
        series={pace}
        budgetCents={totals.budgetCents}
        unbudgetedSpentCents={totals.unbudgetedSpentCents}
        monthLabel={label}
        dimmed={dimmed}
      />
      {rows.length > 0 && <CategoryChart rows={rows} monthLabel={label} dimmed={dimmed} />}
    </div>
  )
}
