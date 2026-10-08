// Renders the app icons (PWA.md §2.2): "A&M" in Atkinson Hyperlegible Bold,
// ivory letters with a marigold "&", on a maroon gradient. No logo.
// Staging gets a blue gradient so nobody mixes up the two apps (PWA §11).
// Run: node tools/render-icons.mjs   (uses the sandbox's Chromium)
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const fontPath = resolve('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2');
const font = readFileSync(fontPath).toString('base64');

const FLAVOURS = {
  icons: { top: '#A32A3C', bottom: '#7A1626' },          // live: maroon
  'icons-staging': { top: '#3A64A8', bottom: '#1F3A66' }, // staging: blue
};

// kind: full (iPhone, square, iOS rounds it), rounded (Android "any": 22% radius,
// transparent corners), maskable (full bleed, mark inside the centre 80% circle)
const FILES = [
  ['apple-touch-icon-180.png', 180, 'full'],
  ['icon-192.png', 192, 'rounded'],
  ['icon-512.png', 512, 'rounded'],
  ['icon-maskable-192.png', 192, 'maskable'],
  ['icon-maskable-512.png', 512, 'maskable'],
  ['favicon-48.png', 48, 'rounded'],
];

function html(size, kind, c) {
  const radius = kind === 'rounded' ? size * 0.22 : 0;
  const fontSize = size * (kind === 'maskable' ? 0.27 : 0.34);
  return `<!doctype html><html><head><style>
    @font-face { font-family: 'AH'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 700; }
    html, body { margin: 0; background: transparent; }
    .icon { width: ${size}px; height: ${size}px; border-radius: ${radius}px; overflow: hidden;
            background: linear-gradient(180deg, ${c.top} 0%, ${c.bottom} 100%);
            display: flex; align-items: center; justify-content: center; position: relative; }
    .icon::before { content: ''; position: absolute; inset: 0;
            background: radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,.16), rgba(255,255,255,0) 60%); }
    .mark { position: relative; font-family: 'AH'; font-weight: 700; font-size: ${fontSize}px; line-height: 1;
            letter-spacing: -0.01em; color: #FBF7F0; white-space: nowrap; transform: translateY(${size * 0.01}px); }
    .amp { color: #F2B84B; }
  </style></head><body><div class="icon"><span class="mark">A<span class="amp">&amp;</span>M</span></div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [dir, colours] of Object.entries(FLAVOURS)) {
  mkdirSync(resolve('public', dir), { recursive: true });
  for (const [name, size, kind] of FILES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size, kind, colours));
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.icon').screenshot({ path: resolve('public', dir, name), omitBackground: true });
  }
}
await browser.close();
console.log('Icons written to public/icons and public/icons-staging');
