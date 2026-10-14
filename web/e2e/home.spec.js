// Session 7: Home cards per role (TESTING C2) and ticking a task from Home.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('C2 (1.0.16 layout): Ayush sees photos + monogram, Months : Days : Hours, upcoming events, tasks, overdue, recent activity; no money or safety', async ({ page }) => {
  const problems = watchProblems(page);
  await login(page, 'ayush');
  await expect(page.getByRole('region', { name: 'Cover photos' })).toBeVisible();
  await expect(page.getByTestId('monogram')).toBeVisible();
  await expect(page.getByRole('timer', { name: /months, .* days and .* hours to the wedding/ })).toBeVisible();
  for (const card of ['Upcoming events', 'My tasks', "Everyone's overdue", 'Recent activity']) {
    await expect(page.getByRole('region', { name: card })).toBeVisible();
  }
  for (const card of ['Payments due', 'Budget', 'Headcount', 'Safety']) {
    await expect(page.getByRole('region', { name: card })).toHaveCount(0);
  }
  const recent = page.getByRole('region', { name: 'Recent activity' });
  await recent.getByRole('button', { name: 'Show more' }).click();
  await expect(recent.getByTestId('activity-scroll')).toBeVisible();
  expect(problems).toEqual([]);
});

test('C2: Papa (Family) sees his tasks and upcoming events; no recent activity, no money cards', async ({ page }) => {
  await login(page, 'papa');
  await expect(page.getByRole('region', { name: /^My tasks/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Upcoming events' })).toBeVisible();
  for (const card of ['Payments due', 'Safety', 'Recent activity']) await expect(page.getByRole('region', { name: card })).toHaveCount(0);
});

test('C2: Dadi (Viewer) sees the countdown and upcoming events; no tasks', async ({ page }) => {
  await login(page, 'dadi');
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Upcoming events' })).toBeVisible();
  for (const card of ['My tasks', 'Payments due', 'Budget', 'Safety']) {
    await expect(page.getByRole('region', { name: new RegExp(`^${card}`) })).toHaveCount(0);
  }
});

test('tick a task from Home → Undo bar → it leaves My tasks', async ({ page }, info) => {
  const title = `Home tick ${info.project.name} ${Date.now()}`;
  await login(page, 'mahi'); // 1.0.16: only Ayush and Mahi add tasks
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
