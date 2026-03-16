import { test, expect } from '@playwright/test'

/**
 * Functional CRUD tests for Expenses.
 */

test.describe('Expenses CRUD', () => {
  test('create → verify → edit → verify → delete → verify', async ({ page }) => {
    await page.goto('/president/expenses')

    const description = `E2E Water Pump Repair ${Date.now()}`
    const editedDescription = `E2E Water Pump Repair EDITED ${Date.now()}`

    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /add expense/i }).click()
    await expect(page.getByPlaceholder(/replaced water pump/i)).toBeVisible()

    await page.getByPlaceholder(/replaced water pump/i).fill(description)
    await page.getByPlaceholder(/e\.g\. 5000/i).fill('1500')

    // Category select — pick Repairs
    await page.locator('select').last().selectOption('REPAIRS')

    // Date is pre-filled with today — leave as-is
    await page.locator('form').getByRole('button', { name: /add expense/i }).click()

    // Verify in table
    const row = page.locator('tr', { hasText: description })
    await expect(row).toBeVisible()
    await expect(row.getByText('₹1,500')).toBeVisible()
    await row.locator('button[title="Edit"]').click()

    // Pre-filled modal
    await expect(page.getByPlaceholder(/replaced water pump/i)).toHaveValue(description)
    await expect(page.getByPlaceholder(/e\.g\. 5000/i)).toHaveValue('1500')

    // Update description and amount
    await page.getByPlaceholder(/replaced water pump/i).fill(editedDescription)
    await page.getByPlaceholder(/e\.g\. 5000/i).fill('2000')
    await page.getByRole('button', { name: /save changes/i }).click()

    // Verify updated values
    const editedRow = page.locator('tr', { hasText: editedDescription })
    await expect(editedRow).toBeVisible()
    await expect(editedRow.getByText('₹2,000')).toBeVisible()
    await expect(page.locator('tr', { hasText: description }).filter({ hasNot: page.getByText(editedDescription) })).not.toBeVisible()

    // ── DELETE ───────────────────────────────────────────────────────────────
    await editedRow.locator('button[title="Delete"]').click()
    await editedRow.getByRole('button', { name: /confirm/i }).click()

    await expect(page.getByRole('cell', { name: editedDescription })).not.toBeVisible()
  })

  test('category filter narrows results', async ({ page }) => {
    await page.goto('/president/expenses')

    // Create a Utilities expense
    const description = `E2E Utilities Test ${Date.now()}`
    await page.getByRole('button', { name: /add expense/i }).click()
    await page.getByPlaceholder(/replaced water pump/i).fill(description)
    await page.getByPlaceholder(/e\.g\. 5000/i).fill('800')
    await page.locator('select').last().selectOption('UTILITIES')
    await page.locator('form').getByRole('button', { name: /add expense/i }).click()
    await expect(page.getByRole('cell', { name: description })).toBeVisible()

    // Filter by Repairs — our Utilities expense should not appear
    await page.locator('select').first().selectOption('REPAIRS')
    await page.getByRole('button', { name: /^filter$/i }).click()
    await expect(page.getByRole('cell', { name: description })).not.toBeVisible()

    // Clear filter — expense reappears
    await page.getByRole('button', { name: /clear/i }).click()
    await expect(page.getByRole('cell', { name: description })).toBeVisible()

    // Clean up
    const row = page.locator('tr', { hasText: description })
    await row.locator('button[title="Delete"]').click()
    await row.getByRole('button', { name: /confirm/i }).click()
    await expect(page.getByRole('cell', { name: description })).not.toBeVisible()
  })

  test('required fields block submission', async ({ page }) => {
    await page.goto('/president/expenses')

    await page.getByRole('button', { name: /add expense/i }).click()
    // Try to submit empty form
    await page.locator('form').getByRole('button', { name: /add expense/i }).click()

    // Modal remains open
    await expect(page.getByPlaceholder(/replaced water pump/i)).toBeVisible()
  })
})
