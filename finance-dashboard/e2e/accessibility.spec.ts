import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, signInAsDemo, test } from './fixtures.ts'

// WCAG 2.1 A and AA, checked by axe on every page in both colour schemes.
async function expectNoViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n    ')}`)
  expect(summary, `${where} accessibility violations`).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme })

    test('the sign-in page has no WCAG A/AA violations', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoViolations(page, 'login')
    })

    test('every signed-in page has no WCAG A/AA violations', async ({ page }) => {
      await signInAsDemo(page)
      await expect(page.locator('canvas')).toHaveCount(2)
      await expectNoViolations(page, 'dashboard')

      for (const [path, heading] of [['/expenses', 'Expenses'], ['/budgets', 'Budgets'], ['/categories', 'Categories']]) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
        await expect(page.locator('tbody tr').first()).toBeVisible()
        await expectNoViolations(page, path)
      }
    })
  })
}
