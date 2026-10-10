// Session 14 journeys (TESTING §2.2): saving without internet through the outbox.
//   E2E-07 offline: tick 2 tasks, edit a family, 3 RSVPs → close the page → reopen offline →
//          still 6 waiting → back online → all sent once; another phone sees them
//   E2E-08 offline: delete, mark paid, upload → greyed out with "Needs internet"
//   E2E-10 slow network: Saving… shows, a double tap makes one task; a 15 s timeout keeps
//          the task on the phone and Send now saves it once
//   E2E-11 the login ends mid-form → login sheet → the form is kept → saved once
import { test, expect } from '@playwright/test';
import { login, swControlled, waitSynced } from './helpers.js';

/** Calls the API from a logged-in page, the way the app does (CSRF + Idempotency-Key). */
async function call(page, method, path, body) {
  return page.evaluate(async ([m, p, b]) => {
    const s = await (await fetch('/api/v1/session', { credentials: 'same-origin' })).json();
    const res = await fetch(`/api/v1${p}`, {
      method: m,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': s.data.csrf_token, 'Idempotency-Key': crypto.randomUUID(), 'X-Client-Version': '9.9.9' },
      body: b ? JSON.stringify(b) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }, [method, path, body]);
}
const get = async (page, path) => page.evaluate(async (p) => (await (await fetch(`/api/v1${p}`, { credentials: 'same-origin' })).json()).data, path);

/** Each phone its own address (the not-logged-in limit is per address), like E2E-06. */
function phone(browser, info, n) {
  const base = { android: 160, 'small-iphone': 170, 'small-android': 180 }[info.project.name] ?? 190;
  return browser.newContext({ ...info.project.use, extraHTTPHeaders: { 'X-Forwarded-For': `198.51.100.${base + n}` } });
}

async function synced(page) {
  await swControlled(page);
  await waitSynced(page);
}

test('E2E-07: offline → 2 ticks, a family edit, 3 Coming? → close → reopen offline → 6 waiting → online → all sent once', async ({ browser, page, context }, info) => {
  test.setTimeout(120000);
  const tag = `${info.project.name} ${Date.now()}`;
  // Ayush (another phone) sets up two tasks for Papa and one family invited to three events.
  const a = await phone(browser, info, 1);
  const ayush = await a.newPage();
  try {
    await login(ayush, 'ayush');
    const papaId = (await get(ayush, '/members')).find((m) => m.phone.endsWith('9829000004')).id;
    const tasks = [];
    for (const n of [1, 2]) tasks.push((await call(ayush, 'POST', '/tasks', { title: `Outbox tick ${n} ${tag}`, assignee_ids: [papaId] })).body.data);
    const events = (await get(ayush, '/events?guests_invited=true')).slice(0, 3);
    expect(events.length).toBe(3);
    const fam = (await call(ayush, 'POST', '/households', { name: `Outbox family ${tag}`, side: 'groom', adults: 2, children: 0, invite_event_ids: events.map((e) => e.id) })).body.data;

    // Papa's phone: one load with internet fills the phone's copy.
    await login(page, 'papa');
    await synced(page);

    // No internet (routing: see offline.spec.js for why not setOffline).
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    await page.goto('/tasks?view=mine');
    for (const tk of tasks) {
      await page.getByLabel('Search tasks').fill(tk.title);
      await page.getByRole('button', { name: `Mark done: ${tk.title}` }).click();
      await expect(page.getByText(/Kept on this phone/).first()).toBeVisible();
    }
    await page.goto(`/guests/${fam.id}/edit`);
    await page.getByLabel('Notes').fill(`Edited offline ${tag}`);
    await page.getByRole('button', { name: 'Save family' }).click();
    await page.waitForURL(new RegExp(`/guests/${fam.id}$`));
    for (const ev of events) {
      await page.getByRole('radiogroup', { name: new RegExp(ev.name) }).getByRole('radio', { name: 'Coming', exact: true }).click();
      await expect(page.getByRole('radiogroup', { name: new RegExp(ev.name) }).getByRole('radio', { name: 'Coming', exact: true })).toHaveAttribute('aria-checked', 'true');
    }
    await expect(page.getByText('6 changes waiting to send.')).toBeVisible();

    // The app is closed and opened again, still with no internet: nothing is lost.
    await page.close();
    const again = await context.newPage();
    await again.goto('/');
    await expect(again.getByText('6 changes waiting to send.')).toBeVisible({ timeout: 15000 });

    // Internet back: Send now.
    await context.unroute('**/*');
    await again.getByRole('button', { name: 'Send now' }).click();
    await expect(again.getByText(/changes? waiting to send|Sending/)).toHaveCount(0, { timeout: 20000 });

    // Another phone sees every change, each saved exactly once (one version step each).
    for (const tk of tasks) {
      const now = await get(ayush, `/tasks/${tk.id}`);
      expect(now.status).toBe('done');
      expect(now.version).toBe(tk.version + 1);
    }
    const h = await get(ayush, `/households/${fam.id}`);
    expect(h.notes).toBe(`Edited offline ${tag}`);
    expect(h.version).toBe(fam.version + 1);
    for (const ev of events) {
      const inv = h.invitations.find((i) => i.event.id === ev.id);
      expect(inv.rsvp).toBe('coming');
      expect(inv.version).toBe(2);
    }
  } finally {
    await a.close();
  }
});

test('E2E-08: with no internet, delete, mark paid and upload are greyed out with "Needs internet"', async ({ page, context }) => {
  await login(page, 'ayush');
  const offlineThen = async () => { await context.setOffline(true); };
  const back = async () => { await context.setOffline(false); };

  const task = (await call(page, 'POST', '/tasks', { title: `Needs internet ${Date.now()}` })).body.data;
  await page.goto(`/tasks/${task.id}`);
  await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled();
  await offlineThen();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await expect(page.getByText('Needs internet', { exact: true })).toBeVisible();
  await back();

  const pay = (await get(page, '/payments?status=due'))[0];
  test.skip(!pay, 'demo data has a due payment');
  await page.goto(`/money/payments/${pay.id}`);
  await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeEnabled();
  await offlineThen();
  await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeDisabled();
  await back();

  await page.goto('/documents');
  await page.getByRole('button', { name: /Add/ }).last().click();
  await offlineThen();
  await expect(page.locator('button', { hasText: 'Take photo' })).toBeDisabled();
  await expect(page.locator('button', { hasText: 'Choose file' })).toBeDisabled();
  await back();
});

test('E2E-10: slow 3G — Saving… shows and a double tap makes one task', async ({ page }, info) => {
  test.setTimeout(60000);
  const title = `Slow net ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/tasks/new');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
  await page.getByLabel('What needs doing?').fill(title);
  const save = page.getByRole('button', { name: 'Save task' });
  await save.dblclick();
  await expect(page.getByText('Saving…').first()).toBeVisible();
  await expect(page.getByText('Task added.')).toBeVisible({ timeout: 30000 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const found = (await get(page, `/tasks?q=${encodeURIComponent(title)}&view=all`)).filter((x) => x.title === title);
  expect(found).toHaveLength(1);
});

test('E2E-10: no reply in 15 s → kept on the phone → Send now → saved once', async ({ page }, info) => {
  test.setTimeout(90000);
  const title = `Timeout task ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/tasks/new');
  let first = true;
  await page.route('**/api/v1/tasks', async (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      await new Promise((r) => setTimeout(r, 16000)); // the phone gives up at 15 s…
      try { await route.fulfill({ response: await route.fetch() }); } catch { /* …the server still saved it */ }
      return;
    }
    await route.continue();
  });
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByRole('button', { name: 'Save task' }).click();
  // After the 15 s timeout the task is kept on the phone and sent again with the same key —
  // by itself if a send is already lined up, otherwise with Send now.
  await expect(page.getByText(/Kept on this phone|Task added\./).first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(1500); // let the slow first try reach the server
  const bar = page.getByText('1 change waiting to send.');
  if (await bar.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Send now' }).click();
  await expect(bar).toHaveCount(0, { timeout: 20000 });
  const found = (await get(page, `/tasks?q=${encodeURIComponent(title)}&view=all`)).filter((x) => x.title === title);
  expect(found).toHaveLength(1);
});

test('E2E-11: the login ends mid-form → login sheet → the form is kept → saved once', async ({ browser, page }, info) => {
  test.setTimeout(60000);
  const title = `Relogin task ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.goto('/tasks/new');
  await page.getByLabel('What needs doing?').fill(title);

  // Papa's other phone: "Log out everywhere" ends this phone's login too.
  const other = await phone(browser, info, 2);
  const p2 = await other.newPage();
  try {
    await login(p2, 'papa');
    await p2.goto('/settings/account');
    await p2.getByRole('button', { name: 'Log out everywhere' }).click();
    await p2.getByRole('alertdialog').getByRole('button', { name: /Log out everywhere/ }).click();
    await p2.waitForURL(/\/login/);
  } finally {
    await other.close();
  }

  await page.getByRole('button', { name: 'Save task' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Password', { exact: true }).fill('demo-1234');
  await sheet.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Task added.')).toBeVisible({ timeout: 15000 });
  const found = (await get(page, `/tasks?q=${encodeURIComponent(title)}&view=all`)).filter((x) => x.title === title);
  expect(found).toHaveLength(1);
});

test('DS-04 / DS-05 / DS-10 through the outbox: replies lost after the server saved → resent with the same key → one record, one version step', async ({ page }, info) => {
  test.setTimeout(60000);
  const tag = `${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  const task = (await call(page, 'POST', '/tasks', { title: `DS outbox ${tag}` })).body.data;
  const fam = (await call(page, 'POST', '/households', { name: `DS outbox family ${tag}`, side: 'bride', adults: 1, children: 0 })).body.data;
  // Every first write is saved by the server, then its reply is dropped.
  const seen = new Set();
  await page.route('**/api/v1/**', async (route) => {
    const r = route.request();
    if (r.method() !== 'GET' && !seen.has(r.url())) {
      seen.add(r.url());
      await route.fetch();
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto(`/tasks/${task.id}`);
  await page.getByRole('button', { name: 'Mark done' }).first().click();             // done (DS-05)
  await expect(page.getByText(/Kept on this phone/).first()).toBeVisible();
  await page.goto('/tasks/new');
  await page.getByLabel('What needs doing?').fill(`DS create ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();                     // create (DS-04)
  await expect(page.getByText(/Kept on this phone/).first()).toBeVisible();
  await page.goto(`/guests/${fam.id}/edit`);
  await page.getByLabel('Notes').fill(`DS edit ${tag}`);
  await page.getByRole('button', { name: 'Save family' }).click();                   // PATCH (DS-05)
  await page.waitForURL(new RegExp(`/guests/${fam.id}$`));
  // Each new save also re-sends what's waiting, so the earlier two may have gone already.
  await expect(page.getByText(/^\d changes? waiting to send\.$/)).toBeVisible();
  await page.getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByText(/changes? waiting to send|needs? your choice/)).toHaveCount(0, { timeout: 20000 });
  await page.unroute('**/api/v1/**');

  const t2 = await get(page, `/tasks/${task.id}`);
  expect(t2.status).toBe('done');
  expect(t2.version).toBe(task.version + 1);
  const h2 = await get(page, `/households/${fam.id}`);
  expect(h2.notes).toBe(`DS edit ${tag}`);
  expect(h2.version).toBe(fam.version + 1);
  const created = (await get(page, `/tasks?q=${encodeURIComponent(`DS create ${tag}`)}&view=all`)).filter((x) => x.title === `DS create ${tag}`);
  expect(created).toHaveLength(1);
});
