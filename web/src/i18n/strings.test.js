import { test, expect } from 'vitest';
import { strings, t } from './strings.en.js';

test('placeholders fill in; unknown keys are visible, not blank', () => {
  expect(t('home.welcome', { version: '1.0.1' })).toBe('A&M Wedding — version 1.0.1');
  expect(t('nope.missing')).toBe('nope.missing');
});

test('no jargon in user-facing words (DESIGN §8)', () => {
  const all = JSON.stringify(strings);
  for (const word of [/\bsync\b/i, /\bcache\b/i, /\bserver error\b/i, /\b409\b/, /\bsession\b/i, /\bRSVP\b/]) {
    expect(all).not.toMatch(word);
  }
});
