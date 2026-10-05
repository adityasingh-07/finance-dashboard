import { addExpense, expect, monthParam, signInAsDemo, signUp, test, todayLabel } from './fixtures.ts'

test('sign in, add an expense, and the charts update', async ({ page }) => {
  await signUp(page)
  await expect(page.getByText('Your charts will appear here')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)

  await addExpense(page, '42.50', 'Groceries')
  await expect(page.locator('canvas')).toHaveCount(2)
  await expect(page.locator('.hero-figure')).toHaveText('$43 spent')

  // The chart's table view carries the same numbers.
  const pace = page.locator('section.chart-card', { hasText: 'Spending vs pace' })
  await pace.getByRole('button', { name: 'Show table' }).click()
  await expect(pace.locator('tbody tr', { hasText: todayLabel() })).toContainText('$42.50')

  // With a budget, the hero switches to what's left (rounded down).
  await page.getByRole('link', { name: 'Budgets', exact: true }).click()
  await expect(page.locator('tfoot')).toBeVisible()
  const groceries = page.getByRole('textbox', { name: 'Groceries' })
  await groceries.fill('100')
  await groceries.press('Enter')
  await expect(page.locator('tbody tr', { hasText: 'Groceries' }).getByText('Saved')).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.locator('.hero-figure')).toHaveText('$57 left')
  await expect(page.locator('.hero-sentence')).toContainText('$57.50 left')
})

test('the demo dashboard shows both charts, each with a table view', async ({ page }) => {
  await signInAsDemo(page)
  await expect(page.locator('canvas')).toHaveCount(2)
  for (const title of ['Spending vs pace', 'Where the money went']) {
    const card = page.locator('section.chart-card', { hasText: title })
    const toggle = card.getByRole('button', { name: 'Show table' })
    await toggle.click()
    await expect(card.getByRole('button', { name: 'Show chart' })).toHaveAttribute('aria-pressed', 'true')
    await expect(card.locator('table')).toBeVisible()
  }
})

test('months that have not started say so', async ({ page }) => {
  await signUp(page)
  await page.goto(`/?month=${monthParam(6)}`)
  await expect(page.locator('.hero-figure')).toHaveText('Not started')
  await expect(page.locator('.hero-sentence')).toContainText("hasn't started yet")
})
