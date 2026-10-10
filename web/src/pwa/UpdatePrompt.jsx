// UpdatePrompt — "New version available. Tap to refresh." (PWA.md §6.1, §6.3).
// Never reloads by itself, and never while a form has unsaved typing. Checks
// version.json on open, when the app comes back to the front (at most once a minute)
// and every 30 minutes. Forced form when the server refuses old apps (426):
// "Please refresh to keep saving. Your typing is kept." (drafts are on the phone).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchVersion } from '../api/client.js';
import { anyDirtyForm } from './dirtyForms.js';
import { getSwState, subscribeSw, checkForUpdate, updateArriving, applyUpdate } from './swClient.js';
import { useForcedUpdate } from './updateState.js';
import { t } from '../i18n/strings.en.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const CHECK_EVERY_MS = 30 * 60 * 1000;
export const MIN_GAP_MS = 60 * 1000;
export const STUCK_AFTER_MS = 20 * 1000;

export default function UpdatePrompt() {
  const sw = useSyncExternalStore(subscribeSw, getSwState, getSwState);
  const forced = useForcedUpdate();
  const [stale, setStale] = useState(false); // a newer build exists, but no new service worker came
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastCheck = useRef(0);
  const boxRef = useRef(null);
  const show = sw.needRefresh || stale || forced;

  // While shown, the page gets that much more room at the bottom (AppShell reads
  // --am-update-h), so the prompt never covers a form's Save or Cancel button.
  useEffect(() => {
    const root = document.documentElement;
    const el = boxRef.current;
    if (!show || !el) {
      root.style.removeProperty('--am-update-h');
      return undefined;
    }
    const setH = () => root.style.setProperty('--am-update-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    setH();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(setH) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--am-update-h'); };
  }, [show, blocked]);

  useEffect(() => {
    let stuckTimer = null;
    async function check() {
      const now = Date.now();
      if (now - lastCheck.current < MIN_GAP_MS || navigator.onLine === false) return;
      lastCheck.current = now;
      const version = await fetchVersion();
      if (!version || version === APP_VERSION) return;
      await checkForUpdate(); // downloads the new sw.js and its files in the background
      clearTimeout(stuckTimer);
      stuckTimer = setTimeout(async () => {
        if (!(await updateArriving())) setStale(true); // the old worker is stuck: offer Fix the app
      }, STUCK_AFTER_MS);
    }
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_EVERY_MS);
    // A lazy screen from the old build was deleted by a newer deploy.
    const onPreloadError = (ev) => { ev.preventDefault(); setStale(true); };
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
      clearTimeout(stuckTimer);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  if (!show) return null;

  function refresh() {
    if (anyDirtyForm() && !forced) {
      setBlocked(true);
      return;
    }
    setBusy(true);
    if (applyUpdate()) return;                       // the new worker takes over, then the page reloads once
    if (stale && sw.registered) {
      window.location.assign('/reset.html');         // stuck old version: clear app files, keep data
      return;
    }
    window.location.reload();                        // no service worker here: a reload fetches the new app
  }

  return (
    <div ref={boxRef} role="status" aria-live="polite" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 pb-2">
      <div className="flex w-full max-w-xl flex-col gap-2 rounded-md bg-info-soft p-4 text-text shadow-card">
        <p className="text-base font-bold">{forced ? t('update.forced') : t('update.available')}</p>
        {blocked && <p className="text-sm font-bold text-warning">{t('update.saveFirst')}</p>}
        <button type="button" onClick={refresh} disabled={busy}
          className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary disabled:opacity-40">
          <RefreshCw aria-hidden="true" size={20} />{busy ? t('update.refreshing') : t('update.tap')}
        </button>
      </div>
    </div>
  );
}
