import { useRef, useState, type FormEvent } from 'react'
import type { Category } from '../hooks/useCategories.ts'
import { useAddExpense } from '../hooks/useExpenses.ts'
import { defaultExpenseDate, formatDay, MAX_DATE, MIN_DATE, type ISODate } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { parseExpenseForm, type ExpenseFormErrors } from '../lib/expenseForm.ts'
import { formatCents } from '../lib/money.ts'

const LAST_CATEGORY_KEY = 'expense-form:last-category'

function readLastCategory(): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY)
  } catch {
    return null
  }
}

function writeLastCategory(id: string) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, id)
  } catch {
    // Storage unavailable (private mode etc.); remembering is a nicety.
  }
}

/**
 * The category to show: the user's pick if it still exists, else the last one
 * used, else the first. Derived on every render rather than stored, so a
 * refetched category list (one added or deleted elsewhere) can never leave
 * the select showing one category while the form submits another.
 */
function resolveCategory(categories: Category[], chosen: string | null): string {
  const exists = (id: string | null) => id !== null && categories.some((c) => c.id === id)
  if (exists(chosen)) return chosen!
  const last = readLastCategory()
  if (exists(last)) return last!
  return categories[0]?.id ?? ''
}

/**
 * Quick-add form. Designed for speed: amount is focused, category and date
 * stick between entries, Enter submits.
 *
 * The date defaults to today (or the 1st of a past/future `month`) and is
 * recomputed on every render, so a tab left open overnight doesn't keep using
 * yesterday. A date the user picks sticks only while viewing that month.
 */
export function ExpenseForm({ categories, month }: { categories: Category[]; month: ISODate }) {
  const addExpense = useAddExpense()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [chosenCategory, setChosenCategory] = useState<string | null>(null)
  const categoryId = resolveCategory(categories, chosenCategory)
  const [dateOverride, setDateOverride] = useState<{ month: ISODate; value: string } | null>(null)
  const spentOn = dateOverride?.month === month ? dateOverride.value : defaultExpenseDate(month)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<ExpenseFormErrors>({})
  const [notice, setNotice] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (addExpense.isPending) return
    setNotice(null)

    const parsed = parseExpenseForm({ amount, categoryId, spentOn, note })
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})

    addExpense.mutate(parsed.data, {
      onSuccess: () => {
        const category = categories.find((c) => c.id === parsed.data.category_id)
        setNotice(
          `Added ${formatCents(parsed.data.amount_cents)} to ${category?.name ?? 'expenses'} on ${formatDay(parsed.data.spent_on)}.`,
        )
        writeLastCategory(parsed.data.category_id)
        setAmount('')
        setNote('')
        amountRef.current?.focus()
      },
    })
  }

  if (categories.length === 0) {
    return <p className="muted">Create a category first to start adding expenses.</p>
  }

  return (
    <form onSubmit={onSubmit} className="stack" noValidate>
      <div className="expense-form">
        <label className="field">
          <span>Amount</span>
          <div className="input-money">
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
            />
          </div>
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={categoryId}
            onChange={(e) => setChosenCategory(e.target.value)}
            aria-invalid={errors.categoryId ? true : undefined}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Date</span>
          <input
            type="date"
            min={MIN_DATE}
            max={MAX_DATE}
            value={spentOn}
            onChange={(e) => setDateOverride({ month, value: e.target.value })}
            aria-invalid={errors.spentOn ? true : undefined}
          />
        </label>

        <label className="field field-note">
          <span>Note (optional)</span>
          <input
            type="text"
            maxLength={200}
            placeholder="e.g. Coffee with Sam"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={addExpense.isPending}>
          {addExpense.isPending ? 'Adding…' : 'Add expense'}
        </button>
      </div>

      {Object.values(errors).length > 0 && (
        <p className="form-error" role="alert" id="expense-amount-error">
          {Object.values(errors).join(' · ')}
        </p>
      )}
      {addExpense.isError && (
        <p className="form-error" role="alert">
          {friendlyError(addExpense.error)}
        </p>
      )}
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
    </form>
  )
}
