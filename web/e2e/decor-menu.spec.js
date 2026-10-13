// Workspace step C (1.0.19): Ayush adds a family outfit, sets the Mehndi theme, adds a decor
// item with a prop and a vendor, builds a Reception menu (category, Jain dish with a task that
// comes back to the menu) and copies it into Mehndi, then undoes the copy.
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

const MEHNDI = '01JC0WS0000000000000000002';
const RECEPTION = '01JC0WS0000000000000000006';

test('Ayush: family outfit, theme, decor item with prop, menu with Jain dish and task, copy menu with Undo', async ({ page }, info) => {
  test.setTimeout(120000);
  const problems = watchProblems(page);
  const tag = `${info.project.name}-${Date.now()}`;
  await login(page, 'ayush');

  // Family outfit
  await page.goto(`/workspaces/${MEHNDI}`);
  const family = page.getByRole('region', { name: 'Family outfits' });
  await family.getByRole('button', { name: 'Add outfit: Close family · Male' }).click();
  await page.getByRole('dialog').getByLabel('Who and what').fill(`Mama ji ${tag}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Mama ji ${tag}` })).toBeVisible();
  await expect(page.getByText('Mehndi · Close family · Male')).toBeVisible();
  await page.goto(`/workspaces/${MEHNDI}`);
  await expect(family.getByRole('link', { name: new RegExp(`Mama ji ${tag}`) })).toBeVisible();

  // Theme
  const decor = page.getByRole('region', { name: 'Theme & decoration' });
  await decor.getByRole('button', { name: 'Edit theme' }).click();
  await page.getByRole('dialog').getByLabel('Theme name').fill(`Garden ${tag}`);
  await page.getByRole('dialog').getByLabel('Colours').fill('Pastel green, gold');
  await page.getByRole('dialog').getByRole('button', { name: 'Save theme' }).click();
  await expect(decor.getByText(`Garden ${tag}`)).toBeVisible();

  // Decor item → its own timeline, a prop, the vendor
  await decor.getByRole('button', { name: 'Add decor item: Decor items' }).click();
  await page.getByRole('dialog').getByLabel('Decor item').fill(`Stage ${tag}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Stage ${tag}` })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Timeline' }).getByRole('button', { name: /^Booked/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add prop' }).click();
  await page.getByRole('dialog').getByLabel('Prop').fill('Marigold strings');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Props & accessories' }).getByRole('button', { name: /Marigold strings/ })).toBeVisible();
  const vendor = page.getByLabel('Vendor (contact)');
  await expect(vendor.locator('option', { hasText: 'Shree Tent House' })).toHaveCount(1);
  await vendor.selectOption({ label: 'Shree Tent House' });
  await page.getByRole('link', { name: '← Mehndi' }).click();
  await expect(decor.getByRole('link', { name: new RegExp(`Stage ${tag}.*Shree Tent House`) })).toBeVisible();

  // Reception menu: category, a Jain must-have dish, a task from the dish
  await page.goto(`/workspaces/${RECEPTION}`);
  const menu = page.getByRole('region', { name: 'Menu' });
  await menu.getByRole('button', { name: 'Add category' }).click();
  await page.getByRole('dialog').getByLabel('Category').fill(`Sweets ${tag}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await menu.getByRole('button', { name: `Add dish: Sweets ${tag}` }).click();
  const dish = page.getByRole('dialog');
  await dish.getByLabel('Dish').fill(`Moong dal halwa ${tag}`);
  await dish.getByText('Jain', { exact: true }).click();
  await dish.getByRole('switch', { name: '⭐ Must-have' }).check();
  await dish.getByRole('button', { name: 'Save dish' }).click();
  const list = menu.getByRole('list', { name: `Sweets ${tag}` });
  await expect(list.getByRole('button', { name: new RegExp(`Moong dal halwa ${tag}.*Jain`) })).toBeVisible();
  await list.getByRole('button', { name: new RegExp(`Moong dal halwa ${tag}`) }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Add task' }).click();
  await page.getByLabel('What needs doing?').fill(`Taste halwa ${tag}`);
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reception' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tasks' }).getByText(`Taste halwa ${tag}`)).toBeVisible();
  await expect(list.getByRole('button', { name: new RegExp(`Moong dal halwa ${tag}.*✓ 1`) })).toBeVisible();

  // Copy into Mehndi → Undo
  await page.goto(`/workspaces/${MEHNDI}`);
  await menu.getByRole('button', { name: 'Copy menu from…' }).click();
  await page.getByRole('dialog').getByLabel('Copy from').selectOption({ label: 'Reception' });
  await page.getByRole('dialog').getByRole('button', { name: 'Copy menu' }).click();
  await expect(menu.getByRole('list', { name: `Sweets ${tag}` }).getByRole('button', { name: new RegExp(`Moong dal halwa ${tag}`) })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone.')).toBeVisible();
  await expect(menu.getByRole('list', { name: `Sweets ${tag}` })).toHaveCount(0);
  expect(problems).toEqual([]);
});
