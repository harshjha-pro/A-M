// 3-way merge (FEATURES A4) and local drafts (FEATURES A3).
import { describe, test, expect, beforeEach } from 'vitest';
import { merge3, applyChoices, changedKeys } from './merge3.js';
import { draftKey, saveDraft, loadDraft, clearDraft, pruneDrafts, countDrafts, MAX_DRAFTS } from './drafts.js';

const F = ['phone', 'city', 'adults', 'notes', 'amount'];
const base = { phone: '1', city: 'Bhilwara', adults: 2, notes: 'a', amount: 100 };

describe('merge3', () => {
  test('AC-CON-01: her phone + my city merge without asking', () => {
    const r = merge3({ base, mine: { ...base, city: 'Udaipur' }, theirs: { ...base, phone: '2' }, fields: F });
    expect(r.conflicts).toEqual([]);
    expect(r.auto).toEqual(['phone']);
    expect(r.merged).toEqual({ ...base, phone: '2', city: 'Udaipur' });
  });

  test('AC-CON-02: both changed adults → I choose', () => {
    const r = merge3({ base, mine: { ...base, adults: 5 }, theirs: { ...base, adults: 4 }, fields: F });
    expect(r.conflicts).toEqual(['adults']);
    expect(r.merged.adults).toBe(4);
    expect(applyChoices(r.merged, { ...base, adults: 5 }, { adults: 'mine' }).adults).toBe(5);
  });

  test('same new value merges, except amounts and statuses', () => {
    const mine = { ...base, city: 'Jaipur', amount: 200 };
    const theirs = { ...base, city: 'Jaipur', amount: 200 };
    const r = merge3({ base, mine, theirs, fields: F, neverAuto: ['amount'] });
    expect(r.auto).toEqual(['city']);
    expect(r.conflicts).toEqual(['amount']);
  });

  test('AC-CON-03: Keep both joins notes on a new line', () => {
    const mine = { ...base, notes: 'mine' };
    const r = merge3({ base, mine, theirs: { ...base, notes: 'theirs' }, fields: F });
    expect(applyChoices(r.merged, mine, { notes: 'both' }).notes).toBe('theirs\nmine');
  });

  test('changedKeys treats null and undefined alike', () => {
    expect(changedKeys(['a', 'b'], { a: null, b: 1 }, { b: 2 })).toEqual(['b']);
  });
});

describe('drafts', () => {
  beforeEach(() => localStorage.clear());

  test('key shape, round trip, no passwords', () => {
    const k = draftKey('U1', 'household', null);
    expect(k).toBe('draft:U1:household:new');
    saveDraft(k, { values: { name: 'Sharma', password: 'secret1', newPassword: 'x' }, baseVersion: 3, base: { name: 'S' } });
    const d = loadDraft(k);
    expect(d.values).toEqual({ name: 'Sharma' });
    expect(d.baseVersion).toBe(3);
    expect(JSON.stringify(localStorage)).not.toContain('secret1');
    clearDraft(k);
    expect(loadDraft(k)).toBeNull();
  });

  test('expires after 7 days', () => {
    const now = Date.now();
    saveDraft('draft:U1:f:1', { values: { a: 1 } }, now - 8 * 24 * 3600 * 1000);
    expect(loadDraft('draft:U1:f:1', now)).toBeNull();
    expect(localStorage.getItem('draft:U1:f:1')).toBeNull();
  });

  test('at most 50: the oldest go first; counted per person', () => {
    const now = Date.now();
    for (let i = 0; i < MAX_DRAFTS + 3; i++) saveDraft(`draft:U1:f:${i}`, { values: { i } }, now - (100 - i) * 1000);
    pruneDrafts(now);
    expect(countDrafts('U1', now)).toBe(MAX_DRAFTS);
    expect(localStorage.getItem('draft:U1:f:0')).toBeNull();
    expect(localStorage.getItem(`draft:U1:f:${MAX_DRAFTS + 2}`)).not.toBeNull();
    expect(countDrafts('U2', now)).toBe(0);
  });
});
