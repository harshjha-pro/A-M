// Session 11 journey (TESTING §2.2): E2E-15 Export everything → download → the ZIP is
// saved, opens, and has summary.html, the CSVs and the documents; Print summary opens.
// One export per phone size: the server allows 3 an hour, and there are 3 phone sizes.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { login, watchProblems } from './helpers.js';

test('E2E-15: Export everything → Download → ZIP opens with summary.html, CSVs and documents', async ({ page }, info) => {
  const problems = watchProblems(page);
  await login(page, 'ayush');
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Export everything' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Export everything' })).toBeVisible();
  await page.getByRole('button', { name: 'Export everything' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('heading', { name: 'Export ready' })).toBeVisible({ timeout: 60000 });

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download' }).first().click()]);
  expect(download.suggestedFilename()).toMatch(/^wedding-export_\d{4}-\d{2}-\d{2}\.zip$/);
  const file = info.outputPath('export.zip');
  await download.saveAs(file);
  execFileSync('unzip', ['-tq', file]); // throws if the ZIP is damaged
  const names = execFileSync('unzip', ['-Z1', file]).toString().split('\n').filter(Boolean);
  for (const n of ['README.txt', 'summary.html', 'manifest.json', 'json/all.json', 'csv/households.csv', 'csv/payments.csv', 'csv/audit_log.csv']) {
    expect(names).toContain(n);
  }
  expect(names.filter((n) => n.startsWith('documents/')).length).toBeGreaterThanOrEqual(6); // the demo files
  const summary = execFileSync('unzip', ['-p', file, 'summary.html']).toString();
  expect(summary).toContain('Guests by side');
  const families = execFileSync('unzip', ['-p', file, 'csv/households.csv']).toString();
  expect(families.charCodeAt(0)).toBe(0xfeff); // BOM: Hindi opens right in Excel

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Print summary' }).first().click()]);
  await expect(popup.getByRole('heading', { level: 2, name: 'Budget' })).toBeVisible();
  await popup.close();
  await page.reload();
  await expect(page.getByText(/^Last export: /)).toBeVisible();
  expect(problems).toEqual([]);
});
