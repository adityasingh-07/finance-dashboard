import { useMemo } from 'react'
import { Link } from 'react-router'
import { CategoryChart } from '../components/charts/CategoryChart.tsx'
import { ChartSkeleton } from '../components/charts/ChartCard.tsx'
import { PaceChart } from '../components/charts/PaceChart.tsx'
import { ExpenseForm } from '../components/ExpenseForm.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { useCategories } from '../hooks/useCategories.ts'
import { useDashboardData } from '../hooks/useDashboardData.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { buildDashboardView, type DashboardView } from '../lib/dashboard.ts'
import { formatMonth, todayISO, toMonthParam } from '../lib/dates.ts'
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

  return (
    <>
      <h1 className="visually-hidden">Dashboard, {formatMonth(month)}</h1>
      <div className="page-header">
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

      {view ? (
        <DashboardHero view={view} monthParam={monthParam} dimmed={dimmed} />
      ) : (
        dashboard.isPending && <ChartSkeleton height={180} />
      )}

      <section className="card" aria-labelledby="quick-add-heading">
        <div className="card-header">
          <h2 id="quick-add-heading">Add an expense</h2>
          <Link to={`/expenses?month=${monthParam}`}>See all expenses</Link>
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

/** The month's key fact as a headline, with the supporting numbers beside it. */
function DashboardHero({ view, monthParam, dimmed }: { view: DashboardView; monthParam: string; dimmed: boolean }) {
  const { hero, totals } = view
  return (
    <section
      className={`hero hero-${hero.tone}${dimmed ? ' is-dimmed' : ''}`}
      aria-label={`${view.label} summary`}
      aria-busy={dimmed || undefined}
    >
      <div>
        <p className="hero-figure">{hero.figure}</p>
        <p className="hero-sentence" role="status">
          {hero.sentence}
        </p>
        {hero.detail && <p className="hero-detail">{hero.detail}</p>}
      </div>
      <dl className="hero-facts">
        <div>
          <dt>Spent</dt>
          <dd>{formatCents(totals.spentCents)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>
            {totals.hasBudgets ? (
              formatCents(totals.budgetCents)
            ) : (
              <Link to={`/budgets?month=${monthParam}`}>Set budgets</Link>
            )}
          </dd>
        </div>
        {totals.hasBudgets && totals.unbudgetedSpentCents > 0 && (
          <div>
            <dt>Outside budgets</dt>
            <dd>{formatCents(totals.unbudgetedSpentCents)}</dd>
          </div>
        )}
      </dl>
    </section>
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
        <div className="card chart-card">
          <ChartSkeleton height={300} />
        </div>
        <div className="card chart-card">
          <ChartSkeleton height={260} />
        </div>
      </div>
    )
  }
  if (!view) return null

  const { totals, rows, pace, label, progress } = view

  if (totals.spentCents === 0 && !totals.hasBudgets) {
    // The hero already says the month is empty or hasn't started; this card
    // only explains where the charts went.
    if (progress.phase === 'future') return null
    return (
      <section className="card empty-state" aria-label="Charts">
        <strong>Your charts will appear here</strong>
        Add an expense for {label} above to see your spending pace and where the money went.
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
