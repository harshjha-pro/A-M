// Pure light royal blush theme (dark mode removed).
try {
  localStorage.removeItem('am.theme');
  document.documentElement.removeAttribute('data-theme');
} catch (e) {}
