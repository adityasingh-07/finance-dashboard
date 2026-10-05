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
import { summarizeBudgets } from '../lib/budgets.ts'
import { addMonths, formatMonth, type ISODate } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { centsToInput, formatCents, parseAmountToCents } from '../lib/money.ts'

export function BudgetsPage() {
  const [month, setMonth] = useSelectedMonth()
  const previousMonth = addMonths(month, -1)

  const categories = useCategories()
  const budgets = useBudgets(month)
  const summary = useMonthlySummary(month)
  const previousSummary = useMonthlySummary(previousMonth)
  const copyBudgets = useCopyBudgets()

  // Spend maps are undefined until their query succeeds, so the grid shows
  // "—" rather than a misleading $0.00 while loading or after an error.
  const spentThis = summary.data && new Map(summary.data.map((s) => [s.category_id, s.spent_cents]))
  const spentLast =
    previousSummary.data && new Map(previousSummary.data.map((s) => [s.category_id, s.spent_cents]))
  const budgetByCategory = new Map((budgets.data ?? []).map((b) => [b.category_id, b]))

  const totalBudget = (budgets.data ?? []).reduce((sum, b) => sum + b.limit_cents, 0)
  const totalLast = previousSummary.data && summarizeBudgets(previousSummary.data).spentCents
  // Only spending in budgeted categories can push the month over budget.
  const totals =
    spentThis &&
    summarizeBudgets(
      (categories.data ?? []).map((c) => ({
        spent_cents: spentThis.get(c.id) ?? 0,
        limit_cents: budgetByCategory.get(c.id)?.limit_cents ?? null,
      })),
    )

  // Last month had budgets: limit_cents is non-null exactly for budgeted categories.
  const canCopy =
    budgets.data?.length === 0 &&
    (previousSummary.data?.some((s) => s.limit_cents !== null) ?? false)
  const spendError = summary.error ?? previousSummary.error

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

        {spendError && (
          <div className="form-error" role="alert">
            Couldn't load spending: {friendlyError(spendError)}{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                void summary.refetch()
                void previousSummary.refetch()
              }}
            >
              Try again
            </button>
          </div>
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
                    spentThis={spentThis ? (spentThis.get(category.id) ?? 0) : null}
                    spentLast={spentLast ? (spentLast.get(category.id) ?? 0) : null}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num col-last">{formatMaybe(totalLast)}</td>
                  <td
                    className={`num${totals && totals.hasBudgets && totals.remainingCents < 0 ? ' over' : ''}`}
                  >
                    {formatMaybe(totals?.spentCents)}
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

function formatMaybe(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '—' : formatCents(cents)
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
  /** null while spending is loading or failed to load. */
  spentThis: number | null
  spentLast: number | null
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

  const over = budget !== undefined && spentThis !== null && spentThis > budget.limit_cents
  const inputId = `budget-${category.id}`

  return (
    <tr>
      <td>
        <label htmlFor={inputId}>
          <CategoryLabel name={category.name} color={category.color} />
        </label>
      </td>
      <td className="num muted col-last">{formatMaybe(spentLast)}</td>
      <td className={`num${over ? ' over' : ''}`}>{formatMaybe(spentThis)}</td>
      <td className="num col-budget">
        <div className="input-money">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="None"
            value={value}
            // Locked while a save is in flight so a second edit can't race it
            // and leave the database holding whichever request landed last.
            disabled={status === 'saving'}
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
