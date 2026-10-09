// useAndroidInstall — Chrome's own install dialog, opened only from our banner or the
// Install Guide's button (PWA.md §3.2). captureInstallPrompt() runs in main.jsx before
// React, because Chrome fires beforeinstallprompt early.
import { useEffect, useState } from 'react';
import { isStandalone, local } from './platform.js';

let deferred = null; // the saved beforeinstallprompt event (usable once)
const subs = new Set();
const ping = () => subs.forEach((fn) => fn());

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no mini-infobar; we offer it ourselves
    deferred = e;
    ping();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    local.set('am.installedAt', new Date().toISOString());
    ping();
  });
}

export function useAndroidInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return {
    canPrompt: Boolean(deferred),
    installed: isStandalone() || Boolean(local.get('am.installedAt')),
    async prompt() { // from a tap only
      if (!deferred) return 'unavailable';
      const e = deferred;
      deferred = null;
      await e.prompt();
      const { outcome } = await e.userChoice; // 'accepted' | 'dismissed'
      ping();
      return outcome;
    },
  };
}
