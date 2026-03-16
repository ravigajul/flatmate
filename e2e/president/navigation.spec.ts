import { test, expect } from '@playwright/test'

test.describe('President navigation (sidebar)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/president')
  })

  test('sidebar shows FlatMate app name', async ({ page }) => {
    await expect(page.locator('aside[class*="md:flex"]').getByText('FlatMate')).toBeVisible()
  })

  test('sidebar shows Admin Panel subtitle', async ({ page }) => {
    await expect(page.locator('aside[class*="md:flex"]').getByText('Admin Panel')).toBeVisible()
  })

  test('sidebar shows all president nav links', async ({ page }) => {
    const nav = page.locator('aside[class*="md:flex"]')
    await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /units/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /residents/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /fee schedules/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /issues/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /expenses/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /announcements/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /reports/i })).toBeVisible()
  })

  test('sidebar shows user name and role', async ({ page }) => {
    const nav = page.locator('aside[class*="md:flex"]')
    await expect(nav.getByText('Test Admin')).toBeVisible()
    await expect(nav.getByText(/SUPER ADMIN/i)).toBeVisible()
  })

  test('Dashboard link navigates to /president', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /dashboard/i }).click()
    await expect(page).toHaveURL(/\/president$/)
  })

  test('Units link navigates to /president/units', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /units/i }).click()
    await expect(page).toHaveURL(/\/president\/units/)
  })

  test('Residents link navigates to /president/users', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /residents/i }).click()
    await expect(page).toHaveURL(/\/president\/users/)
  })

  test('Fee Schedules link navigates to /president/fees', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /fee schedules/i }).click()
    await expect(page).toHaveURL(/\/president\/fees/)
  })

  test('Issues link navigates to /president/issues', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /issues/i }).click()
    await expect(page).toHaveURL(/\/president\/issues/)
  })

  test('Expenses link navigates to /president/expenses', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /expenses/i }).click()
    await expect(page).toHaveURL(/\/president\/expenses/)
  })

  test('Announcements link navigates to /president/announcements', async ({ page }) => {
    await page.locator('aside[class*="md:flex"]').getByRole('link', { name: /announcements/i }).click()
    await expect(page).toHaveURL(/\/president\/announcements/)
  })

  test('sidebar does NOT show resident-only links', async ({ page }) => {
    const nav = page.locator('aside[class*="md:flex"]')
    await expect(nav.getByRole('link', { name: /pay fees/i })).not.toBeVisible()
    await expect(nav.getByRole('link', { name: /my issues/i })).not.toBeVisible()
  })
})
