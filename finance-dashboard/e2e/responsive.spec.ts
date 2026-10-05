import { expect, signInAsDemo, test } from './fixtures.ts'

for (const width of [320, 390]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('no page scrolls sideways and every table fits', async ({ page }) => {
      await signInAsDemo(page)
      for (const path of ['/', '/expenses', '/budgets', '/categories']) {
        await page.goto(path)
        if (path === '/') await expect(page.locator('canvas')).toHaveCount(2)
        else await expect(page.locator('tbody tr').first()).toBeVisible()

        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          tables: [...document.querySelectorAll('.table-wrap')].map((w) => w.scrollWidth - w.clientWidth),
          nav: (() => {
            const nav = document.querySelector('.app-header nav')
            return nav ? nav.scrollWidth - nav.clientWidth : 0
          })(),
        }))
        expect(overflow.page, `${path}: page overflow`).toBeLessThanOrEqual(0)
        expect(overflow.nav, `${path}: nav overflow`).toBeLessThanOrEqual(1)
        for (const t of overflow.tables) expect(t, `${path}: table overflow`).toBeLessThanOrEqual(1)
      }
    })
  })
}
