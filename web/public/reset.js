// reset.js — escape hatch for a stuck old version (PWA.md §6.4). Never precached; the
// service worker leaves it alone. Removes the service worker and the app-file caches.
// KEEPS the login cookie, localStorage drafts and IndexedDB (the outbox of unsent changes).
(async function () {
  var msg = document.getElementById('msg');
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    }
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }
    msg.textContent = 'Done. Opening the app…';
  } catch (e) {
    msg.textContent = 'Could not fix it here. Please ask Ayush or Mahi.';
    return;
  }
  setTimeout(function () { location.replace('/?fixed=' + Date.now()); }, 800);
})();
