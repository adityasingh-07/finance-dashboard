import { describe, expect, it } from 'vitest'
import { parseExpenseForm } from './expenseForm.ts'

const valid = { amount: '12.50', categoryId: 'cat-1', spentOn: '2026-10-05', note: '  Lunch  ' }

describe('parseExpenseForm', () => {
  it('converts valid input into an ExpenseInput', () => {
    expect(parseExpenseForm(valid)).toEqual({
      ok: true,
      data: { amount_cents: 1250, category_id: 'cat-1', spent_on: '2026-10-05', note: 'Lunch' },
    })
  })

  it('stores a blank note as null', () => {
    const result = parseExpenseForm({ ...valid, note: '   ' })
    expect(result.ok && result.data.note).toBeNull()
  })

  it('reports one message per invalid field', () => {
    const result = parseExpenseForm({ amount: '0', categoryId: '', spentOn: '', note: 'x'.repeat(201) })
    expect(result).toEqual({
      ok: false,
      errors: {
        amount: 'Enter an amount like 12.50',
        categoryId: 'Choose a category',
        spentOn: 'Choose a date',
        note: 'Keep notes under 200 characters',
      },
    })
  })
})
