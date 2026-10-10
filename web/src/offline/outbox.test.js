// The outbox (PWA.md §5.2, TESTING §1.7 "Outbox"), against a fake server:
// written before fetch; removed only on 2xx or Discard; same key on every retry (a lost
// reply never saves twice); 401 kept; non-queueable never queued; another person's entries
// never sent; old entry shape still read; offline edits merged; create-then-tick; chained
// edits; a conflict blocks only its record; discard; duplicate → Add anyway; back-off.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeApi, ok, fail, signInAs, signOut, PEOPLE } from '../test/helpers.js';
import { _resetForTests, withDb } from './db.js';
import {
  saveViaOutbox, enqueue, flushOutbox, allEntries, discardEntry, resolveConflict, addAnyway, retryEntry,
  _resetOutboxForTests, clashes, summarise, getOutboxState, BACKOFF_FIRST_MS,
} from './outbox.js';
import { isQueueable, placeholderId } from './queueable.js';
import { putRecords, getRecord, wipe, ensureUser } from './cache.js';
import { ConflictError, DuplicateError, AuthError } from '../api/errors.js';
import { finishLoginRequest, getLoginRequest } from '../api/session.js';

const T1 = '01JA7Q3M2K8V5R1T9W4X6Y0T01';
const T2 = '01JA7Q3M2K8V5R1T9W4X6Y0T02';
const task = (over = {}) => ({ id: T1, version: 3, title: 'Book tent wala', status: 'todo', priority: 'normal', due_date: null, notes: null, assignees: [], tags: [], items: [], ...over });
const noNet = () => { throw new TypeError('Failed to fetch'); };
const writes = (fetchFn) => fetchFn.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
const header = (init, h) => init.headers[h];

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  _resetForTests();
  _resetOutboxForTests();
  signInAs('papa');
  await ensureUser(PEOPLE.papa.id);
});
afterEach(() => { signOut(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Each change is kept until the server has it', () => {
  test('the entry is in IndexedDB before the request leaves; removed after the 2xx', async () => {
    let seenInStore = null;
    fakeApi({ [`POST /tasks/${T1}/done`]: async () => { seenInStore = (await allEntries()).length; return ok(task({ status: 'done', version: 4 })); } });
    const res = await saveViaOutbox('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3, label: 'Tick' });
    expect(seenInStore).toBe(1);
    expect(res.data.status).toBe('done');
    expect(await allEntries()).toEqual([]);
  });

  test('no internet → kept (queued, 🕒); back online → sent once and removed', async () => {
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: noNet });
    await putRecords('tasks', [{ id: T1, version: 3, title: 'Book tent wala', status: 'todo', items: [] }]);
    const res = await saveViaOutbox('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3, label: 'Tick' });
    expect(res.queued).toBe(true);
    expect((await getRecord('tasks', T1)).status).toBe('done'); // the phone's copy shows it
    expect((await allEntries())[0].status).toBe('pending');
    f.mockImplementation(async () => ok(task({ status: 'done', version: 4 })));
    await flushOutbox({ force: true });
    expect(await allEntries()).toEqual([]);
    expect(writes(f)).toHaveLength(2); // one failed try, one success — same key both times
    expect(new Set(writes(f).map(([, i]) => header(i, 'Idempotency-Key'))).size).toBe(1);
  });

  test('a lost reply (the server saved, the phone never heard) → the retry uses the same key, so it saves once', async () => {
    const saved = new Map();
    let first = true;
    fakeApi({
      'POST /tasks': (body, init) => {
        const k = header(init, 'Idempotency-Key');
        if (!saved.has(k)) saved.set(k, { ...task({ id: T2, version: 1 }), title: body.title });
        if (first) { first = false; throw new TypeError('reply lost'); }
        return ok(saved.get(k), 201);
      },
    });
    const key = crypto.randomUUID();
    expect((await saveViaOutbox('POST', '/tasks', { body: { title: 'Halwai' }, idemKey: key })).queued).toBe(true);
    await flushOutbox({ force: true });
    expect(saved.size).toBe(1);
    expect(await allEntries()).toEqual([]);
  });

  test('401 → kept; the login sheet opens; sent after logging in again', async () => {
    let loggedIn = false;
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: () => (loggedIn ? ok(task({ status: 'done', version: 4 })) : fail(401, { code: 'session_ended', message: 'Please log in again.' })) });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    await flushOutbox({ force: true });
    expect((await allEntries())).toHaveLength(1);
    expect(getLoginRequest()).not.toBeNull();
    loggedIn = true;
    finishLoginRequest(true);
    await vi.waitFor(async () => expect(await allEntries()).toEqual([]));
    expect(writes(f)).toHaveLength(2);
  });

  test('while the person waits on a form, 401 goes to the form (login sheet, then the same key again)', async () => {
    fakeApi({ [`PATCH /tasks/${T1}`]: () => fail(401, { code: 'session_ended', message: 'Please log in again.' }) });
    await expect(saveViaOutbox('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3, idemKey: 'k-401' })).rejects.toBeInstanceOf(AuthError);
    expect((await allEntries()).map((e) => e.key)).toEqual(['k-401']);
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3, idemKey: 'k-401' }); // Try again: no second entry
    expect(await allEntries()).toHaveLength(1);
  });
});

describe('Only small, single-record saves can wait', () => {
  test('deletes, money, bulk, events, uploads are not queueable; enqueue refuses them', async () => {
    for (const [m, p] of [['DELETE', `/tasks/${T1}`], ['POST', '/payments'], ['POST', '/households/bulk'], ['PATCH', '/events/x'], ['POST', '/documents'], ['POST', `/tasks/${T1}/restore`], ['PUT', '/households/h/invitations/e']]) {
      expect(isQueueable(m, p)).toBe(false);
      await expect(enqueue(m, p, { body: {} })).rejects.toThrow(/Needs internet/);
    }
    for (const [m, p] of [['POST', '/tasks'], ['PATCH', `/tasks/${T1}`], ['POST', `/tasks/${T1}/done`], ['POST', `/tasks/${T1}/items`], ['PATCH', `/tasks/${T1}/items/k`], ['POST', '/households'], ['PATCH', '/households/h'], ['PATCH', '/households/h/invitations/e']]) {
      expect(isQueueable(m, p)).toBe(true);
    }
  });

  test('a non-queueable save through saveViaOutbox is a plain online call (nothing stored)', async () => {
    const f = fakeApi({ [`DELETE /tasks/${T1}`]: () => ok({ deleted: true }) });
    await saveViaOutbox('DELETE', `/tasks/${T1}`, { ifMatch: 3 });
    expect(await allEntries()).toEqual([]);
    expect(writes(f)).toHaveLength(1);
  });

  test('Coming? on a family added offline says "Send the new family first."', async () => {
    await expect(saveViaOutbox('PATCH', `/households/${placeholderId('abc')}/invitations/E1`, { body: { rsvp: 'coming' } })).rejects.toThrow(/Send the new family first/);
  });
});

describe('People and app versions', () => {
  test("another person's waiting changes are never sent with this login — kept for them", async () => {
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: noNet });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 }); // Papa's
    signInAs('mummy');
    await ensureUser(PEOPLE.mummy.id); // a different person: the reading copy goes, the outbox stays
    f.mockImplementation(async () => ok(task({ status: 'done' })));
    await flushOutbox({ force: true });
    expect(writes(f)).toHaveLength(0);
    const s = summarise({ entries: await allEntries(), sending: false }, PEOPLE.mummy.id);
    expect(s.others).toEqual([{ name: 'Papa', count: 1 }]);
    expect(s.waiting).toBe(0);
  });

  test('an entry written by an older app (no v, status or entity) is still read and sent', async () => {
    await withDb((d) => d.put('outbox', { key: 'old-1', seq: 1, userId: PEOPLE.papa.id, method: 'POST', path: `/tasks/${T1}/done`, body: {}, ifMatch: 3 }));
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: () => ok(task({ status: 'done' })) });
    await flushOutbox({ force: true });
    expect(writes(f)).toHaveLength(1);
    expect(header(writes(f)[0][1], 'Idempotency-Key')).toBe('old-1');
    expect(await allEntries()).toEqual([]);
  });

  test('logout wipes the outbox too; a different person logging in does not', async () => {
    fakeApi({ [`POST /tasks/${T1}/done`]: noNet });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    await ensureUser(PEOPLE.mummy.id);
    expect(await allEntries()).toHaveLength(1);
    await wipe();
    expect(await allEntries()).toEqual([]);
  });
});

describe('Merging, stand-in ids and order', () => {
  test('two offline edits to the same task, not yet tried → one request with both fields', async () => {
    const f = fakeApi({ [`PATCH /tasks/${T1}`]: (body) => ok(task({ ...body, version: 4 })) });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Tent' }, ifMatch: 3 });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { notes: 'Call at 10' }, ifMatch: 3 });
    expect(await allEntries()).toHaveLength(1);
    await flushOutbox({ force: true });
    expect(writes(f)).toHaveLength(1);
    expect(JSON.parse(writes(f)[0][1].body)).toEqual({ title: 'Tent', notes: 'Call at 10' });
    expect(header(writes(f)[0][1], 'If-Match')).toBe('"3"');
  });

  test('add a task offline, then tick it: the create goes first; the tick uses the real id and version', async () => {
    const f = fakeApi({
      'POST /tasks': (body) => ok(task({ id: T2, version: 1, title: body.title }), 201),
      [`POST /tasks/${T2}/done`]: () => ok(task({ id: T2, version: 2, status: 'done' })),
    });
    const create = await enqueue('POST', '/tasks', { body: { title: 'Halwai' } });
    await enqueue('POST', `/tasks/${placeholderId(create.key)}/done`, { body: {}, ifMatch: 0 });
    await flushOutbox({ force: true });
    expect(writes(f).map(([u]) => String(u).replace('/api/v1', ''))).toEqual(['/tasks', `/tasks/${T2}/done`]);
    expect(header(writes(f)[1][1], 'If-Match')).toBe('"1"');
    expect(await allEntries()).toEqual([]);
  });

  test('an edit to a task added offline (create not yet tried) rides along in the create', async () => {
    const f = fakeApi({ 'POST /tasks': (body) => ok(task({ id: T2, version: 1, ...body }), 201) });
    const create = await enqueue('POST', '/tasks', { body: { title: 'Halwai' } });
    await enqueue('PATCH', `/tasks/${placeholderId(create.key)}`, { body: { notes: 'Ask about Jain food' }, ifMatch: 0 });
    await flushOutbox({ force: true });
    expect(writes(f)).toHaveLength(1);
    expect(JSON.parse(writes(f)[0][1].body)).toEqual({ title: 'Halwai', notes: 'Ask about Jain food' });
  });

  test('chained: the first edit was already tried, so the second waits and takes the new version', async () => {
    let n = 0;
    const f = fakeApi({ [`PATCH /tasks/${T1}`]: () => { n += 1; if (n === 1) throw new TypeError('offline'); return ok(task({ version: 3 + n - 1 })); } });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Tent' }, ifMatch: 3 });
    await flushOutbox({ force: true }); // tried, failed: now attempted
    const second = await enqueue('PATCH', `/tasks/${T1}`, { body: { notes: 'x' }, ifMatch: 3 });
    expect(second.ifMatch).toBe('chain');
    await flushOutbox({ force: true });
    const sent = writes(f).slice(1);
    expect(sent.map(([, i]) => header(i, 'If-Match'))).toEqual(['"3"', '"4"']);
    expect(JSON.parse(sent[0][1].body)).toEqual({ title: 'Tent' }); // the tried body never changed
  });

  test('sent strictly oldest first', async () => {
    const f = fakeApi({ 'POST /tasks': (body) => ok(task({ id: crypto.randomUUID(), title: body.title }), 201) });
    for (const title of ['A', 'B', 'C', 'D', 'E', 'F']) await enqueue('POST', '/tasks', { body: { title } });
    await flushOutbox({ force: true });
    expect(writes(f).map(([, i]) => JSON.parse(i.body).title)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
});

describe('Conflicts, duplicates and Discard', () => {
  const conflict = (current, changed = []) => fail(409, {
    code: 'version_conflict', message: 'Someone else changed this.', current, current_version: current.version, your_version: 3,
    changed_by: { id: 'u', name: 'Mummy' }, changed_at: '2026-10-08T09:10:00Z', changed_fields: changed,
  });

  test('a clash blocks only that task: other changes still go; "Save my choices" sends my pick with a new key and their version', async () => {
    const theirs = task({ version: 5, title: 'Tent (Mummy)' });
    const f = fakeApi({
      [`PATCH /tasks/${T1}`]: (body, init) => (header(init, 'If-Match') === '"5"' ? ok(task({ ...body, version: 6 })) : conflict(theirs, ['title'])),
      [`POST /tasks/${T2}/done`]: () => ok(task({ id: T2, status: 'done' })),
      [`POST /tasks/${T1}/done`]: () => ok(task({ status: 'done', version: 7 })),
    });
    const first = await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Tent (Papa)' }, ifMatch: 3, base: task() });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 }); // waits behind the clash
    await enqueue('POST', `/tasks/${T2}/done`, { body: {}, ifMatch: 1 }); // another task: goes
    await flushOutbox({ force: true });
    let list = await allEntries();
    expect(list.map((e) => [e.path, e.status])).toEqual([[`/tasks/${T1}`, 'conflict'], [`/tasks/${T1}/done`, 'pending']]);
    expect(clashes(list[0], list[0].error.current)).toEqual([{ field: 'title', mine: 'Tent (Papa)', theirs: 'Tent (Mummy)', base: 'Book tent wala' }]);
    await resolveConflict(first.key, { title: 'mine' });
    const resent = writes(f).filter(([u]) => String(u).endsWith(`/tasks/${T1}`)).at(-1)[1];
    expect(header(resent, 'If-Match')).toBe('"5"');
    expect(header(resent, 'Idempotency-Key')).not.toBe(first.key);
    list = await allEntries();
    expect(list).toEqual([]); // the tick behind it went too, with version 6
    expect(header(writes(f).at(-1)[1], 'If-Match')).toBe('"6"');
  });

  test('they changed other fields only → sent again by itself with their version (no question)', async () => {
    const f = fakeApi({ [`PATCH /tasks/${T1}`]: (body, init) => (header(init, 'If-Match') === '"5"' ? ok(task({ ...body, version: 6 })) : conflict(task({ version: 5, notes: 'Mummy note' }), ['notes'])) });
    await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Tent' }, ifMatch: 3, base: task() });
    await flushOutbox({ force: true });
    expect(await allEntries()).toEqual([]);
    expect(writes(f)).toHaveLength(2);
  });

  test('"Keep theirs" (all theirs) and Discard remove the entry; the change is never sent', async () => {
    const f = fakeApi({ [`PATCH /tasks/${T1}`]: () => conflict(task({ version: 5, title: 'Mummy' }), ['title']) });
    const e = await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Papa' }, ifMatch: 3, base: task() });
    await flushOutbox({ force: true });
    await resolveConflict(e.key, { title: 'theirs' });
    expect(await allEntries()).toEqual([]);
    expect(writes(f)).toHaveLength(1);
    const e2 = await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'Again' }, ifMatch: 5 });
    await discardEntry(e2.key);
    expect(await allEntries()).toEqual([]);
  });

  test('a family that looks like a duplicate waits for "Add anyway" (same key: nothing was saved)', async () => {
    let tries = 0;
    const f = fakeApi({ 'POST /households': (body) => { tries += 1; return body.allow_duplicate ? ok({ id: 'H1', version: 1, name: body.name }, 201) : fail(409, { code: 'duplicate_found', message: 'Already on the list?', matches: [{ id: 'H0', name: 'Sharma ji' }] }); } });
    const e = await enqueue('POST', '/households', { body: { name: 'Sharma ji', side: 'groom' } });
    await flushOutbox({ force: true });
    const [d] = await allEntries();
    expect(d.status).toBe('duplicate');
    expect(d.error.matches[0].name).toBe('Sharma ji');
    await addAnyway(e.key);
    expect(await allEntries()).toEqual([]);
    expect(tries).toBe(2);
    expect(header(writes(f)[1][1], 'Idempotency-Key')).toBe(e.key);
  });

  test('a deleted record: kept with the reason until Discard or Try again', async () => {
    let restored = false;
    fakeApi({ [`PATCH /tasks/${T1}`]: () => (restored ? ok(task({ version: 8 })) : fail(409, { code: 'record_deleted', message: 'Deleted.', deleted_by: { name: 'Ayush' }, deleted_at: 'x', can_restore: true })) });
    const e = await enqueue('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3 });
    await flushOutbox({ force: true });
    expect((await allEntries())[0].status).toBe('deleted');
    restored = true;
    await retryEntry(e.key);
    expect(await allEntries()).toEqual([]);
  });

  test('on the open form, a conflict or duplicate is thrown to the form as before (nothing left queued)', async () => {
    fakeApi({ [`PATCH /tasks/${T1}`]: () => conflict(task({ version: 5 })), 'POST /households': () => fail(409, { code: 'duplicate_found', message: 'x', matches: [] }) });
    await expect(saveViaOutbox('PATCH', `/tasks/${T1}`, { body: { title: 'x' }, ifMatch: 3 })).rejects.toBeInstanceOf(ConflictError);
    await expect(saveViaOutbox('POST', '/households', { body: { name: 'x', side: 'groom' } })).rejects.toBeInstanceOf(DuplicateError);
    expect(await allEntries()).toEqual([]);
  });
});

describe('When it sends', () => {
  test('after a failure it waits (15 s back-off) unless forced by Send now / back online', async () => {
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: noNet });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    await flushOutbox({ force: true });
    expect(getOutboxState().nextTryAt - Date.now()).toBeGreaterThan(BACKOFF_FIRST_MS - 1000);
    await flushOutbox(); // the 60 s timer
    expect(writes(f)).toHaveLength(1);
    await flushOutbox({ force: true }); // Send now
    expect(writes(f)).toHaveLength(2);
  });

  test('two flushes at once send each entry once', async () => {
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: async () => { await new Promise((r) => setTimeout(r, 20)); return ok(task({ status: 'done' })); } });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    await Promise.all([flushOutbox({ force: true }), flushOutbox({ force: true }), flushOutbox({ force: true })]);
    expect(writes(f)).toHaveLength(1);
  });

  test('logged out → nothing is sent', async () => {
    const f = fakeApi({ [`POST /tasks/${T1}/done`]: () => ok(task()) });
    await enqueue('POST', `/tasks/${T1}/done`, { body: {}, ifMatch: 3 });
    signOut();
    await flushOutbox({ force: true });
    expect(writes(f)).toHaveLength(0);
  });
});
