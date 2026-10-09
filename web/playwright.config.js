// Playwright (TESTING §1.8): journeys on phone-sized Chromium, against staging demo data (seed_demo.sql).
// These are NOT Safari: iPhone behaviour is checked on a real iPhone (§1.8.3).
// The server (php -S + tools/router.php on a staging site folder) is started by tools/test-e2e.sh.
import { defineConfig, devices } from '@playwright/test';

// localhost (not 127.0.0.1): browsers accept the Secure __Host- login cookie on http://localhost.
const BASE = process.env.AM_E2E_BASE || 'http://localhost:8083';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1, // one shared demo database: journeys run one after another
  reporter: [['list']],
  use: {
    baseURL: BASE,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    screenshot: 'only-on-failure',
  },
  projects: [
    // Each phone gets its own address (tools/test-e2e.sh trusts X-Forwarded-For), like real phones on different networks.
    { name: 'android', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.11' } } },
    { name: 'small-iphone', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium', extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.12' } } },
    { name: 'small-android', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 }, extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.13' } } },
  ],
});
