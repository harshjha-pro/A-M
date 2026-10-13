// Not a test: captures every screen (phone size, light + dark) for the design file.
// Run: AM_CAPTURE=1 tools/test-e2e.sh --project=android e2e/zz-capture.spec.js
import { test } from '@playwright/test';
import { login } from './helpers.js';

test.skip(!process.env.AM_CAPTURE, 'design capture only');
const OUT = process.env.AM_CAPTURE_OUT || '/tmp/am-screens';
const get = async (page, p) => page.evaluate(async (u) => (await (await fetch(`/api/v1${u}`, { credentials: 'same-origin' })).json()).data, p);

for (const theme of ['light', 'dark']) {
  test(`screens ${theme}`, async ({ page }) => {
    test.setTimeout(300000);
    await page.addInitScript((t) => { try { localStorage.setItem('am.theme', t); localStorage.setItem('am.iosGuideSeen', 'x'); localStorage.setItem('am.installDismissed', 'x'); } catch { /* none */ } }, theme);
    let n = 0;
    const shot = async (name) => {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      n += 1;
      await page.screenshot({ path: `${OUT}/${theme}/${String(n).padStart(2, '0')}-${name}.png`, fullPage: false });
    };
    await page.goto('/login'); await shot('login');
    await login(page, 'ayush');
    const task = (await get(page, '/tasks?view=all'))[0];
    const fam = (await get(page, '/households'))[0];
    const ev = (await get(page, '/events'))[0];
    const pay = (await get(page, '/payments'))[0];
    const ven = (await get(page, '/vendors'))[0];
    const doc = (await get(page, '/documents'))[0];
    const screens = [
      ['home', '/'], ['calendar', '/calendar'], ['event', `/calendar/events/${ev?.id}`], ['event-form', '/calendar/events/new'],
      ['tasks', '/tasks?view=all'], ['task', `/tasks/${task?.id}`], ['task-form', '/tasks/new'],
      ['guests', '/guests'], ['family', `/guests/${fam?.id}`], ['family-form', '/guests/new'], ['guests-import', '/guests/import'], ['guests-remind', '/guests/remind'],
      ['more', '/more'], ['money', '/money'], ['payments', '/money/payments'], ['payment', `/money/payments/${pay?.id}`], ['payment-form', '/money/payments/new'],
      ['vendors', '/vendors'], ['vendor', `/vendors/${ven?.id}`], ['vendor-form', '/vendors/new'],
      ['documents', '/documents'], ['document', `/documents/${doc?.id}`],
      ['settings', '/settings'], ['wedding-details', '/settings/wedding'], ['members', '/settings/members'], ['member-form', '/settings/members/new'],
      ['safety', '/settings/safety'], ['activity', '/settings/activity'], ['deleted-items', '/settings/deleted'], ['this-phone', '/settings/phone'],
      ['changes-on-this-phone', '/settings/waiting'], ['export', '/settings/export'], ['home-photos', '/settings/home-photos'], ['workspaces', '/workspaces'], ['workspace', '/workspaces/01JC0WS0000000000000000002'], ['vault', '/vault'], ['outfit', '/outfits/01JD0OF0000000000000000001'], ['imports', '/settings/imports'], ['my-account', '/settings/account'],
      ['install-guide', '/install'], ['not-found', '/nope'],
    ];
    for (const [name, url] of screens) {
      if (url.includes('/undefined')) continue;
      await page.goto(url);
      await shot(name);
    }
    // Offline: the guest list from the phone's copy, with its age
    await page.context().route('**/api/**', (r) => r.abort('internetdisconnected'));
    await page.goto('/guests'); await shot('offline-guests');
    await page.goto('/settings/activity'); await shot('offline-not-saved');
    await page.context().unroute('**/api/**');
  });
}
