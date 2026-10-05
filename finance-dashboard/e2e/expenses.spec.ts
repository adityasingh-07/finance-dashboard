import { addExpense, expect, monthParam, signUp, test } from './fixtures.ts'

test.beforeEach(async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: 'Expenses', exact: true }).click()
  await expect(page.getByText(/No expenses in/)).toBeVisible()
})

test('validates, adds, edits and deletes an expense', async ({ page }) => {
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.getByRole('alert')).toContainText('Enter an amount like 12.50')

  await addExpense(page, '12.50', 'Groceries', 'Milk and bread')
  const row = page.locator('tbody tr', { hasText: 'Milk and bread' })
  await expect(row).toContainText('$12.50')
  await expect(page.getByLabel('Amount')).toHaveValue('')
  await expect(page.getByLabel('Amount')).toBeFocused()

  await row.getByRole('button', { name: /^Edit/ }).click()
  const editing = page.locator('tr.row-editing')
  await editing.getByLabel('Amount').fill('15')
  await editing.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('tbody tr', { hasText: 'Milk and bread' })).toContainText('$15.00')

  await page.locator('tbody tr', { hasText: 'Milk and bread' }).getByRole('button', { name: /^Edit/ }).click()
  await editing.getByRole('button', { name: 'Delete' }).click()
  await editing.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByText(/No expenses in/)).toBeVisible()
})

test('filters the month by category and totals what is shown', async ({ page }) => {
  await addExpense(page, '10', 'Groceries')
  await addExpense(page, '1,234.56', 'Rent')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('.toolbar')).toContainText('$1,244.56')

  await page.getByLabel('Filter by category').selectOption({ label: 'Rent' })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('.toolbar')).toContainText('$1,234.56')
})

test('the month picker keeps keyboard focus and the month in the URL', async ({ page }) => {
  const previous = page.getByRole('button', { name: 'Previous month' })
  await previous.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`month=${monthParam(-1)}`))
  await expect(previous).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`month=${monthParam(-2)}`))

  await page.getByRole('link', { name: 'Budgets', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/budgets\\?month=${monthParam(-2)}`))
})
