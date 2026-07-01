import { defineConfig, devices } from '@playwright/test';

/**
 * Trellis E2E Playwright configuration.
 *
 * The backend and frontend are started as two independent webServer
 * entries. Both are launched concurrently by Playwright and the test run
 * is gated on BOTH readiness URLs responding, which is sufficient to
 * guarantee the backend (and its SignalR hub) is already up by the time
 * any browser interacts with the frontend. No additional manual
 * sequencing (e.g. globalSetup) is required or desired here.
 *
 * IMPORTANT: database reset/migration is owned entirely by the backend.
 * Setting ASPNETCORE_ENVIRONMENT=E2E tells the backend to wipe and
 * re-migrate its database on startup, and the backend is responsible for
 * only reporting /health as reachable once that has completed. We
 * deliberately do NOT attempt to reset the database from a Playwright
 * globalSetup hook, since webServer entries start before globalSetup
 * would run, which would be too late anyway.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  // Rendering exercises real PlantUML Java processes. Keep browser execution
  // serial so cold starts and C4 renders do not contend with each other and
  // turn healthy renders into timing failures.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command:
        'dotnet run --project ../backend/src/Trellis.Api --urls=http://localhost:5000',
      url: 'http://localhost:5000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'E2E',
      },
    },
    {
      command: 'npm start',
      cwd: '../frontend',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
