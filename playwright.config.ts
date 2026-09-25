import { defineConfig, devices } from '@playwright/test';

/**
 * PLAYWRIGHT_CHROMIUM_PATH lets a sandbox or CI image point at a Chromium it
 * already has, instead of downloading one. Locally, leave it unset and use
 * `npx playwright install`.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  // Print output is what these tests are about, so failures should be easy to
  // look at rather than just read.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/schematic-v3/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
