// Session 10 journeys (TESTING §2.2): E2E-14 upload a JPEG receipt from a file chooser →
// compressed to ≤ 1600 px with no GPS EXIF (AC-DOC-01), a progress bar, a thumbnail;
// and a receipt attached to a payment from the payment page (US-DOC-01).
import { test, expect } from '@playwright/test';
import { login, watchProblems } from './helpers.js';

/** A 4032×3024 photo-like JPEG made in the page, as base64. */
async function bigPhoto(page) {
  return page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 4032;
    c.height = 3024;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 4032, 3024);
    grad.addColorStop(0, '#8a1c2b');
    grad.addColorStop(1, '#f2c14e');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4032, 3024);
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = `hsl(${i * 9}, 60%, ${30 + (i % 5) * 10}%)`;
      g.beginPath();
      g.arc((i * 397) % 4032, (i * 211) % 3024, 120 + (i % 7) * 40, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff';
    g.font = 'bold 160px sans-serif';
    g.fillText('Shree Tent House — ₹40,000', 300, 1500);
    g.fillText(`No. ${Math.random().toString(36).slice(2, 10)}`, 300, 1800); // a new file every run (no duplicate prompt)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  });
}

/** EXIF APP1 with a GPS IFD (GPSLatitudeRef = N), put right after SOI. */
function withGps(jpeg) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD0 at 8
    0x00, 0x01, 0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00, // GPSInfo → 26
    0x00, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x4e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // GPSLatitudeRef "N"
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, body, jpeg.subarray(2)]);
}

/** Width and height from the first SOF marker. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

test('E2E-14: a 4032×3024 JPEG with GPS → stored ≤ 1600 px, < 600 KB, no EXIF; progress bar; thumbnail', async ({ page }, info) => {
  const problems = watchProblems(page);
  const original = withGps(Buffer.from(await (async () => { await page.goto('/login'); return bigPhoto(page); })(), 'base64'));
  expect(original.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(true);
  expect(jpegSize(original)).toEqual({ width: 4032, height: 3024 });

  await login(page, 'papa');
  await page.goto('/documents');
  await page.getByRole('button', { name: 'Add document' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add document' });
  await sheet.getByLabel('Choose file').setInputFiles({ name: `IMG_${info.project.name}_${Date.now()}.jpg`, mimeType: 'image/jpeg', buffer: original });
  const title = `Tent receipt ${info.project.name} ${Date.now()}`;
  await sheet.getByRole('radio', { name: 'Receipt' }).check({ force: true });
  await sheet.getByLabel(/^Title/).fill(title);

  // Slow the upload down so the progress bar can be seen (Chromium network emulation).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: -1, uploadThroughput: 150 * 1024 });
  await sheet.getByRole('button', { name: 'Upload' }).click();
  await expect(sheet.locator('progress')).toBeVisible();
  await expect(page.getByText('Document saved')).toBeVisible({ timeout: 30000 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row).toBeVisible();
  const thumb = row.locator('img');
  await expect.poll(() => thumb.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  const src = await page.getByRole('img', { name: title }).getAttribute('src');
  const res = await page.request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  const stored = await res.body();
  const size = jpegSize(stored);
  expect(Math.max(size.width, size.height)).toBe(1600);
  expect(size).toEqual({ width: 1600, height: 1200 });
  expect(stored.length).toBeLessThan(600 * 1024);
  expect(stored.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(false); // GPS and all EXIF gone
  expect(problems).toEqual([]);
});

test('US-DOC-01: a receipt photo added on a payment is listed there with a paperclip in the list', async ({ page }, info) => {
  const title = `Mehndi artist ${info.project.name} ${Date.now()}`;
  await login(page, 'papa');
  await page.goto('/money/payments/new');
  await page.getByLabel(/What for/).fill(title);
  await page.getByLabel('Amount (₹)').fill('5100');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  const photo = Buffer.from(await bigPhoto(page), 'base64');
  await page.getByRole('button', { name: 'Add receipt photo' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add document' });
  await sheet.getByLabel('Choose file').setInputFiles({ name: `bill-${info.project.name}-${Date.now()}.jpg`, mimeType: 'image/jpeg', buffer: photo });
  await sheet.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Document saved')).toBeVisible({ timeout: 30000 });
  const receipts = page.getByRole('region', { name: 'Receipts' });
  await expect(receipts.getByRole('listitem')).toHaveCount(1);
  await expect(receipts.getByRole('listitem')).toContainText(`Receipt – ${title}`); // the automatic title
  await page.goto('/money/payments');
  await expect(page.getByRole('listitem').filter({ hasText: title }).getByLabel('1 receipt', { exact: true })).toBeVisible();
});
