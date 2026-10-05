import { addExpense, expect, signUp, test } from './fixtures.ts'

test('creates a category, rejects duplicates, and renames it', async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: 'Categories', exact: true }).click()

  await page.getByLabel('Name').fill('Pets')
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.locator('tbody tr', { hasText: 'Pets' })).toBeVisible()

  await page.getByLabel('Name').fill('  pets ')
  await page.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByRole('alert')).toHaveText('You already have a category with that name.')

  await page.locator('tbody tr', { hasText: 'Pets' }).getByRole('button', { name: 'Edit' }).click()
  await page.locator('tr.row-editing').getByLabel('Name').fill('Pet care')
  await page.locator('tr.row-editing').getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('tbody tr', { hasText: 'Pet care' })).toBeVisible()
})

test('deleting a category with expenses moves them to another category first', async ({ page }) => {
  await signUp(page)
  await addExpense(page, '30', 'Groceries', 'Farmers market')
  await page.getByRole('link', { name: 'Categories', exact: true }).click()

  const row = page.locator('tbody tr', { hasText: 'Groceries' })
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).toContainText('has expenses. Move them to')
  await row.getByRole('combobox').selectOption({ label: 'Dining Out' })
  await row.getByRole('button', { name: 'Move & delete' }).click()
  await expect(page.locator('tbody tr', { hasText: 'Groceries' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Expenses', exact: true }).click()
  await expect(page.locator('tbody tr', { hasText: 'Farmers market' })).toContainText('Dining Out')
})
