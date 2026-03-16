import { test, expect } from '@playwright/test'

/**
 * Functional CRUD tests for Announcements.
 * Each test creates its own data and cleans up after itself.
 */

test.describe('Announcements CRUD', () => {
  test('create → verify in table → delete → verify gone', async ({ page }) => {
    await page.goto('/president/announcements')

    const title = `E2E Announcement ${Date.now()}`
    const body = 'This is an automated E2E test announcement. Please ignore.'

    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /post announcement/i }).click()
    await expect(page.getByPlaceholder(/water supply interruption/i)).toBeVisible()

    await page.getByPlaceholder(/water supply interruption/i).fill(title)
    await page.getByPlaceholder(/enter the full announcement text/i).fill(body)
    await page.locator('form').getByRole('button', { name: /post announcement/i }).click()

    // Modal should close and table should show the new announcement
    await expect(page.getByRole('cell', { name: title })).toBeVisible()

    // ── DELETE ───────────────────────────────────────────────────────────────
    const row = page.locator('tr', { hasText: title })
    await row.locator('button[title="Delete"]').click()
    // Inline confirm
    await row.getByRole('button', { name: /confirm/i }).click()

    // Verify row is gone
    await expect(page.getByRole('cell', { name: title })).not.toBeVisible()
  })

  test('cancel on delete confirm keeps the announcement', async ({ page }) => {
    await page.goto('/president/announcements')

    const title = `E2E Keep-Me ${Date.now()}`

    // Create
    await page.getByRole('button', { name: /post announcement/i }).click()
    await page.getByPlaceholder(/water supply interruption/i).fill(title)
    await page.getByPlaceholder(/enter the full announcement text/i).fill('Test body text.')
    await page.locator('form').getByRole('button', { name: /post announcement/i }).click()
    await expect(page.getByRole('cell', { name: title })).toBeVisible()

    // Trigger delete then cancel
    const row = page.locator('tr', { hasText: title })
    await row.locator('button[title="Delete"]').click()
    await row.getByRole('button', { name: /cancel/i }).click()

    // Still visible
    await expect(page.getByRole('cell', { name: title })).toBeVisible()

    // Clean up
    await row.locator('button[title="Delete"]').click()
    await row.getByRole('button', { name: /confirm/i }).click()
    await expect(page.getByRole('cell', { name: title })).not.toBeVisible()
  })

  test('empty modal fields fail validation — stays open on empty submit', async ({ page }) => {
    await page.goto('/president/announcements')

    await page.getByRole('button', { name: /post announcement/i }).click()
    // Submit without filling anything — HTML required should block
    await page.locator('form').getByRole('button', { name: /post announcement/i }).click()

    // Modal should still be open (browser native validation or server error)
    await expect(page.getByPlaceholder(/water supply interruption/i)).toBeVisible()
  })
})
