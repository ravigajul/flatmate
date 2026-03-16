import { test, expect } from '@playwright/test'

test.describe('Fee Management (/president/fees)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/fees')
  })

  test('shows Fee Management heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /fee management/i })).toBeVisible()
  })

  test('shows subtitle about fee schedules', async ({ page }) => {
    await expect(page.getByText(/monthly maintenance fee schedules/i)).toBeVisible()
  })

  test('shows Total Due stat card', async ({ page }) => {
    await expect(page.getByText(/total due/i)).toBeVisible()
  })

  test('shows Collected stat card', async ({ page }) => {
    await expect(page.getByText(/collected/i).first()).toBeVisible()
  })

  test('shows Outstanding stat card', async ({ page }) => {
    await expect(page.getByText(/outstanding/i)).toBeVisible()
  })

  test('shows Collection Rate stat card', async ({ page }) => {
    await expect(page.getByText(/collection rate/i)).toBeVisible()
  })

  test('shows month selector input', async ({ page }) => {
    await expect(page.locator('input[type="month"]')).toBeVisible()
  })

  test('shows Generate Fees button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /generate fees/i })).toBeVisible()
  })

  test('Generate Fees button opens modal', async ({ page }) => {
    await page.getByRole('button', { name: /generate fees/i }).click()
    // Modal with form fields should appear
    await expect(
      page.getByText(/default amount/i).or(page.getByLabel(/amount/i))
    ).toBeVisible()
  })

  test('Generate Fees modal has required fields', async ({ page }) => {
    await page.getByRole('button', { name: /generate fees/i }).click()
    // Labels use <label> text without htmlFor — locate inputs by type/position
    await expect(page.getByText(/default amount/i)).toBeVisible()
    await expect(page.locator('input[type="date"]')).toBeVisible()
  })

  test('Generate Fees modal has Cancel button', async ({ page }) => {
    await page.getByRole('button', { name: /generate fees/i }).click()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('Generate Fees modal can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /generate fees/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('button', { name: /generate fees/i })).toBeVisible()
  })

  test('shows fee table or empty state for current month', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (!hasTable) {
      // No fees generated for this month yet — acceptable
      await expect(page.getByRole('button', { name: /generate fees/i })).toBeVisible()
    }
  })

  test('fee table shows expected columns when schedules exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /flat/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /fee amount/i }).or(
        page.getByRole('columnheader', { name: /amount/i })
      )).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
    }
  })
})
