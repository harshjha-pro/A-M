// outboxState.js — what's waiting on this phone, for the screens (bar, 🕒 marks, This phone).
// Small on purpose: it loads with the first screen. The sender (outbox.js) loads only when
// something is saved or waiting (PWA.md §5.2).
import { useSyncExternalStore } from 'react';
import { withDb } from './db.js';
import { hasIndexedDb } from './cache.js';
import { ruleFor, entityFor } from './queueable.js';
import { getState } from '../api/session.js';

export const ENTRY_VERSION = 1;

/* ------------------------------------------------------------ the store */

const read = (fn, fallback) => (hasIndexedDb() ? withDb(fn).catch(() => fallback) : Promise.resolve(fallback));

/** Every entry on this phone (all logins), oldest first. Old shapes are upgraded here. */
export async function allEntries() {
  const rows = await read((d) => d.getAll('outbox'), []);
  return rows.map(upgrade).sort((a, b) => a.seq - b.seq);
}

/** Entries written by an older app: never dropped, only brought up to the current shape. */
export function upgrade(e) {
  const out = { ...e };
  if (!out.v) { // before v: 1 there was no status or entity
    out.v = ENTRY_VERSION;
    out.status = out.status || 'pending';
    out.attempted = Boolean(out.attempted);
  }
  if (!out.entity) {
    const rule = ruleFor(out.method, out.path);
    out.entity = rule ? entityFor(rule, out.key) : out.path;
  }
  if (out.status === undefined) out.status = 'pending';
  return out;
}


/* --------------------------------------------------------- live state */

let state = { entries: [], sending: false, nextTryAt: 0 };
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

/** Re-reads the store and tells the screens. */
export async function refreshOutbox() {
  state = { ...state, entries: await allEntries() };
  emit();
  return state.entries;
}

export function setSending(sending) {
  if (state.sending === sending) return;
  state = { ...state, sending };
  emit();
}

export function getOutboxState() {
  return state;
}

/** The sender's own bookkeeping (next try after a failure). */
export function patchOutboxState(patch) {
  state = { ...state, ...patch };
}

export function _resetOutboxStateForTests() {
  state = { entries: [], sending: false, nextTryAt: 0 };
}

/** { mine, waiting, needsYou, others, sending, pendingEntities } for the signed-in person. */
export function summarise(s, userId) {
  const mine = s.entries.filter((e) => e.userId === userId);
  const others = s.entries.filter((e) => e.userId !== userId);
  const byOwner = new Map();
  for (const e of others) byOwner.set(e.userId, { name: e.userName || '', count: (byOwner.get(e.userId)?.count ?? 0) + 1 });
  return {
    mine,
    waiting: mine.filter((e) => e.status === 'pending').length,
    needsYou: mine.filter((e) => e.status !== 'pending').length,
    others: [...byOwner.values()],
    sending: s.sending,
    pendingEntities: new Set(mine.map((e) => e.entity)),
  };
}

export function useOutbox() {
  const s = useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state, () => state);
  return summarise(s, getState().user?.id ?? null);
}

/** Is this record (or something inside it, like an invitation) waiting to be sent? 🕒 on rows and screens. */
export function useWaiting(entity) {
  const { mine } = useOutbox();
  return Boolean(entity) && mine.some((e) => e.entity === entity || e.entity.startsWith(`${entity}/`));
}

