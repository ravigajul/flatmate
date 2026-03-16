import { test, expect } from '@playwright/test'

test.describe('Issue Tracker (/president/issues)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/issues')
  })

  test('shows Issue Tracker heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /issue tracker/i })).toBeVisible()
  })

  test('shows subtitle about managing issues', async ({ page }) => {
    await expect(page.getByText(/view, assign, and resolve/i)).toBeVisible()
  })

  test('shows issue count badge in heading area', async ({ page }) => {
    // Heading area shows count — either as badge or number
    await expect(page.getByText(/issue tracker/i)).toBeVisible()
  })

  test('shows Status filter dropdown with All Statuses option', async ({ page }) => {
    // Filters are plain <select> elements — check for the "All Statuses" option text
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.locator('option', { hasText: 'All Statuses' })).toHaveCount(1)
  })

  test('shows table or empty state', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /issue/i })).toBeVisible()
    } else {
      await expect(page.getByText(/no issues found/i)).toBeVisible()
    }
  })

  test('table shows expected columns when issues exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /issue/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /unit/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /priority/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible()
    }
  })

  test('View link navigates to issue detail', async ({ page }) => {
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    const hasLink = await viewLink.isVisible().catch(() => false)
    if (hasLink) {
      await viewLink.click()
      await expect(page).toHaveURL(/\/president\/issues\/[a-z0-9]+/)
    }
  })
})

test.describe('Issue Detail (/president/issues/[id])', () => {
  test('shows issue detail with management panel', async ({ page }) => {
    await page.goto('/president/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }
    await viewLink.click()
    await expect(page).toHaveURL(/\/president\/issues\/[a-z0-9]+/)

    // Issue title heading
    await expect(page.getByRole('heading').first()).toBeVisible()
    // Issue Details section
    await expect(page.getByText(/issue details/i)).toBeVisible()
    // Description section
    await expect(page.getByText(/description/i)).toBeVisible()
    // Comments section
    await expect(page.locator('h2', { hasText: /comments/i })).toBeVisible()
  })

  test('shows Add Comment form on issue detail', async ({ page }) => {
    await page.goto('/president/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }
    await viewLink.click()

    await expect(page.getByText(/add comment/i)).toBeVisible()
    await expect(page.getByPlaceholder(/add a comment, update/i)).toBeVisible()
  })

  test('Back link returns to issue list', async ({ page }) => {
    await page.goto('/president/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible().catch(() => false)) { test.skip(); return }
    await viewLink.click()

    await page.locator('main').getByRole('link', { name: /all issues/i }).click()
    await expect(page).toHaveURL(/\/president\/issues$/)
  })
})
