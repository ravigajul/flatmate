import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('unauthenticated user is redirected to /login from root', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to /login from /resident', async ({ page }) => {
    await page.goto('/resident')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user is redirected to /login from /resident/issues', async ({ page }) => {
    await page.goto('/resident/issues')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows the portal name', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Apartment Management Portal')).toBeVisible()
  })

  test('login page shows Sign in with Google button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  })

  test('login page shows access restriction notice', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/registered residents only/i)).toBeVisible()
  })
})
