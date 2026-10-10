// Session 5 journeys: E2E-01 (add a task in 3 taps), E2E-05 (delete → Undo),
// E2E-09 on /tasks (lost reply → one task).
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('E2E-01: Home → + → Task → type → Save; assigned to me', async ({ page }, info) => {
  const problems = watchProblems(page);
  const title = `Call tent wala ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.getByRole('button', { name: 'Add' }).click();                     // tap 1
  await page.getByRole('button', { name: 'Task' }).click();                    // tap 2
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByRole('button', { name: 'Save task' }).click();               // tap 3
  await expect(page.getByText('Task added.')).toBeVisible();
  await expect(page).toHaveURL(/\/tasks$/);
  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Rajendra Porwal (Papa)');
  expect(problems).toEqual([]);
});

test('E2E-05: delete a task → Undo → back with its checklist', async ({ page }, info) => {
  const title = `Outfits ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/tasks/new');
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByRole('button', { name: 'Save task' }).click();
  await page.getByRole('listitem').filter({ hasText: title }).getByRole('link').click();
  for (const item of ['Lehenga', 'Sherwani']) {
    await page.getByLabel('Add an item').fill(item);
    await page.getByRole('button', { name: 'Add an item' }).click();
    await expect(page.getByLabel(item, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText(`Deleted ${title}`)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: title }).getByRole('link').click();
  await expect(page.getByLabel('Lehenga', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sherwani', { exact: true })).toBeVisible();
});

test('E2E-09: the reply to "add task" is lost; Try again makes one task', async ({ page }, info) => {
  const title = `Lost reply task ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/tasks/new');
  let first = true;
  await page.route('**/api/v1/tasks', async (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      await route.fetch();
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByText("Couldn't save. Your changes are kept on this phone.")).toBeVisible();
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByText('Task added.')).toBeVisible();
  await page.getByLabel('Search tasks').fill(title);
  await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(1);
});
