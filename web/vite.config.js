// vite.config.js — builds dist/ for "live" (A&M Wedding) or "staging" (A&M Staging).
// No service worker yet: that is Session 12 (PWA.md §4).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
        // Android shortcuts arrive with the install work (Session 12).
      };
      writeFileSync(resolve(dir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
      // The app polls this file to learn a new build exists (Session 12). Uploaded LAST.
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
  plugins: [react(), tailwindcss(), amFlavour(mode)],
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
