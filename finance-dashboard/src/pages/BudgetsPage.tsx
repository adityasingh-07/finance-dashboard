import { useState } from 'react'
import { CategoryLabel } from '../components/CategoryLabel.tsx'
import { MonthPicker } from '../components/MonthPicker.tsx'
import {
  useBudgets,
  useCopyBudgets,
  useDeleteBudget,
  useSetBudget,
  type Budget,
} from '../hooks/useBudgets.ts'
import { useCategories, type Category } from '../hooks/useCategories.ts'
import { useMonthlySummary } from '../hooks/useMonthlySummary.ts'
import { useSelectedMonth } from '../hooks/useSelectedMonth.ts'
import { addMonths, formatMonth, type ISODate } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { centsToInput, formatCents, parseAmountToCents } from '../lib/money.ts'

export function BudgetsPage() {
  const [month, setMonth] = useSelectedMonth()
  const previousMonth = addMonths(month, -1)

  const categories = useCategories()
  const budgets = useBudgets(month)
  const previousBudgets = useBudgets(previousMonth)
  const summary = useMonthlySummary(month)
  const previousSummary = useMonthlySummary(previousMonth)
  const copyBudgets = useCopyBudgets()

  const spentThis = new Map((summary.data ?? []).map((s) => [s.category_id, s.spent_cents]))
  const spentLast = new Map((previousSummary.data ?? []).map((s) => [s.category_id, s.spent_cents]))
  const budgetByCategory = new Map((budgets.data ?? []).map((b) => [b.category_id, b]))

  const totalBudget = (budgets.data ?? []).reduce((sum, b) => sum + b.limit_cents, 0)
  const totalSpent = (summary.data ?? []).reduce((sum, s) => sum + s.spent_cents, 0)
  const totalLast = (previousSummary.data ?? []).reduce((sum, s) => sum + s.spent_cents, 0)

  const canCopy = budgets.data?.length === 0 && (previousBudgets.data?.length ?? 0) > 0

  return (
    <>
      <div className="page-header">
        <h1>Budgets</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <section className="card" aria-labelledby="budgets-heading">
        <div className="card-header">
          <div>
            <h2 id="budgets-heading">{formatMonth(month)}</h2>
            <p className="muted" style={{ margin: 0 }}>
              Set a monthly limit per category. Changes save when you leave the field. Clear a
              field to remove its budget.
            </p>
          </div>
          {canCopy && (
            <button
              type="button"
              className="btn"
              disabled={copyBudgets.isPending}
              onClick={() => copyBudgets.mutate({ from: previousMonth, to: month })}
            >
              {copyBudgets.isPending ? 'Copying…' : `Copy from ${formatMonth(previousMonth)}`}
            </button>
          )}
        </div>

        {copyBudgets.isError && (
          <p className="form-error" role="alert">
            {friendlyError(copyBudgets.error)}
          </p>
        )}

        {categories.isPending || budgets.isPending ? (
          <p className="muted" role="status">
            Loading budgets…
          </p>
        ) : categories.isError || budgets.isError ? (
          <p className="form-error" role="alert">
            {friendlyError(categories.error ?? budgets.error)}
          </p>
        ) : categories.data.length === 0 ? (
          <div className="empty-state">
            <strong>No categories yet</strong>
            Create categories first, then set budgets for them here.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="num col-last">
                    Spent last month
                  </th>
                  <th scope="col" className="num">
                    Spent this month
                  </th>
                  <th scope="col" className="num">
                    Budget
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.data.map((category) => (
                  <BudgetRow
                    key={`${month}-${category.id}`}
                    month={month}
                    category={category}
                    budget={budgetByCategory.get(category.id)}
                    spentThis={spentThis.get(category.id) ?? 0}
                    spentLast={spentLast.get(category.id) ?? 0}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num col-last">{formatCents(totalLast)}</td>
                  <td className={`num${totalBudget > 0 && totalSpent > totalBudget ? ' over' : ''}`}>
                    {formatCents(totalSpent)}
                  </td>
                  <td className="num">{formatCents(totalBudget)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function BudgetRow({
  month,
  category,
  budget,
  spentThis,
  spentLast,
}: {
  month: ISODate
  category: Category
  budget: Budget | undefined
  spentThis: number
  spentLast: number
}) {
  const setBudget = useSetBudget()
  const deleteBudget = useDeleteBudget()

  // null while not editing, so the field always reflects the latest saved
  // value (e.g. after "Copy from last month") unless the user is typing.
  const [draft, setDraft] = useState<string | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const saved = budget ? centsToInput(budget.limit_cents) : ''
  const value = draft ?? saved

  function commit() {
    if (draft === null) return
    const text = draft.trim()
    const callbacks = {
      onSuccess: () => {
        setDraft(null)
        setStatus('saved')
      },
      onError: (err: Error) => {
        setStatus('error')
        setError(friendlyError(err))
      },
    }

    if (text === '') {
      if (!budget) return setDraft(null)
      setStatus('saving')
      deleteBudget.mutate(budget.id, callbacks)
      return
    }

    const cents = parseAmountToCents(text, { allowZero: true })
    if (cents === null) {
      setStatus('error')
      setError('Enter an amount like 250 or 250.00')
      return
    }
    if (cents === budget?.limit_cents) return setDraft(null)

    setStatus('saving')
    setBudget.mutate({ category_id: category.id, month, limit_cents: cents }, callbacks)
  }

  const over = budget !== undefined && spentThis > budget.limit_cents
  const inputId = `budget-${category.id}`

  return (
    <tr>
      <td>
        <label htmlFor={inputId}>
          <CategoryLabel name={category.name} color={category.color} />
        </label>
      </td>
      <td className="num muted col-last">{formatCents(spentLast)}</td>
      <td className={`num${over ? ' over' : ''}`}>{formatCents(spentThis)}</td>
      <td className="num col-budget">
        <div className="input-money">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="No budget"
            value={value}
            onFocus={() => setDraft(value)}
            onChange={(e) => {
              setDraft(e.target.value)
              setStatus('idle')
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft(null)
                setStatus('idle')
              }
            }}
            aria-invalid={status === 'error' ? true : undefined}
            aria-describedby={status === 'error' ? `${inputId}-error` : undefined}
          />
        </div>
        <span
          className={`save-status${status === 'saved' ? ' saved' : ''}`}
          role="status"
          id={`${inputId}-error`}
        >
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && <span className="field-error">{error}</span>}
        </span>
      </td>
    </tr>
  )
}
