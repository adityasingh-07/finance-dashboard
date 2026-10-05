import type { ISODate } from '../lib/dates.ts'

// Every query key in the app. Mutations invalidate by prefix (e.g. ['expenses']
// covers every month), so the first element is the "table" a query depends on.
export const queryKeys = {
  categories: ['categories'] as const,
  expenses: (month: ISODate) => ['expenses', month] as const,
  budgets: (month: ISODate) => ['budgets', month] as const,
  summary: (month: ISODate) => ['summary', month] as const,
}

// Prefixes to invalidate when the underlying table changes.
export const dependsOn = {
  expenses: [['expenses'], ['summary']],
  budgets: [['budgets'], ['summary']],
  categories: [['categories'], ['expenses'], ['budgets'], ['summary']],
} as const
