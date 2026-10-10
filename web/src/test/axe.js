// axe for unit tests. Colour contrast needs a real browser (jsdom has no canvas);
// it is guaranteed by the design tokens (DESIGN §2.2) and checked in Playwright.
import { configureAxe } from 'vitest-axe';

export const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });
