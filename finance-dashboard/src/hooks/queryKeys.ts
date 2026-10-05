import type { ISODate } from '../lib/dates.ts'

// Every query key in the app. Mutations invalidate by prefix (e.g. ['expenses']
// covers every month), so the first element is the "table" a query depends on.
export const queryKeys = {
  categories: ['categories'] as const,
  expenses: (month: ISODate) => ['expenses', month] as const,
  budgets: (month: ISODate) => ['budgets', month] as const,
  summary: (month: ISODate) => ['summary', month] as const,
  dashboard: (month: ISODate) => ['dashboard', month] as const,
}

// Prefixes to invalidate after each kind of change.
export const dependsOn = {
  expenses: [['expenses'], ['summary'], ['dashboard']],
  budgets: [['budgets'], ['summary'], ['dashboard']],
  // Expense and budget rows only hold category_id, so creating, renaming or
  // recolouring a category leaves them unchanged. The summary carries the
  // category name and colour, so it does need a refetch.
  categories: [['categories'], ['summary'], ['dashboard']],
  // Deleting cascades budgets and may move expenses to another category.
  categoryDelete: [['categories'], ['expenses'], ['budgets'], ['summary'], ['dashboard']],
} as const
