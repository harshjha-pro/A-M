// Session 6 journeys: E1 agenda, E3 edit venue → share text, E5 delete with counts → Undo.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

const MEHNDI = '01M4DK5T3E6QZBMNQ0V7KQWW23';
const TRIAL = '01M1DHZQ8GTXAWSA70A2MPRBGF'; // "Bridal makeup trial", 5 Dec 2026 (demo data)

test('E1: agenda by day with IST times; month view lists a tapped day', async ({ page }) => {
  const problems = watchProblems(page);
  await login(page, 'papa');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click();
  const day = page.getByRole('region', { name: 'Sun, 22 Nov 2026' });
  await expect(day.getByText('Engagement')).toBeVisible();
  await expect(day.getByText(/6:00 PM/)).toBeVisible();
  await page.getByRole('radio', { name: 'Month' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('gridcell', { name: /^22, / }).click();
  await expect(page.getByRole('region', { name: 'Sun, 22 Nov 2026' }).getByText('Engagement')).toBeVisible();
  expect(problems).toEqual([]);
});

test('E3: Ayush edits the Mehndi venue; Share on WhatsApp carries the new venue', async ({ page }, info) => {
  const venue = `Hotel Ashoka ${info.project.name}`;
  await login(page, 'ayush');
  await page.goto(`/calendar/events/${MEHNDI}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Venue', { exact: true }).fill(venue);
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  await expect(page.getByText(venue)).toBeVisible();
  const href = await page.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href');
  expect(decodeURIComponent(href)).toContain(`Mehndi · Sun, 14 Feb 2027, 4:00 PM IST · ${venue}, Shastri Nagar, Bhilwara · https://maps.google.com/?q=Porwal+Niwas+Bhilwara`);
});

test('E5: delete an event → counts → Undo brings it back', async ({ page }) => {
  await login(page, 'ayush');
  await page.goto(`/calendar/events/${TRIAL}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('invited families');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByText('Deleted Bridal makeup trial')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await page.goto(`/calendar/events/${TRIAL}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bridal makeup trial' })).toBeVisible();
});

test('E4: a Family member (Papa) opens an event: no Edit button', async ({ page }) => {
  await login(page, 'papa');
  await page.goto(`/calendar/events/${MEHNDI}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Mehndi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});
