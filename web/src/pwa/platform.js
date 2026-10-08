// What kind of phone and window are we in? (PWA.md §3.1)
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

// iPadOS 13+ says "Macintosh"; touch points give it away.
export const isIOS = /iPhone|iPad|iPod/.test(ua)
  || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/.test(ua);

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

/** Sent as X-Device on every request (API.md §1.2), e.g. "iPhone · installed". */
export function deviceLabel() {
  const phone = isIOS ? 'iPhone' : isAndroid ? 'Android' : 'Computer';
  return `${phone} · ${isStandalone() ? 'installed' : 'browser'}`;
}
