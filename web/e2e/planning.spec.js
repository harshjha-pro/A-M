// Workspace step D (1.0.20): Mahi adds a contact to Reception, saves guest notes, opens the
// event's guest list, sets a time on the first timeline step (the next step shows ≈), adds a
// step with a task that comes back to the timeline, moves it up, deletes it with Undo.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

const RECEPTION = '01JC0WS0000000000000000006';

test('Mahi: Reception → contact, guest notes, Open in Guests, timeline time ≈, step with task, move, delete + Undo', async ({ page }, info) => {
  test.setTimeout(120000);
  const problems = watchProblems(page);
  const tag = `${info.project.name}-${Date.now()}`;
  await login(page, 'mahi');

  // A vendor to link (made here so each phone has its own).
  await page.goto('/vendors/new');
  await page.getByLabel('Name', { exact: true }).fill(`Lights ${tag}`);
  await page.getByRole('button', { name: 'Save vendor' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Lights ${tag}` })).toBeVisible();

  await page.goto(`/workspaces/${RECEPTION}`);
  const contacts = page.getByRole('region', { name: 'Contacts' });
  await contacts.getByRole('button', { name: 'Add contact' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vendor').selectOption({ label: `Lights ${tag}` });
  await sheet.getByLabel('Role here (optional)').fill('Stage lights');
  await sheet.getByRole('button', { name: 'Save contact' }).click();
  await expect(contacts.getByRole('list', { name: 'Contacts' })).toContainText(`Lights ${tag}`);
  await expect(contacts.getByRole('list', { name: 'Contacts' })).toContainText('Stage lights');

  // Guest notes
  const guests = page.getByRole('region', { name: 'Guest details' });
  await guests.getByLabel('Guest notes').fill(`Nani ji front row ${tag}`);
  await guests.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Notes saved.')).toBeVisible();
  await expect(guests.getByLabel('Guest notes')).toHaveValue(`Nani ji front row ${tag}`);

  // Timeline: set a time on the first step → the next one shows ≈
  const tl = page.getByRole('region', { name: 'Event timeline' });
  const list = tl.getByRole('list', { name: 'Event timeline' });
  await list.getByRole('button').first().click();
  await page.getByRole('dialog').getByLabel('Time (optional)').fill('19:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Save step' }).click();
  await expect(list.getByRole('button').first()).toHaveAccessibleName(/, 7:30 PM, /);
  await expect(list.getByRole('button').nth(1)).toHaveAccessibleName(/, about /);

  // A new step with a task that comes back here
  await tl.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('dialog').getByLabel('Purpose').fill(`Cake ${tag}`);
  await page.getByRole('dialog').getByLabel('Duration (minutes)').fill('10');
  await page.getByRole('dialog').getByRole('button', { name: 'Save step' }).click();
  const cake = list.getByRole('button', { name: new RegExp(`^Cake ${tag}`) });
  await expect(cake).toBeVisible();
  await cake.click();
  await page.getByRole('dialog').getByRole('link', { name: 'Add task' }).click();
  await page.getByLabel('What needs doing?').fill(`Order cake ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reception' })).toBeVisible();
  await expect(cake).toContainText('✓ 1');

  // Move it up, then delete with Undo
  const before = await list.getByRole('button').count();
  await cake.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Move up' }).click();
  await expect(list.getByRole('button').nth(before - 2)).toHaveAccessibleName(new RegExp(`^Cake ${tag}`));
  await cake.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete step' }).click();
  await expect(cake).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(cake).toBeVisible();

  // Open in Guests → the Reception list
  await guests.getByRole('link', { name: 'Open in Guests' }).click();
  await expect(page).toHaveURL(/\/guests\?event=/);
  await expect(page.getByRole('combobox', { name: 'Event' })).toHaveValue(/.+/);
  expect(problems).toEqual([]);
});
