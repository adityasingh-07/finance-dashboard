import { Link } from 'react-router'
import { ExpenseForm } from '../components/ExpenseForm.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { useCategories } from '../hooks/useCategories.ts'
import { useMonthlySummary } from '../hooks/useMonthlySummary.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { toMonthParam } from '../lib/dates.ts'
import { formatCents } from '../lib/money.ts'

// Summary numbers and quick-add for now; charts arrive in Phase 3.
export function DashboardPage() {
  const [month, setMonth] = useSelectedMonth()
  const categories = useCategories()
  const summary = useMonthlySummary(month)

  const rows = summary.data ?? []
  const spent = rows.reduce((sum, r) => sum + r.spent_cents, 0)
  const budget = rows.reduce((sum, r) => sum + (r.limit_cents ?? 0), 0)
  const remaining = budget - spent

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <section className="stat-row" aria-label="Month summary">
        <div className="card">
          <div className="stat-label">Spent</div>
          <div className="stat-value">{summary.data ? formatCents(spent) : '—'}</div>
        </div>
        <div className="card">
          <div className="stat-label">Budget</div>
          <div className="stat-value">{summary.data ? formatCents(budget) : '—'}</div>
        </div>
        <div className="card">
          <div className="stat-label">{remaining < 0 ? 'Over budget' : 'Remaining'}</div>
          <div className={`stat-value${remaining < 0 ? ' over' : ''}`}>
            {summary.data ? formatCents(Math.abs(remaining)) : '—'}
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="quick-add-heading">
        <div className="card-header">
          <h2 id="quick-add-heading">Quick add</h2>
          <Link to={`/expenses?month=${toMonthParam(month)}`}>View all expenses →</Link>
        </div>
        {categories.data && <ExpenseForm key={month} categories={categories.data} month={month} />}
      </section>
    </>
  )
}
