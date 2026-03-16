import { test, expect } from '@playwright/test'

test.describe('Resident navigation (sidebar)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident')
  })

  test('sidebar shows FlatMate app name', async ({ page }) => {
    // Target the desktop sidebar (hidden md:flex) since mobile drawer is always hidden at desktop viewport
    await expect(page.locator('aside[class*="md:flex"]').getByText('FlatMate')).toBeVisible()
  })

  test('sidebar shows all resident nav links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /pay fees/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /my issues/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /announcements/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /documents/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /reports/i })).toBeVisible()
  })

  test('Dashboard link navigates to /resident', async ({ page }) => {
    await page.getByRole('link', { name: /dashboard/i }).click()
    await expect(page).toHaveURL(/\/resident$/)
  })

  test('Pay Fees link navigates to /resident/pay', async ({ page }) => {
    await page.getByRole('link', { name: /pay fees/i }).click()
    await expect(page).toHaveURL(/\/resident\/pay/)
  })

  test('My Issues link navigates to /resident/issues', async ({ page }) => {
    await page.getByRole('link', { name: /my issues/i }).click()
    await expect(page).toHaveURL(/\/resident\/issues/)
  })

  test('Announcements link navigates to /resident/announcements', async ({ page }) => {
    await page.getByRole('link', { name: /announcements/i }).click()
    await expect(page).toHaveURL(/\/resident\/announcements/)
  })

  test('Documents link navigates to /resident/documents', async ({ page }) => {
    await page.getByRole('link', { name: /documents/i }).click()
    await expect(page).toHaveURL(/\/resident\/documents/)
  })

  test('Reports link navigates to /reports', async ({ page }) => {
    await page.getByRole('link', { name: /reports/i }).click()
    await expect(page).toHaveURL(/\/reports/)
  })

  test('sidebar does NOT show president-only links for resident', async ({ page }) => {
    await expect(page.getByRole('link', { name: /manage fees/i })).not.toBeVisible()
    await expect(page.getByRole('link', { name: /expenses/i })).not.toBeVisible()
    await expect(page.getByRole('link', { name: /units/i })).not.toBeVisible()
  })

  test('navigating directly to /president/* is blocked for resident', async ({ page }) => {
    await page.goto('/president')
    // Residents should be redirected away from president routes
    await expect(page).not.toHaveURL(/\/president/)
  })
})
