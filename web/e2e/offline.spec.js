// Session 13 journeys (TESTING §2.2 offline rows): after one load with internet, the app
// opens with none — lists from the phone's copy with "No internet · from …", search by
// name works, a never-opened screen says so — and logging out leaves nothing behind.
import { test, expect } from '@playwright/test';
import { login, swControlled } from './helpers.js';

async function controlledAndSynced(page) {
  await swControlled(page);
  // The phone's copy is filled by /sync after login
  await page.waitForFunction(() => new Promise((resolve) => {
    // Only look once the app has made its database (opening it first would create an empty one).
    indexedDB.databases().then((dbs) => {
      if (!dbs.some((d) => d.name === 'am-wedding' && d.version >= 2)) { resolve(false); return; }
    const req = indexedDB.open('am-wedding');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) { resolve(false); return; }
      const get = db.transaction('meta').objectStore('meta').get('lastSyncedAt');
      get.onsuccess = () => resolve(Boolean(get.result));
      get.onerror = () => resolve(false);
    };
    req.onerror = () => resolve(false);
    });
  }), null, { timeout: 30000 });
}

async function recordCount(page) {
  return page.evaluate(() => new Promise((resolve) => {
    indexedDB.databases().then((dbs) => {
      if (!dbs.some((d) => d.name === 'am-wedding')) { resolve(0); return; }
    const req = indexedDB.open('am-wedding');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) { resolve(0); return; }
      const c = db.transaction('records').objectStore('records').count();
      c.onsuccess = () => resolve(c.result);
    };
    });
  }));
}

test('offline: the guest list opens from the phone with its age; search by name works; never-opened screens say so', async ({ page, context }) => {
  await login(page, 'papa');
  await controlledAndSynced(page);
  await expect.poll(() => recordCount(page), { timeout: 30000 }).toBeGreaterThan(100); // the 800-family test data, tasks, events…

  // The server becomes unreachable (routing: Playwright's offline switch also stops the service
  // worker answering page loads, which a real phone's offline doesn't).
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await page.goto('/guests');
  await expect(page.getByText(/^No internet · from /)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Guests' })).toBeVisible();
  const rows = page.getByRole('main').getByRole('link');
  await expect(rows.first()).toBeVisible();

  await page.getByRole('searchbox').fill('Sharma');
  await expect(rows.first()).toContainText(/Sharma/i);
  const names = await rows.allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /sharma/i.test(n))).toBe(true);

  await rows.first().click(); // a family page offline
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sharma/i);

  await page.goto('/tasks');
  await expect(page.getByText(/^No internet · from /)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();

  await page.goto('/settings/activity'); // never kept for offline
  await expect(page.getByText(/Open this once with internet|No internet/).first()).toBeVisible();
  await context.unroute('**/*');
});

test('logging out leaves nothing of the guest list on the phone', async ({ page }) => {
  await login(page, 'papa');
  await controlledAndSynced(page);
  await expect.poll(() => recordCount(page), { timeout: 30000 }).toBeGreaterThan(0);
  await page.goto('/settings/account');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /Log out/ }).click();
  await page.waitForURL(/\/login/);
  expect(await recordCount(page)).toBe(0);
});

test('first sync on a slow 3G connection finishes well under 20 s (800 families)', async ({ page }, info) => {
  test.skip(info.project.name !== 'android', 'one network measurement is enough');
  test.setTimeout(90000);
  await login(page, 'papa');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // Chrome DevTools "Fast 3G": 1.6 Mbps down, 750 kbps up, 150 ms round trip
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.evaluate(() => new Promise((resolve) => { const r = indexedDB.deleteDatabase('am-wedding'); r.onsuccess = r.onerror = r.onblocked = () => resolve(); }));
  const t0 = Date.now();
  const bytes = await page.evaluate(async () => {
    let total = 0;
    let cursor = '';
    do {
      const res = await fetch(`/api/v1/sync?limit=500${cursor ? `&cursor=${cursor}` : ''}`, { credentials: 'same-origin' });
      const text = await res.text();
      total += text.length;
      const d = JSON.parse(text).data;
      cursor = d.has_more ? d.cursor : '';
    } while (cursor);
    return total;
  });
  const secs = (Date.now() - t0) / 1000;
  console.log(`[3G] first sync: ${(bytes / 1048576).toFixed(1)} MB in ${secs.toFixed(1)} s`);
  expect(secs).toBeLessThan(20);
});
