import { expect, signInAsDemo, signUp, test } from './fixtures.ts'

test('signed-out visitors are sent to sign in, then back to the page they wanted', async ({ page }) => {
  await page.goto('/budgets')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page).toHaveURL(/\/budgets$/)
  await expect(page.getByRole('heading', { name: 'Budgets', level: 1 })).toBeVisible()
})

test('a new account starts with the ten default categories', async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: 'Categories', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(10)
})

test('signing out ends the session', async ({ page }) => {
  await signInAsDemo(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/expenses')
  await expect(page).toHaveURL(/\/login$/)
})
