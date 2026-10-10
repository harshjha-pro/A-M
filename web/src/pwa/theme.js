// Theme per phone (DESIGN D4): follow the phone, light or dark. Stored on the phone only.
const KEY = 'am.theme';

export function getTheme() {
  try {
    const t = window.localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'follow';
  } catch {
    return 'follow';
  }
}

export function setTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  try {
    if (theme === 'follow') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, theme);
  } catch { /* storage blocked: still applied for this visit */ }
}
