import { test, expect } from '@playwright/test'

/**
 * Functional CRUD tests for Units management.
 * Each test is self-contained: creates data, verifies it, then cleans up.
 */

// Keep flat numbers under 20 chars (API max)
const FLAT = `T${Date.now().toString().slice(-8)}`

test.describe('Units CRUD', () => {
  test('create → verify → edit → verify → delete → verify', async ({ page }) => {
    await page.goto('/president/units')

    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /add unit/i }).click()
    await expect(page.getByPlaceholder(/A101/i)).toBeVisible()

    await page.getByPlaceholder(/A101/i).fill(FLAT)
    await page.getByPlaceholder(/e\.g\. A$/i).fill('E')
    // Floor input — number field after block
    const floorInput = page.locator('input[type="number"]').first()
    await floorInput.fill('3')

    await page.locator('form').getByRole('button', { name: /add unit/i }).click()

    // Wait for modal to close, then verify row appears
    await expect(page.getByPlaceholder(/A101/i)).not.toBeVisible()
    await expect(page.getByRole('cell', { name: FLAT })).toBeVisible({ timeout: 10000 })

    // ── EDIT ─────────────────────────────────────────────────────────────────
    // Click the pencil icon in the row that contains our flat number
    const row = page.locator('tr', { hasText: FLAT })
    await row.locator('button[title="Edit"]').click()

    // Modal opens pre-filled
    await expect(page.getByPlaceholder(/A101/i)).toHaveValue(FLAT)

    // Change the owner name
    await page.getByPlaceholder(/property owner/i).fill('E2E Owner')
    await page.getByRole('button', { name: /save changes/i }).click()

    // Verify updated owner appears in table
    await expect(page.getByRole('cell', { name: 'E2E Owner' })).toBeVisible()

    // ── DELETE ───────────────────────────────────────────────────────────────
    await row.locator('button[title="Delete"]').click()
    // Inline confirm
    await row.getByRole('button', { name: /confirm/i }).click()

    // Verify row is gone
    await expect(page.getByRole('cell', { name: FLAT })).not.toBeVisible()
  })

  test('delete shows inline confirm then cancel aborts', async ({ page }) => {
    await page.goto('/president/units')

    // Create a unit to test cancel flow
    const flatCancel = `TC${Date.now().toString().slice(-8)}`
    await page.getByRole('button', { name: /add unit/i }).click()
    await page.getByPlaceholder(/A101/i).fill(flatCancel)
    await page.locator('input[type="number"]').first().fill('1')
    await page.locator('form').getByRole('button', { name: /add unit/i }).click()
    // Wait for modal to close and page to refresh
    await expect(page.getByPlaceholder(/A101/i)).not.toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(flatCancel)).toBeVisible({ timeout: 10000 })

    // Click delete then cancel
    const row = page.locator('tr', { hasText: flatCancel })
    await row.locator('button[title="Delete"]').click()
    await row.getByRole('button', { name: /cancel/i }).click()

    // Row still exists
    await expect(page.getByRole('cell', { name: flatCancel })).toBeVisible()

    // Clean up
    await row.locator('button[title="Delete"]').click()
    await row.getByRole('button', { name: /confirm/i }).click()
    await expect(page.getByRole('cell', { name: flatCancel })).not.toBeVisible()
  })
})
