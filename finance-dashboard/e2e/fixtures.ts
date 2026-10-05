import { expect, type Page } from '@playwright/test'

export { expect, test } from '@playwright/test'

/** Matches supabase/migrations/*_demo_account.sql and .env.example. */
export const DEMO = { email: 'demo@example.com', password: 'demo-password-123' }

const dashboardHeading = (page: Page) => page.getByRole('heading', { name: /^Dashboard, / })

/** Creates a brand-new account (local auth has email confirmation off). */
export async function signUp(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`
  await page.goto('/login')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('test-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(dashboardHeading(page)).toBeAttached()
  return email
}

/** Signs in as the seeded demo user. Tests using it must not change its data. */
export async function signInAsDemo(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(dashboardHeading(page)).toBeAttached()
}

/** Adds an expense through the quick-add form on the current page. */
export async function addExpense(page: Page, amount: string, category: string, note = '') {
  await page.getByLabel('Amount').fill(amount)
  await page.locator('form select').selectOption({ label: category })
  if (note) await page.getByLabel('Note (optional)').fill(note)
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Added \$/ })).toBeVisible()
}

/** 'YYYY-MM' for the month `offset` months from now, in local time. */
export function monthParam(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Today as the app labels days in tables, e.g. "Mon, 5 Oct". */
export function todayLabel(): string {
  return new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())
}
