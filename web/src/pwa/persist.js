// Asking the phone to keep our data (PWA.md §5.6), and how much space we use.
export async function storageInfo() {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s) return { supported: false, persisted: false, usage: null, quota: null };
  const [persisted, est] = await Promise.all([
    s.persisted ? s.persisted().catch(() => false) : false,
    s.estimate ? s.estimate().catch(() => ({})) : {},
  ]);
  return { supported: Boolean(s.persist), persisted: Boolean(persisted), usage: est.usage ?? null, quota: est.quota ?? null };
}

/** Called after login and from This phone. Chrome usually grants installed apps silently. */
export async function askToKeepData() {
  try { return Boolean(await navigator.storage?.persist?.()); } catch { return false; }
}
