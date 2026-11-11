import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL=https://data-desk.pages.dev npm run e2e:smoke  → test a deployed site instead of a local build.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
// PW_CHANNEL=chrome uses an installed Chrome instead of Playwright's downloaded Chromium.
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1366, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 }, channel } },
    // PostgreSQL is a 9 MB WebAssembly module: check that it boots in the other engines too.
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 800 } }, grep: /@smoke/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 800 } }, grep: /@smoke/ },
  ],
  // Test the production build, the same files that get deployed.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
