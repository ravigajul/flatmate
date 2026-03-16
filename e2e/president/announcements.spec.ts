import { test, expect } from '@playwright/test'

test.describe('Announcements Management (/president/announcements)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/announcements')
  })

  test('shows Announcements heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /announcements/i })).toBeVisible()
  })

  test('shows announcement count in subtitle', async ({ page }) => {
    await expect(page.getByText(/announcement\(s\) posted|\d+ announcements?/i)).toBeVisible()
  })

  test('shows Post Announcement button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /post announcement/i })).toBeVisible()
  })

  test('Post Announcement button opens modal with Title field', async ({ page }) => {
    await page.getByRole('button', { name: /post announcement/i }).click()
    await expect(page.getByPlaceholder(/water supply interruption/i)).toBeVisible()
  })

  test('Post Announcement modal has Cancel button', async ({ page }) => {
    await page.getByRole('button', { name: /post announcement/i }).click()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('Post Announcement modal can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /post announcement/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('button', { name: /post announcement/i })).toBeVisible()
  })

  test('shows announcement list or empty state', async ({ page }) => {
    // Check for table with Title/Posted By columns (list) or empty body text
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /title/i })).toBeVisible()
    } else {
      await expect(page.getByText(/no announcements/i)).toBeVisible()
    }
  })

  test('announcement table shows Title and Posted By columns when entries exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /title/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /posted by/i })).toBeVisible()
    }
  })
})
