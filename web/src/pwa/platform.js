// What kind of phone and window are we in? (PWA.md §3.1)
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

// iPadOS 13+ says "Macintosh"; touch points give it away.
export const isIOS = /iPhone|iPad|iPod/.test(ua)
  || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/.test(ua);

/** "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X)…" → 16.7; null if not iOS or unknown. */
export function iosVersionOf(agent) {
  const m = agent.match(/OS (\d+)[_.](\d+)/);
  return /iPhone|iPad|iPod/.test(agent) && m ? Number(`${m[1]}.${m[2]}`) : null;
}

/** Chrome's major version on Android, e.g. 128; null for anything else (Samsung Internet included). */
export function chromeVersionOf(agent) {
  if (!/Android/.test(agent) || /SamsungBrowser|EdgA|OPR|Firefox/.test(agent)) return null;
  const m = agent.match(/Chrome\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export const iosVersion = iosVersionOf(ua);
export const chromeVersion = chromeVersionOf(ua);

// Other browsers on iPhone can't add a Home Screen web app as reliably as Safari: ask for Safari.
export const isIOSNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua);
// Android in-app browsers (WebView, e.g. a link opened inside WhatsApp) add "; wv)".
export const isAndroidWebView = isAndroid && /; wv\)/.test(ua);
// Samsung Internet, Firefox… on Android: install works best from Chrome.
export const isAndroidNonChrome = isAndroid && !isAndroidWebView && chromeVersion === null;

export const MIN_IOS = 17;     // PWA §0.1: iPhones from 2020, kept up to date
export const MIN_CHROME = 120;

/** "Please update…" for phones below what we support (PWA §0.1); null when fine. Uses the given agent for tests. */
export function oldPhoneMessage(agent = ua) {
  const ios = iosVersionOf(agent);
  if (ios !== null && ios < MIN_IOS) return 'ios';
  const chrome = chromeVersionOf(agent);
  if (chrome !== null && chrome < MIN_CHROME) return 'chrome';
  return null;
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

/** Sent as X-Device on every request (API.md §1.2), e.g. "iPhone · installed". */
export function deviceLabel() {
  const phone = isIOS ? 'iPhone' : isAndroid ? 'Android' : 'Computer';
  return `${phone} · ${isStandalone() ? 'installed' : 'browser'}`;
}

/** localStorage that never throws (private mode, storage blocked). */
export const local = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
};
