// Session 1 smoke: the shell opens, talks to the API, navigates, deep links work,
// and the strict CSP blocks nothing we ship.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.problems = [];
  page.on('console', (m) => { if (m.type() === 'error') page.problems.push(m.text()); });
  page.on('pageerror', (e) => page.problems.push(String(e)));
});

test.afterEach(async ({ page }) => {
  expect(page.problems, 'no console errors or CSP violations').toEqual([]);
});

test('Home shows the version and a live server connection', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByText('A&M Wedding — version 1.0.1')).toBeVisible();
  await expect(page.getByText('Connected')).toBeVisible();
  await expect(page).toHaveTitle('A&M Staging');
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});

test('bottom nav goes everywhere, with ≥ 48 px targets and 17 px text', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Calendar', 'Tasks', 'Guests', 'More', 'Home']) {
    const link = nav.getByRole('link', { name });
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  const base = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(base).toBeGreaterThanOrEqual(17);
});

test('deep link and Back on a non-root screen', async ({ page }) => {
  await page.goto('/money');               // first screen in the app, e.g. opened from WhatsApp
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Money');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/more$/); // stays in the app instead of leaving it
});

test('fonts are self-hosted and load', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check('700 17px "Atkinson Hyperlegible"'));
  expect(ok).toBe(true);
});
