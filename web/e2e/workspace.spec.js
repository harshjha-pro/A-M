// Workspace step A + Attachment Vault (1.0.17): Ayush opens Workspace → Mehndi, adds a task in
// the strip, adds a link and a video (sent in pieces) to Files, finds both in the Vault with
// where they are used, gives one its own ID; Papa (Family) keeps Guests and never sees Workspace.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('Ayush: Workspace → Mehndi → task in the strip, a link and a video in Files → Vault shows where they are used; own ID', async ({ page }, info) => {
  test.setTimeout(90000);
  const problems = watchProblems(page);
  const tag = `${info.project.name}-${Date.now()}`;
  await login(page, 'ayush');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Workspace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Workspace' })).toBeVisible();
  for (const name of ['Engagement', 'Mehndi', 'Carnival', 'DJ Night', 'Mayra', 'Reception', 'Varmala & Phere']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await page.getByRole('link', { name: /^Mehndi/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  await expect(page.getByRole('link', { name: /On the calendar: Mehndi/ })).toBeVisible();

  // A task from the strip comes back to the workspace and shows there.
  await page.getByRole('link', { name: 'Add task' }).click();
  await page.getByLabel('What needs doing?').fill(`Book mehndi artist ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tasks' }).getByText(`Book mehndi artist ${tag}`)).toBeVisible();

  // A link in Files.
  await page.getByRole('button', { name: 'Add attachment' }).click();
  let sheet = page.getByRole('dialog');
  await sheet.getByText('Link', { exact: true }).click();
  await sheet.getByLabel('Link (https://…)').fill('https://example.com/haath');
  await sheet.getByLabel('Title').fill(`Haath design ${tag}`);
  await sheet.getByRole('button', { name: 'Save attachment' }).click();
  await expect(page.getByText(`Haath design ${tag}`)).toBeVisible();

  // A 5 MB video: 3 pieces of 2 MB.
  await page.getByRole('button', { name: 'Add attachment' }).click();
  sheet = page.getByRole('dialog');
  await sheet.getByText('Video', { exact: true }).click();
  await sheet.getByTestId('vault-file').setInputFiles({ name: `trial-${tag}.mp4`, mimeType: 'video/mp4', buffer: Buffer.alloc(5 * 1024 * 1024, info.project.name.length) });
  await sheet.getByRole('button', { name: 'Save attachment' }).click();
  await expect(page.getByText(`trial-${tag}`)).toBeVisible({ timeout: 30000 });

  // The Vault: both, with where they are used; give the link its own ID.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Attachment Vault/ }).click();
  await page.getByLabel('Search ID, title or note').fill(tag);
  const link = page.getByRole('link', { name: new RegExp(`Haath design ${tag}`) });
  await expect(link).toContainText('Mehndi › Files');
  await expect(page.getByRole('link', { name: new RegExp(`trial-${tag}`) })).toBeVisible();
  await link.click();
  const code = `HAATH-${info.project.name.slice(0, 5).toUpperCase()}-${String(Date.now()).slice(-6)}`;
  await page.getByLabel('ID', { exact: true }).fill(code);
  await expect(page.getByText('This ID is free.')).toBeVisible();
  await page.getByRole('button', { name: 'Save attachment' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mehndi › Files' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('Papa (Family): Guests stays in the bottom bar; no Workspace; the API refuses', async ({ page }) => {
  await login(page, 'papa');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Guests' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Workspace' })).toHaveCount(0);
  const status = await page.evaluate(async () => (await fetch('/api/v1/workspaces')).status);
  expect(status).toBe(403);
});
