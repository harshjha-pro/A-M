// Session 8b journeys: E2E-04 (select 30 → invite → set Coming? → Undo, one batch each)
// and G6 (import the Excel template with 5 rows: 3 new, 1 duplicate, 1 bad phone → Undo this import).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { login, watchProblems } from './helpers.js';

const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const PREFIX = { android: 'Test Family 01', 'small-iphone': 'Test Family 02', 'small-android': 'Test Family 03' };

test('E2E-04: select 30 → Invite to Mehndi → select all → Set Coming → Undo', async ({ page }, info) => {
  const problems = watchProblems(page);
  const prefix = PREFIX[info.project.name];
  await login(page, 'papa');
  await page.goto('/guests');
  await page.getByPlaceholder('Search name, phone, group or area').fill(prefix);
  await expect(page.getByText(/^100 families · /)).toBeVisible();
  await page.getByRole('button', { name: 'Select' }).click();
  for (let i = 0; i < 30; i++) {
    await page.getByRole('checkbox', { name: `Select ${prefix}${String(i).padStart(2, '0')}` }).check();
  }
  await expect(page.getByText('30 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Invite to' }).click();
  await page.getByRole('dialog').getByLabel('Event').selectOption(MEHNDI);
  await page.getByRole('dialog').getByRole('button', { name: 'Apply to 30' }).click();
  await expect(page.getByText('Invited 30 families to Mehndi')).toBeVisible();

  // Those 30 now: Mehndi + the same search → select all filtered → Coming.
  await page.getByRole('combobox', { name: /^Event/ }).selectOption(MEHNDI);
  await expect(page.getByText(/^30 families · /)).toBeVisible();
  await page.getByRole('button', { name: 'Select all 30 filtered' }).click();
  await page.getByRole('button', { name: 'Set Coming?' }).click();
  await page.getByRole('dialog').getByText('Coming', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply to 30' }).click();
  await expect(page.getByText('Set Coming for 30 families · Mehndi')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: `${prefix}00` })).toContainText('Coming');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: `${prefix}00` })).toContainText('Not asked yet');
  expect(problems).toEqual([]);
});

test('G6: import the template with 5 rows → 3 new, 1 duplicate, 1 problem → import 3 → Undo this import', async ({ page }) => {
  await login(page, 'ayush');
  await page.goto('/guests/import');
  await page.getByLabel(/Choose a file/).setInputFiles(fileURLToPath(new URL('./fixtures/guests-5.xlsx', import.meta.url)));
  await expect(page.getByText(/6 rows found in guests-5.xlsx/)).toBeVisible(); // + the EXAMPLE row
  await page.getByRole('button', { name: 'Check the list' }).click();
  await expect(page.getByText('3 new · 1 possible duplicates · 1 problems')).toBeVisible();
  await expect(page.getByText('1 example rows skipped')).toBeVisible();
  await expect(page.getByText('Same as Ramesh Sharma & family')).toBeVisible();
  await page.getByRole('button', { name: 'Import 3 families' }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(page.getByText('Imported 3 families.')).toBeVisible();
  await page.getByPlaceholder('Search name, phone, group or area').fill('Import Test');
  await expect(page.getByText(/^3 families · /)).toBeVisible();

  await page.goto('/settings/imports');
  const card = page.getByRole('listitem').filter({ hasText: 'guests-5.xlsx' }).first();
  await expect(card).toContainText('3 added · 0 filled in · 3 skipped');
  await card.getByRole('button', { name: 'Undo this import' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Undo this import' }).click();
  await expect(card).toContainText('Undone');
  await page.goto('/guests');
  await page.getByPlaceholder('Search name, phone, group or area').fill('Import Test');
  await expect(page.getByText('No families match these filters.')).toBeVisible();
});
