import { test, expect } from '@playwright/test'

test.describe('Expenses (/president/expenses)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president/expenses')
  })

  test('shows Expenses heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /expenses/i })).toBeVisible()
  })

  test('shows subtitle about balance sheet', async ({ page }) => {
    await expect(page.getByText(/track apartment expenses/i)).toBeVisible()
  })

  test('shows Total Spent amount', async ({ page }) => {
    await expect(page.getByText(/total spent/i)).toBeVisible()
    await expect(page.getByText(/₹/).first()).toBeVisible()
  })

  test('shows Add Expense button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible()
  })

  test('shows category filter', async ({ page }) => {
    await expect(
      page.getByLabel(/category/i).or(page.locator('select')).first()
    ).toBeVisible()
  })

  test('shows table or empty state', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible()
    } else {
      await expect(page.getByText(/no expenses/i)).toBeVisible()
    }
  })

  test('table shows expected columns when expenses exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible()
    }
  })

  test('Add Expense button opens form or modal', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click()
    await expect(
      page.getByLabel(/description/i).or(
        page.getByPlaceholder(/description/i).or(
          page.getByText(/add expense/i).nth(1)
        )
      )
    ).toBeVisible()
  })

  test('Add Expense form has Cancel button', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('Add Expense form can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /add expense/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible()
  })
})
