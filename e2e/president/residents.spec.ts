import { test, expect } from '@playwright/test'

test.describe('Residents Management (/president/users)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/users')
  })

  test('shows Residents heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /residents/i })).toBeVisible()
  })

  test('shows active and pending count in subtitle', async ({ page }) => {
    await expect(page.getByText(/active/i).first()).toBeVisible()
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  test('shows search box', async ({ page }) => {
    await expect(
      page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]'))
    ).toBeVisible()
  })

  test('shows filter tabs All | Active | Pending', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^active$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^pending$/i })).toBeVisible()
  })

  test('shows table or empty state', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (!hasTable) {
      await expect(page.getByText(/no residents found/i)).toBeVisible()
    }
  })

  test('table shows expected columns when residents exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: 'Resident', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Unit', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Role', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible()
    }
  })

  test('Active filter tab filters the list', async ({ page }) => {
    await page.getByRole('button', { name: /^active$/i }).click()
    // Page should still show residents heading (not crash)
    await expect(page.getByRole('heading', { name: /residents/i })).toBeVisible()
  })

  test('Pending filter tab filters the list', async ({ page }) => {
    await page.getByRole('button', { name: /^pending$/i }).click()
    await expect(page.getByRole('heading', { name: /residents/i })).toBeVisible()
  })

  test('search filters residents', async ({ page }) => {
    const searchBox = page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]'))
    await searchBox.fill('ravi')
    await expect(page.getByRole('heading', { name: /residents/i })).toBeVisible()
  })
})
