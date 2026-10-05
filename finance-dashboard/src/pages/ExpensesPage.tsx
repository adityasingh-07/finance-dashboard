import { useMemo, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm.tsx'
import { ExpenseTable } from '../components/ExpenseTable.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { useCategories } from '../hooks/useCategories.ts'
import { useExpenses } from '../hooks/useExpenses.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { formatMonth } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { formatCents } from '../lib/money.ts'

export function ExpensesPage() {
  const [month, setMonth] = useSelectedMonth()
  const categories = useCategories()
  const expenses = useExpenses(month)
  const [categoryFilter, setCategoryFilter] = useState('')

  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )

  const visible = useMemo(
    () =>
      (expenses.data ?? []).filter((e) => !categoryFilter || e.category_id === categoryFilter),
    [expenses.data, categoryFilter],
  )
  const total = visible.reduce((sum, e) => sum + e.amount_cents, 0)

  return (
    <>
      <div className="page-header">
        <h1>Expenses</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <section className="card" aria-labelledby="add-expense-heading">
        <h2 id="add-expense-heading" className="card-header">
          Add an expense
        </h2>
        {categories.data && <ExpenseForm key={month} categories={categories.data} month={month} />}
      </section>

      <section className="card" aria-labelledby="expense-list-heading">
        <div className="card-header">
          <h2 id="expense-list-heading">{formatMonth(month)}</h2>
          <div className="toolbar">
            <label>
              <span className="visually-hidden">Filter by category</span>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All categories</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {expenses.data && (
              <span className="num">
                <span className="muted">
                  {visible.length} {visible.length === 1 ? 'expense' : 'expenses'} ·{' '}
                </span>
                <strong>{formatCents(total)}</strong>
              </span>
            )}
          </div>
        </div>

        {expenses.isPending || categories.isPending ? (
          <p className="muted" role="status">
            Loading expenses…
          </p>
        ) : expenses.isError ? (
          <p className="form-error" role="alert">
            {friendlyError(expenses.error)}
          </p>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <strong>
              {categoryFilter ? 'No expenses in this category' : `No expenses in ${formatMonth(month)}`}
            </strong>
            {categoryFilter ? 'Try another category or month.' : 'Add one above and it will show up here.'}
          </div>
        ) : (
          <ExpenseTable
            expenses={visible}
            categoriesById={categoriesById}
            categories={categories.data ?? []}
          />
        )}
      </section>
    </>
  )
}
