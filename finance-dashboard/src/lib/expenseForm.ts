import { z } from 'zod'
import type { ISODate } from './dates.ts'
import { parseAmountToCents } from './money.ts'

/** What the app writes to the expenses table (user_id comes from the DB default). */
export type ExpenseInput = {
  category_id: string
  amount_cents: number
  spent_on: ISODate
  note: string | null
}

/** Raw form field values, as typed by the user. */
export type ExpenseFormValues = {
  amount: string
  categoryId: string
  spentOn: string
  note: string
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>

const schema = z.object({
  amount: z.string().transform((value, ctx) => {
    const cents = parseAmountToCents(value)
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount like 12.50' })
      return z.NEVER
    }
    return cents
  }),
  categoryId: z.string().min(1, 'Choose a category'),
  spentOn: z.iso.date({ message: 'Choose a date' }),
  note: z.string().trim().max(200, 'Keep notes under 200 characters'),
})

/** Validates form values and converts them into an ExpenseInput. */
export function parseExpenseForm(
  values: ExpenseFormValues,
): { ok: true; data: ExpenseInput } | { ok: false; errors: ExpenseFormErrors } {
  const result = schema.safeParse(values)
  if (!result.success) {
    const errors: ExpenseFormErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof ExpenseFormValues
      errors[field] ??= issue.message
    }
    return { ok: false, errors }
  }
  const { amount, categoryId, spentOn, note } = result.data
  return {
    ok: true,
    data: { amount_cents: amount, category_id: categoryId, spent_on: spentOn, note: note || null },
  }
}
