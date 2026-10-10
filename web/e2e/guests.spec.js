// Session 8 journeys: E2E-02 (duplicate phone → Open that family / Add anyway),
// E2E-03 (Coming + numbers on the family page → headcount), E2E-16 (800+ families: scroll and search).
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

const RAMESH = '01M1DJ08V0HFGXZY3382EFCY3K'; // demo: Ramesh Sharma & family, +91 98280 10085
const MEHNDI_NAME = 'Mehndi';
const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';

test('E2E-02: same phone → "Already on the list" → Open that family; back → Add anyway', async ({ page }, info) => {
  const problems = watchProblems(page);
  const name = `Ramesh ji ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Family' }).click();
  await page.getByLabel('Family name').fill(name);
  await page.getByLabel('Phone', { exact: true }).fill('98280 10085');
  await page.getByText("Groom's side").click();
  await page.getByRole('button', { name: 'Save family' }).click();
  const dialog = page.getByRole('alert').filter({ hasText: 'Already on the list' });
  await expect(dialog).toContainText('Ramesh Sharma & family');
  await dialog.getByRole('link', { name: 'Open that family' }).click();
  await expect(page).toHaveURL(new RegExp(`/guests/${RAMESH}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ramesh Sharma & family');
  await page.goBack();
  await page.getByRole('button', { name: 'Use them' }).click(); // the typing was kept as a draft
  await page.getByRole('button', { name: 'Save family' }).click();
  await page.getByRole('alert').filter({ hasText: 'Already on the list' }).getByRole('button', { name: 'Add anyway' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByText('Shares a phone with another family. Check for a duplicate.')).toBeVisible();
  expect(problems.filter((p) => !/status of 409/.test(p))).toEqual([]); // the 409 is the duplicate reply, on purpose
});

test('E2E-03: family page → Coming for Mehndi, 3 people → the event headcount moves by 3', async ({ page }, info) => {
  const name = `Kothari ${info.project.name} ${Date.now()}`;
  await login(page, 'mahi');
  await page.goto(`/calendar/events/${MEHNDI}`);
  const line = page.getByText(/coming · up to/);
  const before = Number((await line.textContent()).match(/^(\d+) coming/)[1]);
  const eventUrl = page.url();

  await page.goto('/guests/new');
  await page.getByLabel('Family name').fill(name);
  await page.getByText("Bride's side").click();
  await page.getByText(MEHNDI_NAME, { exact: true }).click(); // Invite to: Mehndi
  await page.getByRole('button', { name: 'Save family' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  const card = page.getByRole('article').filter({ hasText: MEHNDI_NAME });
  await card.getByRole('radio', { name: 'Coming', exact: true }).click();
  await expect(card.getByRole('radio', { name: /^✓?\s*Coming$/ })).toHaveAttribute('aria-checked', 'true');
  await card.getByRole('button', { name: 'Change numbers' }).click();
  await page.getByRole('button', { name: 'More Adults' }).click(); // 2 → 3
  await page.getByRole('dialog').getByRole('button', { name: 'Save family' }).click();
  await expect(card.getByText('3 people for this event')).toBeVisible();

  await page.goto(eventUrl);
  await expect(page.getByText(new RegExp(`^${before + 3} coming · up to`))).toBeVisible();
});

test('E2E-16: 800+ families — header totals, scroll to the end, search', async ({ page }) => {
  await login(page, 'ayush');
  await page.goto('/guests');
  await page.evaluate(() => { try { localStorage.removeItem(Object.keys(localStorage).find((k) => k.startsWith('am:guest-filters')) || ''); } catch { /* none */ } });
  await page.reload();
  const header = page.getByText(/families · .* people/);
  await expect(header).toBeVisible();
  expect(Number((await header.textContent()).match(/^([\d,]+) families/)[1].replace(/,/g, ''))).toBeGreaterThanOrEqual(800);
  const last = page.getByRole('link', { name: /Test Family 0800/ });
  const t0 = Date.now();
  const rows = page.getByRole('main').getByRole('listitem'); // not the bottom tabs
  for (let i = 0; i < 30 && !(await last.isVisible()); i++) {
    const n = await rows.count();
    await rows.last().scrollIntoViewIfNeeded();
    await expect.poll(async () => (await last.isVisible()) || (await rows.count()) > n, { timeout: 5000 }).toBe(true);
  }
  await expect(last).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(20_000);
  await page.evaluate(() => window.scrollTo(0, 0));
  const s0 = Date.now();
  await page.getByPlaceholder('Search name, phone, group or area').fill('Family 0777');
  await expect(page.getByText(/^1 families · /)).toBeVisible();
  await expect(page.getByRole('link', { name: /Test Family 0777/ })).toBeVisible();
  expect(Date.now() - s0).toBeLessThan(3_000); // typing pause 300 ms + server; real-phone budget is checked by hand
  await page.getByPlaceholder('Search name, phone, group or area').fill('70000 00123'); // by phone digits
  await expect(page.getByRole('link', { name: /Test Family 0123/ })).toBeVisible();
});
