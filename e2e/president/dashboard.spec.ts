import { test, expect } from '@playwright/test'

test.describe('President Dashboard (/president)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president')
  })

  test('shows Dashboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('shows welcome message with first name', async ({ page }) => {
    await expect(page.getByText(/welcome back,\s*test/i)).toBeVisible()
  })

  test('shows Total Units stat card', async ({ page }) => {
    await expect(page.getByText(/total units/i)).toBeVisible()
  })

  test('shows Active Residents stat card', async ({ page }) => {
    await expect(page.getByText(/active residents/i)).toBeVisible()
  })

  test('shows Open Issues stat card', async ({ page }) => {
    await expect(page.getByText(/open issues/i).first()).toBeVisible()
  })

  test('shows Collected This Month stat card', async ({ page }) => {
    await expect(page.getByText(/collected this month/i)).toBeVisible()
  })

  test('Total Units card links to /president/units', async ({ page }) => {
    const link = page.getByRole('link', { name: /total units/i })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/president\/units/)
  })

  test('Active Residents card links to /president/users', async ({ page }) => {
    const link = page.getByRole('link', { name: /active residents/i })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/president\/users/)
  })

  test('Open Issues card links to /president/issues', async ({ page }) => {
    // Two links match — target the stat card (first occurrence in DOM)
    const link = page.getByRole('link', { name: /open issues/i }).first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/president\/issues/)
  })

  test('shows Quick Actions section', async ({ page }) => {
    await expect(page.getByText(/quick actions/i)).toBeVisible()
  })

  test('Quick Actions contains Manage Units link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /manage units/i })).toBeVisible()
  })

  test('Quick Actions contains Manage Residents link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /manage residents/i })).toBeVisible()
  })

  test('Quick Actions contains Fee Schedules link', async ({ page }) => {
    // Scope to main content to avoid matching the sidebar link
    await expect(page.locator('main').getByRole('link', { name: /fee schedules/i })).toBeVisible()
  })

  test('Quick Actions contains Issue Tracker link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /issue tracker/i })).toBeVisible()
  })

  test('shows Recent Expenses section', async ({ page }) => {
    await expect(page.getByText(/recent expenses/i)).toBeVisible()
  })

  test('shows This Month collection section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /this month/i })).toBeVisible()
  })
})
