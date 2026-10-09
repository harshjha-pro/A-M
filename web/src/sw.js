// sw.js — the service worker (PWA.md §4.3), built by vite-plugin-pwa (injectManifest).
// Rules (PWA §4.1): the app shell comes from the precache; /api/* is NEVER answered
// from a cache (a failed save is always a real failure the app sees); version.json is
// always fresh; reset.html / reset.js are never touched, so the escape hatch works
// even if this file is broken. Updates only when the page asks (the user tapped Refresh).
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// 1. App shell: hashed JS/CSS, index.html, fonts, icons. Injected at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 2. Page loads get the cached shell, so deep links open offline. Not the API, the
//    escape hatch, templates or anything that looks like a file.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//, /^\/reset(\.html|\.js|\.css)?$/, /^\/templates\//, /^\/version\.json$/],
}));

// 3. API: always the network. Writes are not routed at all (the browser sends them straight on).
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// 4. version.json: always the network (it is how we notice a new build).
registerRoute(({ url }) => url.pathname === '/version.json', new NetworkOnly());

// 5. Install Guide pictures: the cached copy at once, refreshed in the background.
registerRoute(
  ({ url }) => url.pathname.startsWith('/install-guide/'),
  new StaleWhileRevalidate({
    cacheName: 'install-guide',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 24 * 3600 })],
  }),
);

// 6. A new version takes over only when the page asks (UpdatePrompt → "Tap to refresh").
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 7. Web Push (Release 2a, PWA §7). Written now, used only once the server sends pushes.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = {}; }
  const n = msg.notification || {};
  const options = {
    body: n.body || '',
    tag: n.tag || undefined,
    lang: n.lang || 'en-IN',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url: n.navigate || '/' },
  };
  const tasks = [self.registration.showNotification(n.title || 'A&M Wedding', options)];
  if (n.app_badge !== undefined && 'setAppBadge' in self.navigator) {
    const count = Number(n.app_badge);
    tasks.push((count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()).catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks)); // a visible notification for every push (iOS and Chrome require it)
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (target.origin !== self.location.origin) return; // only our own pages
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        w.postMessage({ type: 'NAVIGATE', url: target.pathname + target.search });
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window' })
    .then((wins) => wins.forEach((w) => w.postMessage({ type: 'PUSH_RESUBSCRIBE' }))));
});
