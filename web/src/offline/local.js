// local.js — answers for the main screens with no internet, built from the rows /sync
// saved on the phone (PWA.md §5.1 "Offline lists"). Same filters as the server for
// search and the main chips; advanced filters and sorting say "Needs internet".
// Returns { data, meta } like the API (camelCase), or null when this path isn't handled here.
import { getRecords, getRecord } from './cache.js';
import { todayIst } from '../format/ist.js';
import { OfflineError } from '../api/errors.js';
import { t } from '../i18n/strings.en.js';

const needsInternet = () => new OfflineError(t('offline.needsInternet'), { code: 'needs_internet' });
const lower = (s) => String(s ?? '').toLocaleLowerCase('en-IN');
const has = (hay, q) => lower(hay).includes(q);
const page = (rows, extra = {}) => ({ data: rows, meta: { hasMore: false, nextCursor: null, total: rows.length, ...extra } });

/** Only these query keys can be answered offline for a list; anything else needs the server. */
function allow(query, keys) {
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '' || k === 'limit' || k === 'cursor') continue;
    if (!keys.includes(k)) throw needsInternet();
  }
}

const DETAIL = {
  households: 'households', tasks: 'tasks', events: 'events', vendors: 'vendors', payments: 'payments', documents: 'documents',
};

export async function localAnswer(path, query = {}, user = null) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && DETAIL[parts[0]]) {
    const row = await getRecord(DETAIL[parts[0]], parts[1]);
    return row ? { data: row, meta: {} } : null;
  }
  if (parts.length !== 1) return null;
  switch (parts[0]) {
    case 'households': return households(query);
    case 'tasks': return tasks(query, user);
    case 'events': return events(query);
    case 'vendors': return vendors(query);
    case 'payments': return payments(query);
    case 'documents': return documents(query);
    case 'members': return list('members');
    case 'budget-categories': return list('budgetCategories');
    case 'settings': {
      const s = await getRecord('settings', 'settings');
      if (!s) return null;
      const { id: _id, ...rest } = s;
      return { data: rest, meta: {} };
    }
    default: return null;
  }
}

async function list(kind) {
  const rows = await getRecords(kind);
  return rows.length ? page(rows) : null;
}

/* ------------------------------------------------------------- families */
async function households(query) {
  allow(query, ['q', 'side', 'event', 'rsvp', 'sort']);
  if (query.sort && query.sort !== 'name') throw needsInternet();
  let rows = await getRecords('households');
  if (!rows.length) return null;
  const q = lower(query.q).trim();
  if (q) {
    const digits = q.replace(/\D+/g, '');
    rows = rows.filter((h) => has(h.name, q) || has(h.area, q) || has(h.groupName, q) || has(h.relation, q)
      || (digits.length >= 3 && [h.phone, h.altPhone].some((p) => String(p ?? '').replace(/\D+/g, '').includes(digits.slice(-10)))));
  }
  if (query.side) rows = rows.filter((h) => (query.side === 'both' ? h.side === 'both' : h.side === query.side || h.side === 'both'));
  if (query.event) {
    const rsvp = query.rsvp ? String(query.rsvp).split(',') : null;
    rows = rows
      .map((h) => ({ ...h, invitation: (h.invitations || []).find((i) => i.event?.id === query.event) ?? null }))
      .filter((h) => h.invitation && (!rsvp || rsvp.includes(h.invitation.rsvp)));
  } else if (query.rsvp) {
    throw needsInternet();
  }
  rows.sort((a, b) => lower(a.name).localeCompare(lower(b.name), 'en-IN') || String(a.id).localeCompare(String(b.id)));
  const people = rows.reduce((n, h) => n + (h.adults || 0) + (h.children || 0), 0);
  return page(rows, { totals: { people } });
}

/* ---------------------------------------------------------------- tasks */
const OPEN = ['todo', 'doing', 'waiting'];

function nowHhmm() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  return p;
}

function weekOf(today) {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const mon = new Date(d.getTime() - dow * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

export function taskInView(task, view, me, today = todayIst(), now = nowHhmm()) {
  const open = OPEN.includes(task.status);
  switch (view) {
    case 'all': return task.status !== 'cancelled';
    case 'mine': return task.status !== 'cancelled' && (task.assignees || []).some((a) => a?.id === me);
    case 'today': return open && task.dueDate === today;
    case 'week': { const [mon, sun] = weekOf(today); return open && Boolean(task.dueDate) && task.dueDate >= mon && task.dueDate <= sun; }
    case 'overdue': return open && Boolean(task.dueDate) && (task.dueDate < today || (task.dueDate === today && Boolean(task.dueTime) && task.dueTime < now));
    case 'no_date': return open && !task.dueDate;
    case 'closed': return task.status === 'done' || task.status === 'cancelled';
    default: return true;
  }
}

async function tasks(query, user) {
  allow(query, ['view', 'q', 'tag', 'event']);
  let rows = await getRecords('tasks');
  if (!rows.length) return null;
  const me = user?.id ?? null;
  const view = query.view || (user?.role === 'family' ? 'mine' : 'all');
  const today = todayIst();
  const now = nowHhmm();
  const q = lower(query.q).trim();
  let base = rows;
  if (q) base = base.filter((x) => has(x.title, q));
  if (query.tag) base = base.filter((x) => (x.tags || []).some((g) => g.id === query.tag));
  if (query.event) base = base.filter((x) => x.event?.id === query.event);
  const chipCounts = {};
  for (const chip of ['mine', 'today', 'week', 'overdue', 'no_date']) chipCounts[chip] = base.filter((x) => taskInView(x, chip, me, today, now)).length;
  rows = base.filter((x) => taskInView(x, view, me, today, now))
    .map((x) => ({
      ...x,
      overdue: taskInView(x, 'overdue', me, today, now),
      dueToday: OPEN.includes(x.status) && x.dueDate === today,
      itemCount: (x.items || []).length,
      itemsDone: (x.items || []).filter((i) => i.isDone).length,
    }))
    .sort((a, b) => (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) || String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')) || String(a.dueTime ?? '').localeCompare(String(b.dueTime ?? '')) || lower(a.title).localeCompare(lower(b.title)));
  return page(rows, { view, chipCounts });
}

/* ------------------------------------------------- events, vendors, … */
async function events(query) {
  allow(query, ['guestsInvited']);
  let rows = await getRecords('events');
  if (!rows.length) return null;
  if (query.guestsInvited === 'true') rows = rows.filter((e) => e.guestsInvited);
  return page(rows);
}

async function vendors(query) {
  allow(query, ['q', 'category']);
  let rows = await getRecords('vendors');
  if (!rows.length) return null;
  const q = lower(query.q).trim();
  if (q) rows = rows.filter((v) => has(v.name, q) || has(v.contactPerson, q) || has(v.phone, q));
  if (query.category) rows = rows.filter((v) => v.category === query.category);
  rows.sort((a, b) => lower(a.name).localeCompare(lower(b.name)));
  return page(rows);
}

async function payments(query) {
  allow(query, ['status', 'vendor']);
  let rows = await getRecords('payments');
  if (!rows.length) return null;
  const today = todayIst();
  const s = query.status;
  if (s === 'due') rows = rows.filter((p) => p.status === 'due');
  else if (s === 'paid') rows = rows.filter((p) => p.status === 'paid');
  else if (s === 'overdue') rows = rows.filter((p) => p.status === 'due' && p.dueDate && p.dueDate < today);
  else if (s === 'no_date') rows = rows.filter((p) => p.status === 'due' && !p.dueDate);
  if (query.vendor) rows = rows.filter((p) => p.vendor?.id === query.vendor);
  rows.sort((a, b) => (a.status === 'paid') - (b.status === 'paid') || (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1)
    || String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')) || String(b.paidOn ?? '').localeCompare(String(a.paidOn ?? '')));
  const sum = (f) => rows.filter(f).reduce((n, p) => n + (p.amountPaise || 0), 0);
  return page(rows, { totals: { amountPaise: sum(() => true), duePaise: sum((p) => p.status === 'due'), paidPaise: sum((p) => p.status === 'paid') } });
}

async function documents(query) {
  allow(query, ['type', 'q', 'vendor', 'event', 'payment']);
  let rows = await getRecords('documents');
  if (!rows.length) return null;
  const q = lower(query.q).trim();
  if (query.type) rows = rows.filter((d) => d.type === query.type);
  if (q) rows = rows.filter((d) => has(d.title, q));
  for (const [k, f] of [['vendor', 'vendor'], ['event', 'event'], ['payment', 'payment']]) {
    if (query[k]) rows = rows.filter((d) => d[f]?.id === query[k]);
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return page(rows);
}
