import { expect, test } from '@playwright/test'

test('the three-column layout, tab switching, deep links and locked tabs', async ({ page }) => {
  await page.goto('./')

  // Three columns.
  await expect(page.getByRole('complementary', { name: 'Instructions' })).toBeVisible()
  await expect(page.getByRole('main', { name: 'Browser' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ops Console' })).toBeVisible()

  // Opens on Flack, redirected to its default channel (#12).
  await expect(page.getByRole('tab', { name: /Flack/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/flack\/platform$/)

  // Tab switching, by click and by keyboard.
  await page.getByRole('tab', { name: 'Argh CD' }).click()
  await expect(page.getByRole('tab', { name: 'Argh CD' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/argh-cd$/)
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(
    'argh-cd.inkwell.internal/applications'
  )

  // Deep-linking survives a reload.
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Argh CD' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/argh-cd$/)

  // A locked tab can't be opened by URL either: redirected back to wherever you were (Argh CD, at
  // this point in the test), with an explanation.
  await page.goto('./#/gitnub')
  await expect(page.getByRole('tab', { name: 'Argh CD' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/argh-cd$/)
  await expect(page.getByRole('status')).toContainText("GitNub isn't open to you yet")

  // ...and a locked tab can't be opened by clicking it either.
  const gitnub = page.getByRole('tab', { name: /GitNub/ })
  await expect(gitnub).toHaveAttribute('aria-disabled', 'true')
  // `aria-disabled` (not a real `disabled` attribute — the button stays focusable) makes
  // Playwright's actionability check refuse a plain click; force it, the way a mouse actually
  // could, to prove the tab still doesn't switch.
  await gitnub.click({ force: true })
  await expect(page.getByRole('tab', { name: 'Argh CD' })).toHaveAttribute('aria-selected', 'true')
})

test('below 1100px wide, the small-screen notice replaces the layout', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('./')
  await expect(page.getByRole('note')).toContainText('works best on a laptop or desktop')
  await expect(page.getByRole('tablist', { name: 'Apps' })).toBeHidden()
})
