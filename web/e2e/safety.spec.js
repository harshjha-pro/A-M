// Session 3 journeys: E2E-06 (two phones edit the wedding details) and
// E2E-09 (the reply is lost; Try again makes one record, not two).
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

test('E2E-06: different fields merge by themselves; the same field opens the conflict screen', async ({ browser }, info) => {
  const tag = info.project.name;
  // Two real phones: each its own network address (the not-logged-in limit is per address).
  const ip = (n) => ({ ...info.project.use, extraHTTPHeaders: { 'X-Forwarded-For': `198.51.100.${n}` } });
  const base = { android: 60, 'small-iphone': 70, 'small-android': 80 }[info.project.name] ?? 90;
  const a = await browser.newContext(ip(base + 1));
  const m = await browser.newContext(ip(base + 2));
  const ayush = await a.newPage();
  const mahi = await m.newPage();
  const problems = [...watchProblems(ayush)];
  try {
    await login(ayush, 'ayush');
    await login(mahi, 'mahi');
    for (const p of [ayush, mahi]) {
      await p.goto('/settings/wedding');
      await p.getByRole('button', { name: 'Edit' }).click();
    }
    // Different fields: no conflict screen (AC-CON-01).
    await mahi.getByLabel("Groom's side name").fill(`Ayush side ${tag}`);
    await mahi.getByRole('button', { name: 'Save details' }).click();
    await expect(mahi.getByText(`Ayush side ${tag}`)).toBeVisible();
    await ayush.getByLabel('City').fill(`Bhilwara ${tag}`);
    await ayush.getByRole('button', { name: 'Save details' }).click();
    await expect(ayush.getByText(`Bhilwara ${tag}`)).toBeVisible();
    await expect(ayush.getByText(`Ayush side ${tag}`)).toBeVisible();

    // Same field: I choose (AC-CON-02).
    for (const p of [ayush, mahi]) {
      await p.goto('/settings/wedding');
      await p.getByRole('button', { name: 'Edit' }).click();
    }
    await mahi.getByLabel('City').fill(`Udaipur ${tag}`);
    await mahi.getByRole('button', { name: 'Save details' }).click();
    await expect(mahi.getByText(`Udaipur ${tag}`)).toBeVisible();
    await ayush.getByLabel('City').fill(`Jaipur ${tag}`);
    await ayush.getByRole('button', { name: 'Save details' }).click();
    await expect(ayush.getByRole('heading', { name: /^Mahi Jagetiya changed this at .+ while you were editing\.$/ })).toBeVisible();
    const save = ayush.getByRole('button', { name: 'Save my choices' });
    await expect(save).toBeDisabled();
    await ayush.getByRole('group', { name: 'City' }).getByText('Your version').click();
    await save.click();
    await expect(ayush.getByText(`Jaipur ${tag}`)).toBeVisible();

    // History says what happened, in plain words.
    await ayush.getByRole('link', { name: 'See history' }).click();
    await expect(ayush.getByText(`Ayush Porwal changed City from Udaipur ${tag} to Jaipur ${tag}.`)).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await a.close();
    await m.close();
  }
});

test('E2E-09: the reply is lost; Try again saves one drill, not two', async ({ page }, info) => {
  const note = `Lost reply check ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/settings/safety');
  let first = true;
  await page.route('**/api/v1/restore-drills', async (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      await route.fetch();   // the server saves…
      await route.abort();   // …but the phone never hears back
      return;
    }
    await route.continue();
  });
  await page.getByLabel('Notes (optional)').fill(note);
  await page.getByRole('button', { name: 'Save drill' }).click();
  await expect(page.getByText("Couldn't save. Your changes are kept on this phone.")).toBeVisible();
  await page.getByRole('button', { name: 'Save drill' }).click();
  await expect(page.getByText(/Saved ✓/)).toBeVisible();
  await expect(page.getByText(note)).toHaveCount(1);
  await page.reload();
  await expect(page.getByText(note)).toHaveCount(1);
});

test('delete a drill, then Undo brings it back', async ({ page }, info) => {
  const note = `Undo check ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/settings/safety');
  await page.getByLabel('Notes (optional)').fill(note);
  await page.getByRole('button', { name: 'Save drill' }).click();
  const row = page.getByRole('listitem').filter({ hasText: note });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Delete:/ }).click();
  await expect(page.getByText(note)).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(page.getByText(note)).toHaveCount(1);
});
