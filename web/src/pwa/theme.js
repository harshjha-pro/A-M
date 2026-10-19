// Pure light royal blush theme (dark mode removed).
export function getTheme() {
  return 'light';
}

export function setTheme() {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  try {
    window.localStorage.removeItem('am.theme');
  } catch {}
}

