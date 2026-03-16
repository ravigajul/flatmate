import { test, expect } from '@playwright/test'

test.describe('Issues list (/resident/issues)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident/issues')
  })

  test('shows My Issues heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my issues/i })).toBeVisible()
  })

  test('shows Raise Issue button', async ({ page }) => {
    await expect(page.getByRole('link', { name: /raise issue/i })).toBeVisible()
  })

  test('Raise Issue button navigates to new issue form', async ({ page }) => {
    await page.getByRole('link', { name: /raise issue/i }).click()
    await expect(page).toHaveURL(/\/resident\/issues\/new/)
  })

  test('shows issues count in subtitle', async ({ page }) => {
    await expect(page.getByText(/\d+ issues raised/i)).toBeVisible()
  })

  test('issues table shows expected columns when issues exist', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible()
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /issue/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible()
    }
  })

  test('shows empty state when no issues', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible()
    if (!hasTable) {
      await expect(page.getByText(/no issues raised yet/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /raise issue/i }).last()).toBeVisible()
    }
  })

  test('View link on an issue navigates to issue detail', async ({ page }) => {
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    const hasLink = await viewLink.isVisible()
    if (hasLink) {
      await viewLink.click()
      await expect(page).toHaveURL(/\/resident\/issues\/[a-z0-9]+/)
    }
  })
})

test.describe('New Issue form (/resident/issues/new)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resident/issues/new')
  })

  test('shows Raise an Issue heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /raise an issue/i })).toBeVisible()
  })

  test('shows all required form fields', async ({ page }) => {
    await expect(page.getByPlaceholder('Brief summary of the issue')).toBeVisible()
    await expect(page.getByPlaceholder(/describe the issue in detail/i)).toBeVisible()
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.locator('select').nth(1)).toBeVisible()
  })

  test('shows exactly 3 photo upload slots', async ({ page }) => {
    await expect(page.getByText('Photo 1')).toBeVisible()
    await expect(page.getByText('Photo 2')).toBeVisible()
    await expect(page.getByText('Photo 3')).toBeVisible()
  })

  test('category dropdown contains all expected options', async ({ page }) => {
    const select = page.locator('select').first()
    await expect(select.locator('option', { hasText: 'Electrical' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Plumbing' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Lift' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Common Area' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Security' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Cleaning' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Other' })).toHaveCount(1)
  })

  test('priority dropdown contains all expected options', async ({ page }) => {
    const select = page.locator('select').nth(1)
    await expect(select.locator('option', { hasText: 'Low' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Medium' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'High' })).toHaveCount(1)
    await expect(select.locator('option', { hasText: 'Critical' })).toHaveCount(1)
  })

  test('shows validation error when submitting empty title', async ({ page }) => {
    // Click submit without filling title
    await page.getByRole('button', { name: /submit issue/i }).click()
    // Browser native validation prevents submit — title input should be invalid
    const titleInput = page.getByPlaceholder('Brief summary of the issue')
    const validationMsg = await titleInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMsg).not.toBe('')
  })

  test('shows validation error when submitting empty description', async ({ page }) => {
    await page.getByPlaceholder('Brief summary of the issue').fill('Test issue title')
    await page.getByRole('button', { name: /submit issue/i }).click()
    const descInput = page.getByPlaceholder(/describe the issue in detail/i)
    const validationMsg = await descInput.evaluate((el: HTMLTextAreaElement) => el.validationMessage)
    expect(validationMsg).not.toBe('')
  })

  test('Cancel button navigates back to issues list', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page).toHaveURL(/\/resident\/issues$/)
  })

  test('Back link navigates to issues list', async ({ page }) => {
    // Use the back link in main content, not the sidebar nav link
    await page.locator('main').getByRole('link', { name: /my issues/i }).click()
    await expect(page).toHaveURL(/\/resident\/issues$/)
  })

  test('successfully submits a new issue and redirects to issues list', async ({ page }) => {
    await page.getByPlaceholder('Brief summary of the issue').fill('E2E Test — Leaking tap in bathroom')
    await page.getByPlaceholder(/describe the issue in detail/i).fill('The cold water tap in the master bathroom is dripping continuously. Started 2 days ago.')
    await page.locator('select').first().selectOption('PLUMBING')
    await page.locator('select').nth(1).selectOption('HIGH')
    await page.getByRole('button', { name: /submit issue/i }).click()
    // Should redirect back to issues list on success
    await expect(page).toHaveURL(/\/resident\/issues$/, { timeout: 10000 })
    // New issue should appear in the list
    await expect(page.getByText(/E2E Test — Leaking tap/i).first()).toBeVisible()
  })
})

test.describe('Issue detail (/resident/issues/[id])', () => {
  test('shows issue title, status, priority and description', async ({ page }) => {
    // Navigate to issues list first and pick the first issue
    await page.goto('/resident/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    const hasLink = await viewLink.isVisible()
    if (!hasLink) {
      test.skip()
      return
    }
    await viewLink.click()
    await expect(page).toHaveURL(/\/resident\/issues\/[a-z0-9]+/)

    // Page should show the issue title as a heading
    await expect(page.getByRole('heading').first()).toBeVisible()
    // Should show Issue Details section
    await expect(page.getByText(/issue details/i)).toBeVisible()
    // Should show Description section
    await expect(page.getByText(/description/i)).toBeVisible()
    // Should show Comments section heading
    await expect(page.locator('h2', { hasText: /comments/i })).toBeVisible()
  })

  test('shows Add Comment form on issue detail', async ({ page }) => {
    await page.goto('/resident/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible()) { test.skip(); return }
    await viewLink.click()

    await expect(page.getByText(/add comment/i)).toBeVisible()
    await expect(page.getByPlaceholder('Add a comment or update...')).toBeVisible()
  })

  test('can post a comment on an issue', async ({ page }) => {
    await page.goto('/resident/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible()) { test.skip(); return }
    await viewLink.click()

    const commentText = `E2E test comment — ${Date.now()}`
    await page.getByPlaceholder('Add a comment or update...').fill(commentText)
    await page.getByRole('button', { name: /post comment/i }).click()

    // Comment should appear in the thread
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 8000 })
  })

  test('Back link returns to issues list', async ({ page }) => {
    await page.goto('/resident/issues')
    const viewLink = page.getByRole('link', { name: /view/i }).first()
    if (!await viewLink.isVisible()) { test.skip(); return }
    await viewLink.click()

    await page.locator('main').getByRole('link', { name: /my issues/i }).click()
    await expect(page).toHaveURL(/\/resident\/issues$/)
  })
})
