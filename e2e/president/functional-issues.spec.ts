import { test, expect } from '@playwright/test'

/**
 * Functional tests for Issue Tracker (president view).
 * Tests: status filter, view detail, comment, delete.
 *
 * Note: Issues are raised by residents — we cannot create them from
 * the president UI. Tests rely on at least one existing issue in the DB,
 * or skip gracefully when none exist.
 */

test.describe('Issue Tracker — president functional', () => {
  test('status filter OPEN shows only open issues', async ({ page }) => {
    await page.goto('/president/issues')

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (!hasTable) { test.skip(); return }

    // Select OPEN from the status filter
    await page.locator('select').first().selectOption('OPEN')
    await page.waitForURL(/status=OPEN/)

    // Every badge visible should be "Open"
    const badges = page.locator('tbody td').filter({ hasText: /^Open$/ })
    const closedBadges = page.locator('tbody td').filter({ hasText: /^Closed$/ })
    await expect(closedBadges).toHaveCount(0)
    // At least the filter worked (page loaded without crash)
    await expect(page.getByRole('heading', { name: /issue tracker/i })).toBeVisible()
  })

  test('status filter can be reset to all statuses', async ({ page }) => {
    await page.goto('/president/issues?status=OPEN')

    await page.locator('select').first().selectOption('')
    await page.waitForURL(/\/president\/issues$/)
    await expect(page.getByRole('heading', { name: /issue tracker/i })).toBeVisible()
  })

  test('view issue detail — shows management panel', async ({ page }) => {
    await page.goto('/president/issues')

    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }

    await viewLink.click()
    await expect(page).toHaveURL(/\/president\/issues\/[a-z0-9]+/)

    // Management panel elements
    await expect(page.getByText(/issue details/i)).toBeVisible()
    await expect(page.getByText(/status/i).first()).toBeVisible()
    await expect(page.getByText(/priority/i).first()).toBeVisible()
    await expect(page.locator('h2', { hasText: /comments/i })).toBeVisible()
  })

  test('president can post a comment on an issue', async ({ page }) => {
    await page.goto('/president/issues')

    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }

    await viewLink.click()
    await expect(page).toHaveURL(/\/president\/issues\/[a-z0-9]+/)

    const commentText = `E2E president comment ${Date.now()}`
    await page.getByPlaceholder(/add a comment, update/i).fill(commentText)
    await page.getByRole('button', { name: /post comment/i }).click()

    // Comment appears in the thread
    await expect(page.getByText(commentText)).toBeVisible()
  })

  test('back link returns to issue list', async ({ page }) => {
    await page.goto('/president/issues')

    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }

    await viewLink.click()
    await page.locator('main').getByRole('link', { name: /all issues/i }).click()
    await expect(page).toHaveURL(/\/president\/issues$/)
  })

  test('delete issue from list → row removed', async ({ page }) => {
    await page.goto('/president/issues')

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (!hasTable) { test.skip(); return }

    // Grab the title of the first row to verify it disappears
    const firstRow = page.locator('tbody tr').first()
    const title = await firstRow.locator('td').first().textContent()

    await firstRow.locator('button[title="Delete issue"]').click()
    await firstRow.getByRole('button', { name: /confirm/i }).click()

    // Row with that title should be gone
    if (title) {
      await expect(page.locator('tbody tr td', { hasText: title.trim() }).first()).not.toBeVisible()
    }
  })
})
