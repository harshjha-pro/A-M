// startSync.js — AppShell's door to the sync loop (sync.js), loaded after the first screen.
// The loop itself waits a few seconds more before its first sync (sync.js).
export function startSyncLoop(userId) {
  let stop = null;
  let cancelled = false;
  import('./sync.js').then((m) => { if (!cancelled) stop = m.startSyncLoop(userId); });
  return () => { cancelled = true; stop?.(); };
}
