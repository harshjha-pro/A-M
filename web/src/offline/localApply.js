// localApply.js — a change waiting in the outbox shows on this phone's copy at once, so the
// lists and pages read with no internet include it (marked 🕒 Waiting to send). When it lands
// the server's row replaces ours; when it's discarded the server's last known row comes back.
// Only the phone's copy is touched here — never the server, never "Saved".
import { getRecord, getRecords, putRecords, deleteRecords } from './cache.js';
import { placeholderId } from './queueable.js';

/** assigneeIds → assignees [{id, name}], eventId → event {id, name}, using what's on the phone. */
async function expand(body) {
  const out = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (k === 'allowDuplicate' || k === 'newTags' || k === 'inviteEventIds') continue;
    if (k === 'assigneeIds') {
      const people = await getRecords('members');
      out.assignees = (v ?? []).map((id) => ({ id, name: people.find((p) => p.id === id)?.name ?? '' }));
    } else if (k === 'tagIds') {
      const tags = await getRecords('tags');
      out.tags = (v ?? []).map((id) => ({ id, name: tags.find((g) => g.id === id)?.name ?? '' }));
    } else if (k === 'eventId') {
      out.event = v ? { id: v, name: (await getRecord('events', v))?.name ?? '' } : null;
    } else if (k === 'vendorId') {
      out.vendor = v ? { id: v, name: (await getRecord('vendors', v))?.name ?? '' } : null;
    } else if (k === 'householdId') {
      out.household = v ? { id: v, name: (await getRecord('households', v))?.name ?? '' } : null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const withPeople = (h) => ({ ...h, people: (Number(h.adults) || 0) + (Number(h.children) || 0) });

/** The row this change makes on the phone (also handed back to the screen as `data`). */
export async function applyLocally(e, user) {
  const parts = e.path.split('/').filter(Boolean);
  const fields = await expand(e.body);
  const now = new Date().toISOString();
  const me = user ? { id: user.id, name: user.name } : null;

  if (e.type === 'tasks') {
    if (e.kind === 'create') {
      const row = {
        id: placeholderId(e.key), version: 0, status: 'todo', priority: 'normal', dueDate: null, dueTime: null, notes: null,
        assignees: [], tags: [], items: [], event: null, vendor: null, household: null, postponeCount: 0,
        createdAt: now, createdBy: me, updatedAt: now, ...fields, waiting: true,
      };
      row.items = (e.body.items ?? []).map((i) => ({ key: i.key, text: i.text, isDone: Boolean(i.isDone), version: 0 }));
      await putRecords('tasks', [row]);
      return row;
    }
    const task = await getRecord('tasks', parts[1]);
    if (!task) return null;
    const next = e.kind === 'action'
      ? { ...task, status: 'done', completedBy: me, completedAt: now, waiting: true }
      : { ...task, ...fields, waiting: true };
    await putRecords('tasks', [next]);
    return next;
  }

  if (e.type === 'task_items') {
    const task = await getRecord('tasks', parts[1]);
    if (!task) return null;
    let item;
    const items = [...(task.items ?? [])];
    if (e.kind === 'create') {
      item = { key: e.body.key ?? e.key, text: e.body.text, isDone: false, version: 0, waiting: true };
      items.push(item);
    } else {
      const i = items.findIndex((x) => x.key === parts[3]);
      if (i < 0) return null;
      item = { ...items[i], ...fields, waiting: true };
      items[i] = item;
    }
    await putRecords('tasks', [{ ...task, items }]);
    return item;
  }

  if (e.type === 'households') {
    if (e.kind === 'create') {
      const row = withPeople({
        id: placeholderId(e.key), version: 0, phone: null, altPhone: null, groupName: null, relation: null, area: null, city: null,
        address: null, adults: 1, children: 0, food: 'veg', jainCount: 0, isVip: false, notes: null, possibleDuplicate: false,
        invitations: [], createdAt: now, createdBy: me, updatedAt: now, ...fields, waiting: true,
      });
      await putRecords('households', [row]);
      return row;
    }
    const h = await getRecord('households', parts[1]);
    if (!h) return null;
    const next = withPeople({ ...h, ...fields, waiting: true });
    await putRecords('households', [next]);
    return next;
  }

  if (e.type === 'invitations') {
    const h = await getRecord('households', parts[1]);
    if (!h) return null;
    let inv = null;
    const invitations = (h.invitations ?? []).map((x) => {
      if (x.event?.id !== parts[3]) return x;
      inv = { ...x, ...fields, waiting: true };
      if ('expectedAdults' in fields || 'expectedChildren' in fields || 'rsvp' in fields) {
        inv.people = (inv.expectedAdults ?? h.adults ?? 0) + (inv.expectedChildren ?? h.children ?? 0);
      }
      return inv;
    });
    await putRecords('households', [{ ...h, invitations }]);
    return inv;
  }
  return null;
}

/** It landed: the server's row replaces ours (a record added offline swaps its stand-in id). */
export async function landLocally(e, data) {
  if (!data || typeof data !== 'object') return;
  const parts = e.path.split('/').filter(Boolean);
  if ((e.type === 'tasks' || e.type === 'households') && data.id) {
    if (e.kind === 'create') await deleteRecords([[e.type, placeholderId(e.key)]]);
    await putRecords(e.type, [data]);
    return;
  }
  if (e.type === 'task_items') {
    const task = await getRecord('tasks', parts[1]);
    if (!task) return;
    const items = [...(task.items ?? [])];
    const i = items.findIndex((x) => x.key === data.key);
    if (i < 0) items.push(data); else items[i] = data;
    await putRecords('tasks', [{ ...task, items }]);
    return;
  }
  if (e.type === 'invitations') {
    const h = await getRecord('households', parts[1]);
    if (!h) return;
    await putRecords('households', [{ ...h, invitations: (h.invitations ?? []).map((x) => (x.event?.id === parts[3] ? { ...x, ...data } : x)) }]);
  }
}

/** Discarded: our stand-in goes; the server's last known row (from the conflict) comes back. */
export async function revertLocally(e) {
  if (e.kind === 'create' && (e.type === 'tasks' || e.type === 'households')) {
    await deleteRecords([[e.type, placeholderId(e.key)]]);
    return;
  }
  const current = e.error?.current;
  if (current && (e.type === 'tasks' || e.type === 'households') && current.id) await putRecords(e.type, [current]);
  else if (current) await landLocally(e, current);
}
