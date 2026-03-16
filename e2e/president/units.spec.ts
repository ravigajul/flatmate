import { test, expect } from '@playwright/test'

test.describe('Units Management (/president/units)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/units')
  })

  test('shows Units heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /units/i })).toBeVisible()
  })

  test('shows units count in subtitle', async ({ page }) => {
    await expect(page.getByText(/\d+ units? configured/i)).toBeVisible()
  })

  test('shows Add Unit button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add unit/i })).toBeVisible()
  })

  test('shows table or empty state', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /flat/i })).toBeVisible()
    } else {
      await expect(page.getByText(/no units yet/i)).toBeVisible()
    }
  })

  test('table shows expected columns when units exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /flat/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /block/i }).or(
        page.getByRole('columnheader', { name: /floor/i })
      )).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /owner/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
    }
  })

  test('Add Unit button opens modal', async ({ page }) => {
    await page.getByRole('button', { name: /add unit/i }).click()
    // Modal should appear with a form
    await expect(page.getByRole('dialog').or(
      page.locator('[role="dialog"]').or(page.getByText(/flat number/i))
    )).toBeVisible()
  })

  test('Add Unit modal has Flat Number field', async ({ page }) => {
    await page.getByRole('button', { name: /add unit/i }).click()
    await expect(page.getByPlaceholder(/A101/i).or(
      page.locator('input[placeholder*="101"]').or(
        page.getByLabel(/flat number/i)
      )
    )).toBeVisible()
  })

  test('Add Unit modal has Cancel button', async ({ page }) => {
    await page.getByRole('button', { name: /add unit/i }).click()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('Add Unit modal can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /add unit/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()
    // Modal should close
    await expect(page.getByRole('button', { name: /add unit/i })).toBeVisible()
  })
})
