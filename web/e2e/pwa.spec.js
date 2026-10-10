// Session 12 journeys (TESTING §2.2): E2E-19 installability (manifest, icons, a service
// worker with a fetch handler, opens offline, API never from cache), E2E-12 a new build
// while a form is open (the prompt waits, nothing typed is lost), E2E-13 Fix the app.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { login, watchProblems } from './helpers.js';

async function swReady(page) {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state === 'activated';
  }, null, { timeout: 20000 });
}

/** The first page load is never controlled (no clients.claim, on purpose): reload until it is. */
async function controlled(page) {
  await swReady(page);
  for (let i = 0; i < 3; i += 1) {
    await page.reload();
    if (await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 5000 }).then(() => true, () => false)) return;
  }
  throw new Error('page never came under the service worker');
}

test('E2E-19: installable — manifest, icons, service worker; opens offline; the API is never answered from cache', async ({ page, context }) => {
  const problems = watchProblems(page);
  await login(page, 'papa');
  const man = await (await page.request.get('/manifest.webmanifest')).json();
  expect(man).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', short_name: 'A&M Staging' });
  for (const size of ['192x192', '512x512']) {
    expect(man.icons.some((i) => i.sizes === size && i.purpose === 'any')).toBe(true);
    expect(man.icons.some((i) => i.sizes === size && i.purpose === 'maskable')).toBe(true);
  }
  for (const src of [...man.icons.map((i) => i.src), ...man.shortcuts.flatMap((s) => s.icons.map((i) => i.src))]) {
    const r = await page.request.get(src);
    expect(r.status(), src).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
  }
  expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('/manifest.webmanifest');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/icons/apple-touch-icon-180.png');

  await swReady(page);
  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready; // resolves with the active registration
    return { scope: reg.scope, script: reg.active.scriptURL };
  });
  expect(swInfo.scope).toMatch(/\/$/);
  expect(swInfo.script).toMatch(/\/sw\.js$/);
  const swText = await (await page.request.get('/sw.js')).text();
  expect(swText).toContain('fetch'); // workbox routes register a fetch handler

  // Controlled after a reload. Then the server "disappears" (every network request fails;
  // Playwright's offline switch doesn't reach service workers, so the network is cut by routing):
  await controlled(page);
  const online = await page.evaluate(async () => {
    const a = await (await fetch('/api/v1/session', { credentials: 'same-origin' })).json();
    const b = await (await fetch('/api/v1/session', { credentials: 'same-origin' })).json();
    return [a.meta.request_id, b.meta.request_id];
  });
  expect(online[0]).not.toBe(online[1]); // both from the server, never a stored copy
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await page.goto('/tasks'); // a deep link still opens: the shell comes from the precache…
  await expect(page.locator('#root')).not.toBeEmpty();
  const apiOffline = await page.evaluate(() => fetch('/api/v1/session', { credentials: 'same-origin' }).then((r) => r.status, () => 'network-error'));
  expect(apiOffline).toBe('network-error'); // …but the API fails for real, never answered from a cache
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
  expect(cached.some((p) => p.startsWith('/api/'))).toBe(false);
  expect(cached).not.toContain('/reset.html');
  expect(cached).not.toContain('/version.json');
  expect(cached).toContain('/index.html');
  await context.unroute('**/*');
  expect(problems.filter((p) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(p))).toEqual([]);
});

test('E2E-12: a new build arrives while a form is open → the prompt waits; typing is kept; after closing the form it refreshes', async ({ page, context }) => {
  test.setTimeout(120000);
  page.on('console', (m) => { if (m.type() === 'error') console.log('[E2E-12 console]', m.text()); });
  await login(page, 'ayush');
  await controlled(page);
  // A newer build lands on the server, the way a deploy does: a changed sw.js, then version.json.
  const site = process.env.AM_E2E_SITE || '/srv/am-site-e2e';
  const swPath = `${site}/public_html/sw.js`;
  const verPath = `${site}/public_html/version.json`;
  const swBefore = readFileSync(swPath, 'utf8');
  const verBefore = readFileSync(verPath, 'utf8');
  try {
  writeFileSync(swPath, `${swBefore}\n// build 9.9.9 (E2E-12)\n`);
  writeFileSync(verPath, JSON.stringify({ version: '9.9.9', built_at: new Date().toISOString(), flavour: 'staging' }) + '\n');

  await page.goto('/tasks/new');
  const title = page.getByLabel(/Task|What needs doing/).first();
  await title.fill('Book the band — typed before the update');
  // Coming back to the app checks version.json (at most once a minute; a fresh page checks at once).
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const prompt = page.getByRole('status').filter({ hasText: 'New version available.' });
  await expect(prompt).toBeVisible({ timeout: 30000 });
  await prompt.getByRole('button', { name: 'Tap to refresh' }).click();
  await expect(page.getByText('Save or close the open form first. Then tap Refresh.')).toBeVisible();
  await expect(title).toHaveValue('Book the band — typed before the update'); // never reloaded over typing

  // Close the form (Cancel) → now the refresh goes ahead and the new worker takes over.
  await page.getByRole('button', { name: 'Cancel' }).click();
  const before = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  await Promise.all([
    page.waitForEvent('load', { timeout: 20000 }),
    page.getByRole('button', { name: 'Tap to refresh' }).click(),
  ]);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  expect(before).toMatch(/sw\.js$/);
  const after = await page.evaluate(async () => (await (await fetch('/sw.js', { cache: 'no-store' })).text()).includes('build 9.9.9'));
  expect(after).toBe(true); // the new worker is the one running now
  } finally {
    writeFileSync(swPath, swBefore);
    writeFileSync(verPath, verBefore);
  }
});

test('E2E-13: Fix the app — removes the service worker and app caches, keeps the login and saved drafts', async ({ page }) => {
  await login(page, 'papa');
  await swReady(page);
  await page.evaluate(() => localStorage.setItem('am.draft.test', 'kept'));
  await page.goto('/settings/phone');
  await expect(page.getByRole('heading', { level: 1, name: 'This phone' })).toBeVisible();
  await page.getByRole('link', { name: 'Fix the app' }).click();
  await expect(page.getByRole('heading', { name: 'Fixing the app…' })).toBeVisible();
  await page.waitForURL(/\/\?fixed=\d+/, { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible(); // still logged in
  expect(await page.evaluate(() => localStorage.getItem('am.draft.test'))).toBe('kept');
  // The old worker and its caches are gone (a fresh one may register again right away; that is fine).
  const cachesLeft = await page.evaluate(async () => (await caches.keys()).length);
  expect(cachesLeft).toBeLessThanOrEqual(1);
});

test('iPhone: the Add to Home Screen guide opens by itself once after the first login in Safari', async ({ page }, info) => {
  test.skip(info.project.name !== 'small-iphone', 'iPhone only');
  await login(page, 'papa', undefined, { iosGuide: true });
  const guide = page.getByRole('dialog', { name: 'Add to Home Screen' });
  await expect(guide).toBeVisible();
  await expect(guide.getByText('Step 1 of 4')).toBeVisible();
  await guide.getByRole('button', { name: 'Close' }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0); // once only
});
