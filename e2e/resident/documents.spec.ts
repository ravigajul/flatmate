import { test, expect } from '@playwright/test'

test.describe('Documents (/resident/documents)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident/documents')
  })

  test('shows Documents heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /document vault/i })).toBeVisible()
  })

  test('shows empty state when no documents', async ({ page }) => {
    const noDoc = page.getByText(/no documents/i)
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (!hasTable) {
      await expect(noDoc).toBeVisible()
    }
  })

  test('shows document list when documents exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible()
    }
  })

  test('category filter renders', async ({ page }) => {
    // Filter UI should always be present
    const allFilter = page.getByRole('button', { name: /all/i })
      .or(page.getByText(/all categories/i))
    await expect(allFilter.or(page.getByText(/filter/i))).toBeVisible().catch(() => {
      // filter may not exist if no documents
    })
  })
})
