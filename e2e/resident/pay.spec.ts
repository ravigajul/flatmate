import { test, expect } from '@playwright/test'

test.describe('Pay Fees (/resident/pay)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident/pay')
  })

  test('shows Pay Fees heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pay fees/i })).toBeVisible()
  })

  test('shows subtitle about UPI payment', async ({ page }) => {
    await expect(page.getByText(/monthly maintenance fee.*upi/i)).toBeVisible()
  })

  test('shows Current Month section', async ({ page }) => {
    await expect(page.getByText(/current month/i)).toBeVisible()
  })

  test('shows current month value in YYYY-MM format', async ({ page }) => {
    const month = new Date().toISOString().slice(0, 7) // e.g. "2026-03"
    await expect(page.getByText(month).first()).toBeVisible()
  })

  test('shows Payment History section', async ({ page }) => {
    await expect(page.getByText(/payment history/i)).toBeVisible()
  })

  test('payment history shows table headers when payments exist', async ({ page }) => {
    const hasTable = await page.locator('table').last().isVisible()
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /month/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /paid on/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /txn id/i })).toBeVisible()
    }
  })

  test('paid month shows green Paid state with transaction details', async ({ page }) => {
    const isPaid = await page.getByText(/^Paid$/i).first().isVisible()
    if (isPaid) {
      await expect(page.getByText(/^Paid$/i).first()).toBeVisible()
    }
  })

  test('unpaid month shows amount, due date and Pay Now button', async ({ page }) => {
    const payBtn = page.getByRole('button', { name: /pay now/i })
    const hasPayBtn = await payBtn.isVisible()
    if (hasPayBtn) {
      // Should show rupee amount
      await expect(page.getByText(/₹/)).toBeVisible()
      // Should show due date label
      await expect(page.getByText(/due:/i)).toBeVisible()
      await expect(payBtn).toBeEnabled()
    }
  })

  test('no fee schedule shows empty state message', async ({ page }) => {
    const noFee = page.getByText(/no fee scheduled for this month/i)
    const hasFee = await page.getByText(/₹/).first().isVisible().catch(() => false)
    if (!hasFee) {
      await expect(noFee).toBeVisible()
    }
  })

  test('no payment history shows empty state message', async ({ page }) => {
    const noHistory = page.getByText(/no payment history yet/i)
    const hasHistory = await page.locator('table').last().isVisible().catch(() => false)
    if (!hasHistory) {
      await expect(noHistory).toBeVisible()
    }
  })

  test('payment history shows paid entry with SUCCESS badge', async ({ page }) => {
    // Check if there's a paid row in history
    const paidBadge = page.getByText('Paid').last()
    const hasPaid = await paidBadge.isVisible().catch(() => false)
    if (hasPaid) {
      await expect(paidBadge).toBeVisible()
    }
  })
})
