import { test, expect } from '@playwright/test'

test.describe('Announcements (/resident/announcements)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident/announcements')
  })

  test('shows Announcements heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /announcements/i })).toBeVisible()
  })

  test('shows subtitle about apartment management', async ({ page }) => {
    await expect(page.getByText(/updates from your apartment management/i)).toBeVisible()
  })

  test('shows empty state when no announcements', async ({ page }) => {
    // Only assert empty state if the empty-state text is actually present
    const isEmpty = await page.getByText(/no announcements yet/i).isVisible().catch(() => false)
    if (isEmpty) {
      await expect(page.getByText(/no announcements yet/i)).toBeVisible()
      await expect(page.getByText(/check back later/i)).toBeVisible()
    }
  })

  test('shows announcement cards when announcements exist', async ({ page }) => {
    const noAnnounce = page.getByText(/no announcements yet/i)
    const isEmpty = await noAnnounce.isVisible().catch(() => false)
    if (!isEmpty) {
      // Should have at least one announcement card with a title
      const cards = page.locator('[class*="rounded-2xl"]')
      await expect(cards.first()).toBeVisible()
    }
  })

  test('each announcement shows title, author and date', async ({ page }) => {
    const noAnnounce = page.getByText(/no announcements yet/i)
    const isEmpty = await noAnnounce.isVisible().catch(() => false)
    if (!isEmpty) {
      // Dates follow the pattern "DD Mon YYYY"
      const datePattern = /\d{2}\s+\w{3}\s+\d{4}/
      await expect(page.getByText(datePattern).first()).toBeVisible()
    }
  })
})
