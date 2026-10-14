// 1.0.22: a new task gets a random ID (TSK-XXXXXX); Ayush changes it to his own, and the
// ID finds the task in the search.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('Ayush: a new task has a random ID; change it; search finds it by ID', async ({ page }, info) => {
  test.setTimeout(90000);
  const problems = watchProblems(page);
  const tag = `${info.project.name.slice(0, 5)}${String(Date.now()).slice(-6)}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
  await login(page, 'ayush');
  await page.goto('/tasks/new');
  await page.getByLabel('What needs doing?').fill(`Book dhol ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page).not.toHaveURL(/\/tasks\/new/);
  await page.getByPlaceholder('Search tasks or ID').fill(`Book dhol ${tag}`);
  await page.getByRole('link', { name: new RegExp(`Book dhol ${tag}`) }).click();
  const chip = page.getByLabel(/^Task ID TSK-[23456789A-HJKMNP-TV-Z]{6}$/);
  await expect(chip).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const field = page.getByLabel('Task ID');
  await field.fill(`DHOL-${tag}`);
  await expect(page.getByText('This ID is free.')).toBeVisible();
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByLabel(`Task ID DHOL-${tag}`)).toBeVisible();

  await page.goto('/tasks');
  await page.getByPlaceholder('Search tasks or ID').fill(`dhol-${tag.toLowerCase()}`);
  await expect(page.getByRole('link', { name: new RegExp(`Book dhol ${tag}`) })).toBeVisible();
  expect(problems).toEqual([]);
});
