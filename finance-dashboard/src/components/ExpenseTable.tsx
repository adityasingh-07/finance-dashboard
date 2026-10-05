import { useState, type KeyboardEvent } from 'react'
import type { Category } from '../hooks/useCategories.ts'
import { useDeleteExpense, useUpdateExpense, type Expense } from '../hooks/useExpenses.ts'
import { formatDay } from '../lib/dates.ts'
import { friendlyError } from '../lib/dbErrors.ts'
import { parseExpenseForm, type ExpenseFormErrors } from '../lib/expenseForm.ts'
import { centsToInput, formatCents } from '../lib/money.ts'
import { CategoryLabel } from './CategoryLabel.tsx'

type Props = {
  expenses: Expense[]
  categoriesById: Map<string, Category>
  categories: Category[]
}

export function ExpenseTable({ expenses, categoriesById, categories }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="table-wrap">
      <table className="table expense-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Category</th>
            <th scope="col" className="col-note">
              Note
            </th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) =>
            expense.id === editingId ? (
              <EditRow
                key={expense.id}
                expense={expense}
                categories={categories}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <ViewRow
                key={expense.id}
                expense={expense}
                category={categoriesById.get(expense.category_id)}
                onEdit={() => setEditingId(expense.id)}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function ViewRow({
  expense,
  category,
  onEdit,
}: {
  expense: Expense
  category: Category | undefined
  onEdit: () => void
}) {
  return (
    <tr>
      <td className="cell-date">{formatDay(expense.spent_on)}</td>
      <td>
        {category ? <CategoryLabel name={category.name} color={category.color} /> : '—'}
        {/* Narrow screens hide the Note column and show it here instead. */}
        {expense.note && <span className="note-inline">{expense.note}</span>}
      </td>
      <td className="col-note cell-note" title={expense.note ?? undefined}>
        {expense.note}
      </td>
      <td className="num">{formatCents(expense.amount_cents)}</td>
      <td className="actions">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onEdit}
          aria-label={`Edit ${formatCents(expense.amount_cents)} on ${formatDay(expense.spent_on)}`}
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

function EditRow({
  expense,
  categories,
  onDone,
}: {
  expense: Expense
  categories: Category[]
  onDone: () => void
}) {
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [values, setValues] = useState({
    amount: centsToInput(expense.amount_cents),
    categoryId: expense.category_id,
    spentOn: expense.spent_on,
    note: expense.note ?? '',
  })
  const [errors, setErrors] = useState<ExpenseFormErrors>({})

  const set = (field: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }))

  function save() {
    const parsed = parseExpenseForm(values)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    updateExpense.mutate({ id: expense.id, ...parsed.data }, { onSuccess: onDone })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') save()
    if (e.key === 'Escape') onDone()
  }

  const mutationError = updateExpense.error ?? deleteExpense.error
  const errorText = [...Object.values(errors), mutationError ? friendlyError(mutationError) : null]
    .filter(Boolean)
    .join(' · ')
  const busy = updateExpense.isPending || deleteExpense.isPending

  return (
    <tr className="row-editing" onKeyDown={onKeyDown}>
      <td>
        <input
          type="date"
          aria-label="Date"
          value={values.spentOn}
          onChange={(e) => set('spentOn')(e.target.value)}
          aria-invalid={errors.spentOn ? true : undefined}
        />
      </td>
      <td>
        <select
          aria-label="Category"
          value={values.categoryId}
          onChange={(e) => set('categoryId')(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="col-note">
        <input
          type="text"
          aria-label="Note"
          placeholder="Note"
          maxLength={200}
          value={values.note}
          onChange={(e) => set('note')(e.target.value)}
        />
      </td>
      <td className="num">
        <div className="input-money">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Amount"
            autoFocus
            value={values.amount}
            onChange={(e) => set('amount')(e.target.value)}
            aria-invalid={errors.amount ? true : undefined}
          />
        </div>
      </td>
      <td className="actions">
        <span className="inline-confirm">
          {errorText && (
            <span className="field-error" role="alert">
              {errorText}
            </span>
          )}
          {confirmingDelete ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-danger-solid"
                disabled={busy}
                onClick={() => deleteExpense.mutate(expense.id)}
              >
                {deleteExpense.isPending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
                {updateExpense.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
            </>
          )}
        </span>
      </td>
    </tr>
  )
}
