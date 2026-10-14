// Workspace step B (1.0.18): Mahi adds a bride outfit in Mehndi, marks a timeline step done,
// adds a step, an accessory with a note, a moodboard link and a task from the outfit; the
// moodboard item shows in the Vault with its full path; deleting the outfit has Undo.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('Mahi: Mehndi → Bride outfit → timeline, accessory, note, moodboard, task → Vault path → delete with Undo', async ({ page }, info) => {
  test.setTimeout(90000);
  const problems = watchProblems(page);
  const tag = `${info.project.name}-${Date.now()}`;
  await login(page, 'mahi');
  await page.goto('/workspaces/01JC0WS0000000000000000002');
  const bride = page.getByRole('region', { name: 'Bride outfit' });
  await bride.getByRole('button', { name: 'Add outfit' }).click();
  await page.getByRole('dialog').getByLabel('Outfit name').fill(`Lehenga ${tag}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Lehenga ${tag}` })).toBeVisible();

  // Timeline: Selected done today; add a step
  const timeline = page.getByRole('list', { name: 'Timeline' });
  await timeline.getByRole('button', { name: /^Selected/ }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'Done' }).check();
  await expect(timeline.getByRole('button', { name: /^Selected, Done on/ })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('dialog').getByLabel('Step name').fill('Dupatta dyed');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(timeline.getByRole('button', { name: /^Dupatta dyed/ })).toBeVisible();
  await expect(page.getByText('1 of 5 steps done')).toBeVisible();

  // Accessory with a note
  await page.getByRole('button', { name: 'Add accessory' }).click();
  await page.getByRole('dialog').getByLabel('Accessory').fill('Maang tikka');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('region', { name: 'Accessories' }).getByRole('button', { name: /Maang tikka/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Add note').fill('Kundan, from Nani');
  await sheet.getByRole('button', { name: 'Add note' }).click();
  await expect(sheet.getByText('Kundan, from Nani')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();

  // Moodboard link
  const mood = page.getByRole('region', { name: 'Moodboard' });
  await mood.getByRole('button', { name: 'Add attachment' }).click();
  const add = page.getByRole('dialog');
  await add.getByText('Link', { exact: true }).click();
  await add.getByLabel('Link (https://…)').fill('https://example.com/lehenga');
  await add.getByLabel('Title').fill(`Lehenga idea ${tag}`);
  await add.getByRole('button', { name: 'Save attachment' }).click();
  await expect(mood.getByRole('link', { name: new RegExp(`Lehenga idea ${tag}`) })).toBeVisible();

  // Task from the outfit comes back here
  await page.getByRole('region', { name: 'Tasks' }).getByRole('link', { name: 'Add task' }).click();
  await page.getByLabel('What needs doing?').fill(`Book tailor ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Lehenga ${tag}` })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tasks' }).getByText(`Book tailor ${tag}`)).toBeVisible();

  // The Vault knows where it is used
  await mood.getByRole('link', { name: new RegExp(`Lehenga idea ${tag}`) }).click();
  await expect(page.getByRole('link', { name: `Mehndi › Bride outfit › Lehenga ${tag}` })).toBeVisible();
  await page.getByRole('link', { name: `Mehndi › Bride outfit › Lehenga ${tag}` }).click();

  // Delete the outfit → Undo
  await page.getByRole('button', { name: 'Delete outfit' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete outfit' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bride outfit' }).getByRole('link', { name: new RegExp(`Lehenga ${tag}`) })).toBeVisible();
  expect(problems).toEqual([]);
});
