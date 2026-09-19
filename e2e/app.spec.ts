import { expect, test } from '@playwright/test'

test('loads and shows the placeholder', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Feauxbernetes')).toBeVisible()
})
