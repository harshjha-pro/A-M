// Session 5 journeys: E2E-01 (add a task in 3 taps), E2E-05 (delete → Undo),
// E2E-09 on /tasks (lost reply → one task).
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('E2E-01: Home → + → Task → type → Save; assigned to me', async ({ page }, info) => {
  const problems = watchProblems(page);
  const title = `Call tent wala ${info.project.name} ${Date.now()}`;
  await login(page, 'mahi'); // 1.0.16: only Ayush and Mahi add tasks
  await page.getByRole('button', { name: 'Add' }).click();                     // tap 1
  await page.getByRole('button', { name: 'Task' }).click();                    // tap 2
  await page.getByLabel('What needs doing?').fill(title);
  await page.getByRole('button', { name: 'Save task' }).click();               // tap 3
  await expect(page.getByText('Task added.')).toBeVisible();
  await expect(page).toHaveURL(/\/tasks$/);
  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Mahi Jagetiya');
  expect(problems).toEqual([]);
});

test('1.0.16: Papa (Family) can tick and edit tasks but not add them: no Task in the + sheet, no + on Tasks', async ({ page }) => {
  await login(page, 'papa');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Family' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Task' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toHaveCount(0);
  const res = await page.evaluate(async () => {
    const s = await (await fetch('/api/v1/session')).json();
    const r = await fetch('/api/v1/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.data.csrf_token, 'Idempotency-Key': crypto.randomUUID() }, body: '{"title":"Not allowed"}' });
    return r.status;
  });
  expect(res).toBe(403);
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
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText(`Deleted ${title}`)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: title }).getByRole('link').click();
  await expect(page.getByLabel('Lehenga', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sherwani', { exact: true })).toBeVisible();
});

test('E2E-09: the reply to "add task" is lost; it waits on the phone and Send now makes one task', async ({ page }, info) => {
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
  // Session 14: the lost reply leaves the task in the outbox; it is sent again with the same key.
  await expect(page.getByText(/Kept on this phone/)).toBeVisible();
  await page.getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByText('1 change waiting to send.')).toHaveCount(0);
  await page.goto('/tasks?view=all');
  await page.getByLabel('Search tasks').fill(title);
  await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(1);
});
