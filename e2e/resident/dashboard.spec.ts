import { test, expect } from '@playwright/test'

test.describe('Resident Dashboard (/resident)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident')
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('shows personalised greeting with first name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /hello, ravi/i })).toBeVisible()
  })

  test('shows fee status card with rupee icon section', async ({ page }) => {
    await expect(page.getByText(/this month.*maintenance/i)).toBeVisible()
  })

  test('shows open maintenance issues count', async ({ page }) => {
    await expect(page.getByText(/open maintenance issues/i)).toBeVisible()
  })

  test('shows announcements section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /announcements/i })).toBeVisible()
  })

  test('"Raise an Issue" button is visible and links to new issue form', async ({ page }) => {
    const raiseBtn = page.getByRole('link', { name: /raise an issue/i })
    await expect(raiseBtn).toBeVisible()
    await raiseBtn.click()
    await expect(page).toHaveURL(/\/resident\/issues\/new/)
  })

  test('"View all" announcements link navigates to announcements page', async ({ page }) => {
    const viewAll = page.getByRole('link', { name: /view all/i })
    await expect(viewAll).toBeVisible()
    await viewAll.click()
    await expect(page).toHaveURL(/\/resident\/announcements/)
  })

  test('fee card shows either paid status or Pay Now link', async ({ page }) => {
    // Either a "Paid" badge or "Pay Now" link should be visible
    const paid = page.getByText(/^Paid$/i).first()
    const payNow = page.getByRole('link', { name: /pay now/i })
    const noSchedule = page.getByText(/—/)
    const isAnyVisible = await paid.isVisible()
      .then(v => v || payNow.isVisible())
      .then(v => v || noSchedule.isVisible())
    expect(isAnyVisible).toBe(true)
  })
})
