import { addExpense, expect, monthParam, signUp, test } from './fixtures.ts'

test('saves a budget, flags overspending, and clears it', async ({ page }) => {
  await signUp(page)
  await addExpense(page, '15', 'Groceries')
  await page.getByRole('link', { name: 'Budgets', exact: true }).click()
  await expect(page.locator('tfoot')).toBeVisible()

  const groceries = page.getByRole('textbox', { name: 'Groceries' })
  const row = page.locator('tbody tr', { hasText: 'Groceries' })
  await groceries.fill('10')
  await groceries.press('Enter')
  await expect(row.getByText('Saved')).toBeVisible()
  await expect(row.locator('td').nth(2)).toHaveClass(/\bover\b/)

  await groceries.fill('abc')
  await groceries.blur()
  await expect(row.getByText(/Enter an amount/)).toBeVisible()

  await groceries.fill('')
  await groceries.blur()
  await expect(row.getByText('Saved')).toBeVisible()
  await expect(groceries).toHaveValue('')
})

test('copies last month into an empty month without overwriting', async ({ page }) => {
  await signUp(page)
  await page.goto(`/budgets?month=${monthParam(0)}`)
  await expect(page.locator('tfoot')).toBeVisible()
  await page.getByRole('textbox', { name: 'Groceries' }).fill('400')
  await page.getByRole('textbox', { name: 'Groceries' }).press('Enter')
  await expect(page.locator('tbody tr', { hasText: 'Groceries' }).getByText('Saved')).toBeVisible()
  await page.getByRole('textbox', { name: 'Rent' }).fill('2000')
  await page.getByRole('textbox', { name: 'Rent' }).press('Enter')
  await expect(page.locator('tbody tr', { hasText: 'Rent' }).getByText('Saved')).toBeVisible()

  await page.goto(`/budgets?month=${monthParam(1)}`)
  await expect(page.locator('tfoot')).toBeVisible()
  await page.getByRole('button', { name: /Copy from/ }).click()
  await expect(page.getByRole('textbox', { name: 'Groceries' })).toHaveValue('400')
  await expect(page.getByRole('textbox', { name: 'Rent' })).toHaveValue('2000')
  await expect(page.locator('tfoot')).toContainText('$2,400.00')
})
