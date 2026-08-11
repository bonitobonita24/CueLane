import { defineConfig, devices } from '@playwright/test';

/**
 * RBAC Wave 3 verify-all-pages harness (Rule 34 Part B).
 *
 * Points at the ALREADY-RUNNING dev stack (cuelane_dev_app → http://localhost:41716) —
 * there is deliberately NO `webServer` block, so Playwright never spawns a duplicate dev
 * server (fleet dev-server-pane discipline). Start the stack the normal way
 * (`bash deploy/compose/start.sh dev up -d`) before running, and seed the RBAC fixtures
 * (`e2e/fixtures/seed-rbac-fixtures.ts`) first.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:41716',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
