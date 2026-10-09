// Session 7: Home cards per role (TESTING C2) and ticking a task from Home.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('C2: Ayush sees Safety and money; Papa sees his tasks; Dadi only countdown + headcount', async ({ page }) => {
  const problems = watchProblems(page);
  await login(page, 'ayush');
  await expect(page.getByText(/days to the wedding$/)).toBeVisible();
  for (const card of ['My tasks', 'Payments due', 'Budget', 'Headcount', 'Safety', 'Recent activity']) {
    await expect(page.getByRole('region', { name: card })).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test('C2: Papa (Family, money) sees his tasks and money cards, no Safety', async ({ page }) => {
  await login(page, 'papa');
  await expect(page.getByRole('region', { name: /^My tasks/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Payments due' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Safety' })).toHaveCount(0);
});

test('C2: Dadi (Viewer) sees no Safety, no tasks, no money', async ({ page }) => {
  await login(page, 'dadi');
  await expect(page.getByText(/days to the wedding$/)).toBeVisible();
  for (const card of ['My tasks', 'Payments due', 'Budget', 'Safety']) {
    await expect(page.getByRole('region', { name: new RegExp(`^${card}`) })).toHaveCount(0);
  }
  await expect(page.getByRole('region', { name: 'Headcount' })).toBeVisible();
});

test('tick a task from Home → Undo bar → it leaves My tasks', async ({ page }, info) => {
  const title = `Home tick ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.goto('/tasks/new');
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByText('Today', { exact: true }).click();
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByText('Task added.')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
  const card = page.getByRole('region', { name: /^My tasks/ });
  await card.getByRole('button', { name: `Mark done: ${title}` }).click();
  await expect(page.getByText(`Done: ${title}`)).toBeVisible();
  await expect(card.getByText(title)).toHaveCount(0);
});
