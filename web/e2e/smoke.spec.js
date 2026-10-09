// Smoke: the shell opens, talks to the API, navigates, deep links work,
// and the strict CSP blocks nothing we ship.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

let problems;
test.beforeEach(async ({ page }) => { problems = watchProblems(page); await login(page, 'ayush'); });
test.afterEach(() => { expect(problems, 'no console errors or CSP violations').toEqual([]); });

test('Home shows the person, the version and a live server connection', async ({ page }, info) => {
  await expect(page.getByText('Namaste, Ayush Porwal')).toBeVisible();
  await expect(page.getByText('A&M Wedding — version 1.0.12')).toBeVisible();
  await expect(page.getByText(/^Connected · Updated/)).toBeVisible();
  await expect(page).toHaveTitle('A&M Staging');
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});

test('bottom nav goes everywhere, with ≥ 48 px targets and 17 px text', async ({ page }) => {
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
  // Ask for the bold face explicitly: fonts load lazily, so checking before the page has used it raced.
  const fontUrls = [];
  page.on('response', (r) => { if (/\.woff2?(\?|$)/.test(r.url())) fontUrls.push(r.url()); });
  const loaded = await page.evaluate(async () => (await document.fonts.load('700 17px "Atkinson Hyperlegible"')).length);
  expect(loaded).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('700 17px "Atkinson Hyperlegible"'))).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(fontUrls.every((u) => u.startsWith(origin))).toBe(true); // self-hosted: no font CDN
});
