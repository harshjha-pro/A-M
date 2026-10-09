// Session 9 journeys (TESTING §2.2): M1 add a payment with a new vendor, M3 pay part + Undo,
// M4 a family member without money access, M5 budget totals add up.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

const inDays = (n) => new Date(Date.now() + n * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10); // IST date

test('M1: + → Payment → new vendor, ₹1.25 lakh, due in 3 days → ₹1,25,000; Home Payments card lists it', async ({ page }, info) => {
  const problems = watchProblems(page);
  const title = `Tent advance ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Payment' }).click();
  await page.getByLabel(/What for/).fill(title);
  await page.getByLabel('Amount (₹)').fill('1.25 lakh');
  await expect(page.getByText('₹1,25,000')).toBeVisible();
  await page.getByLabel('Paid to').selectOption('__new__');
  await page.getByLabel('New vendor name').fill(`Test Tent ${info.project.name} ${Date.now()}`);
  await page.getByLabel('Due date (optional)').fill(inDays(3));
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment added.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('₹1,25,000')).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  // The card shows the 5 earliest and counts all of them (the demo already has 5 due in 14 days).
  const card = page.getByRole('region', { name: 'Payments due' });
  await expect.poll(async () => Number(((await card.getByText(/due in 14 days/).textContent()) ?? '0').match(/^(\d+) due/)?.[1] ?? 0)).toBeGreaterThanOrEqual(6);
  await page.goto('/money/payments');
  await page.getByRole('radio', { name: 'Due', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: title })).toContainText('₹1,25,000');
  expect(problems).toEqual([]);
});

test('M3: pay ₹40,000 of ₹1,00,000 → "Paid ₹40,000. ₹60,000 still due." → Undo → one ₹1,00,000 due row', async ({ page }, info) => {
  const title = `Band balance ${info.project.name} ${Date.now()}`;
  await login(page, 'ayush');
  await page.goto('/money/payments/new');
  await page.getByLabel(/What for/).fill(title);
  await page.getByLabel('Amount (₹)').fill('100000');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.getByRole('button', { name: 'Pay part' }).click();
  await page.getByRole('dialog').getByLabel('Amount paid now (₹)').fill('40000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save as paid' }).click();
  await expect(page.getByText('Paid ₹40,000. ₹60,000 still due.')).toBeVisible();
  await expect(page.getByText('₹60,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await page.goto('/money/payments');
  const rows = page.getByRole('listitem').filter({ hasText: title });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('₹1,00,000');
});

test('M4: Kavita (no money) → no Money in More, no Payments card; vendor contacts still there', async ({ page }) => {
  await login(page, 'kavita');
  await expect(page.getByRole('region', { name: 'Payments due' })).toHaveCount(0);
  await page.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: /Vendors/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Money/ })).toHaveCount(0);
  await page.goto('/money');
  await expect(page.getByText('You no longer have access to Money.')).toBeVisible();
});

test('M5: budget totals add up — Left = Planned − Spent, and the payment list totals match', async ({ page }) => {
  await login(page, 'ayush');
  await page.goto('/money');
  const amount = async (label) => Number((await page.getByText(label, { exact: true }).locator('xpath=following-sibling::dd').textContent()).replace(/[₹,−]/g, ''));
  const planned = await amount('Planned');
  const spent = await amount('Spent');
  const due = await amount('Still to pay');
  const left = await amount('Left');
  expect(left).toBe(planned - spent);
  await page.getByRole('link', { name: 'Payments' }).click();
  const line = await page.getByText(/ due · .* paid$/).textContent();
  const [, d, p] = line.match(/₹([\d,]+(?:\.\d+)?) due · ₹([\d,]+(?:\.\d+)?) paid/);
  expect([Number(d.replace(/,/g, '')), Number(p.replace(/,/g, ''))]).toEqual([due, spent]);
});
