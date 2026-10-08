// Session 2 journeys: log in → Home → log out, and E2E-11 (login ends mid-form).
import { test, expect } from '@playwright/test';
import { DEMO, PASSWORD, login, watchProblems } from './helpers.js';

test('log in, see members, log out; app pages then need a login again', async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto('/settings/members');
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fmembers$/);
  await page.getByLabel('Phone number').fill(DEMO.ayush.phone);
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Phone or password is wrong. Try again, or ask Ayush or Mahi.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible(); // back where they were going
  await expect(page.getByRole('link', { name: 'Add member' })).toBeVisible();
  await expect(page.getByText('Rohit Porwal (left)')).toBeHidden(); // deactivated members aren't listed

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === '__Host-am_session');
  expect(session.httpOnly).toBe(true);
  expect(session.secure).toBe(true);
  expect(session.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toContain('am_session'); // scripts can't read it

  await page.goto('/settings/account');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login\?next=%2Ftasks$/);
  expect(problems).toEqual([]);
});

test('a Viewer sees no edit buttons', async ({ page }) => {
  await login(page, 'dadi');
  await page.goto('/settings/members');
  await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add member' })).toHaveCount(0);
  await page.goto('/settings/wedding');
  await expect(page.getByText('Only Ayush and Mahi can change these.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await page.goto('/more');
  await expect(page.getByRole('link', { name: 'Money' })).toHaveCount(0);
});

test('E2E-11: login ends mid-form → login sheet → saved once, typing kept', async ({ browser, baseURL }) => {
  // Phone A: Papa is typing his new name.
  const a = await browser.newContext();
  const papa = await a.newPage();
  await login(papa, 'papa');
  await papa.goto('/settings/account');
  const name = papa.getByLabel('Your name');
  await expect(name).toHaveValue(DEMO.papa.name);
  await name.fill('Rajendra Porwal ji');

  // Phone B: Ayush resets Papa's password meanwhile (through the API, like the app does).
  const b = await browser.newContext();
  const ayush = await b.newPage();
  await login(ayush, 'ayush');
  const setPapaPassword = (password) => ayush.evaluate(async (pw) => {
    const s = await (await fetch('/api/v1/session')).json();
    const members = await (await fetch('/api/v1/members')).json();
    const papaId = members.data.find((m) => m.phone === '+919829000004').id;
    const r = await fetch(`/api/v1/members/${papaId}/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.data.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ mode: 'set', password: pw }),
    });
    return r.status;
  }, password);
  expect(await setPapaPassword('lotus-9911')).toBe(200);
  try {

  // Back on phone A: Save → login sheet over the form.
  await papa.getByRole('button', { name: 'Save name' }).click();
  const sheet = papa.getByRole('dialog', { name: 'Please log in again' });
  await expect(sheet).toBeVisible();
  await expect(name).toHaveValue('Rajendra Porwal ji');
  await sheet.getByLabel('Password', { exact: true }).fill('lotus-9911');
  await sheet.getByRole('button', { name: 'Log in' }).click();
  await expect(papa.getByText(/Saved ✓/)).toBeVisible();
  await expect(sheet).toBeHidden();

  const saved = await papa.evaluate(async () => (await (await fetch('/api/v1/session')).json()).data.user.name);
  expect(saved).toBe('Rajendra Porwal ji');
  } finally {
    // Put the demo password and name back for the next phone size.
    await setPapaPassword(PASSWORD);
    await ayush.evaluate(async (name) => {
      const s = await (await fetch('/api/v1/session')).json();
      const members = await (await fetch('/api/v1/members')).json();
      const papa = members.data.find((m) => m.phone === '+919829000004');
      await fetch(`/api/v1/members/${papa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.data.csrf_token, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${papa.version}"` },
        body: JSON.stringify({ name }),
      });
    }, DEMO.papa.name);
  }
  await a.close();
  await b.close();
  expect(baseURL).toContain('localhost');
});
