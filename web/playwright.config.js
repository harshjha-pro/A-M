// Playwright (TESTING §1.8). Session 1: smoke journeys on phone-sized Chromium.
// These are NOT Safari: iPhone behaviour is checked on a real iPhone (§1.8.3).
// The server (php -S + tools/router.php on a staging site folder) is started by tools/test-e2e.sh.
import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.AM_E2E_BASE || 'http://127.0.0.1:8083';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } } },
    { name: 'small-iphone', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'small-android', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
  ],
});
