// Applies the theme chosen in My account before the app draws (no flash).
// "follow" (default) = the phone's light/dark setting. A file, not inline: the CSP blocks inline scripts.
try {
  var t = localStorage.getItem('am.theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: follow the phone */ }
