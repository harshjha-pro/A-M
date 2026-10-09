// vite.config.js — builds dist/ for "live" (A&M Wedding) or "staging" (A&M Staging).
// Service worker: src/sw.js via vite-plugin-pwa (injectManifest, PWA.md §4.2).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = pkg.version; // must equal ../VERSION (checked by the PHP test suite)
const BUILT_AT = new Date().toISOString();

const FLAVOURS = {
  live: { name: 'A&M Wedding Planner', short: 'A&M Wedding', title: 'A&M Wedding' },
  staging: { name: 'A&M Staging', short: 'A&M Staging', title: 'A&M Staging' },
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Per-flavour title, manifest, icons and version.json. */
function amFlavour(mode) {
  const f = FLAVOURS[mode] ?? FLAVOURS.live;
  return {
    name: 'am-flavour',
    transformIndexHtml(html) {
      return html.replaceAll('%AM_APP_TITLE%', escapeHtml(f.title)).replaceAll('%AM_APP_SHORT%', escapeHtml(f.short));
    },
    writeBundle(opts) {
      const dir = opts.dir;
      mkdirSync(dir, { recursive: true });
      // Staging gets its own icon colour so nobody mixes up the two apps (PWA §11).
      const stagingIcons = resolve(dir, 'icons-staging');
      if (mode === 'staging' && existsSync(stagingIcons)) {
        cpSync(stagingIcons, resolve(dir, 'icons'), { recursive: true });
      }
      rmSync(stagingIcons, { recursive: true, force: true });

      const manifest = {
        id: '/',
        name: f.name,
        short_name: f.short,
        description: "Ayush & Mahi's wedding planner for the family.",
        lang: 'en-IN',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FBF7F0',
        theme_color: '#FBF7F0',
        categories: ['lifestyle', 'productivity'],
        prefer_related_applications: false,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android only (long-press the icon). A Viewer opening "Add" gets the normal no-access screen.
        shortcuts: [
          { name: 'Add a task', short_name: 'Add task', url: '/tasks/new', icons: [{ src: '/icons/shortcut-task-96.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Add a family', short_name: 'Add family', url: '/guests/new', icons: [{ src: '/icons/shortcut-family-96.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'My tasks', short_name: 'My tasks', url: '/tasks?view=mine', icons: [{ src: '/icons/shortcut-mytasks-96.png', sizes: '96x96', type: 'image/png' }] },
        ],
      };
      writeFileSync(resolve(dir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
      // The app polls this file to learn a new build exists (UpdatePrompt). Uploaded LAST.
      writeFileSync(resolve(dir, 'version.json'), JSON.stringify({ version: APP_VERSION, built_at: BUILT_AT, flavour: mode }) + '\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
    __APP_FLAVOUR__: JSON.stringify(FLAVOURS[mode] ? mode : 'live'),
  },
  plugins: [
    react(),
    tailwindcss(),
    amFlavour(mode),
    VitePWA({
      strategies: 'injectManifest', // our own sw.js: push later + full control
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',       // never auto-update; the user taps "Tap to refresh"
      injectRegister: false,        // registered from our own module (CSP: no inline script)
      manifest: false,              // written by amFlavour (per flavour)
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png'],
        // Never precache: the escape hatch, guide pictures, templates, the version file, the SW itself
        globIgnores: ['reset.html', 'reset.js', 'reset.css', 'install-guide/**', 'splash/**', 'templates/**', 'version.json', 'sw.js', 'icons-staging/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    sourcemap: false,          // no source maps on the server (nothing to read back)
    assetsInlineLimit: 0,      // CSP: no data: fonts or scripts; files only
    chunkSizeWarningLimit: 400,
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    css: false,
    restoreMocks: true,
  },
}));
