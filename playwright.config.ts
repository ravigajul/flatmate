import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // run serially to avoid DB state conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['line']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // reuse if already running (e.g. during active development)
    timeout: 120 * 1000,
  },

  projects: [
    // 1. Auth setup — runs once, saves session state to disk
    {
      name: 'auth-setup',
      testMatch: '**/auth.setup.ts',
    },

    // 2. Resident tests — reuse saved session
    {
      name: 'resident',
      testMatch: '**/resident/*.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Google Chrome'],
        storageState: 'e2e/.auth/resident.json',
      },
    },

    // 3. Unauthenticated tests (login page, redirects)
    {
      name: 'unauthenticated',
      testMatch: '**/unauthenticated/*.spec.ts',
      use: { ...devices['Google Chrome'] },
    },
  ],
})
