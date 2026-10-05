import { Link } from 'react-router'
import { ExpenseForm } from '../components/ExpenseForm.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { useCategories } from '../hooks/useCategories.ts'
import { useMonthlySummary } from '../hooks/useMonthlySummary.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { summarizeBudgets } from '../lib/budgets.ts'
import { toMonthParam } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { formatCents } from '../lib/money.ts'

// Summary numbers and quick-add for now; charts arrive in Phase 3.
export function DashboardPage() {
  const [month, setMonth] = useSelectedMonth()
  const categories = useCategories()
  const summary = useMonthlySummary(month)

  const totals = summary.data ? summarizeBudgets(summary.data) : null
  const monthParam = toMonthParam(month)
  const over = totals !== null && totals.hasBudgets && totals.remainingCents < 0

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {summary.isError && (
        <div className="form-error" role="alert">
          Couldn't load this month's totals: {friendlyError(summary.error)}{' '}
          <button type="button" className="link-button" onClick={() => void summary.refetch()}>
            Try again
          </button>
        </div>
      )}

      <section className="stat-row" aria-label="Month summary">
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
    </>
  )
}
