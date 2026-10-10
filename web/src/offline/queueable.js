// queueable.js — which saves may wait on the phone (CONTEXT decision 7, PWA.md §5.2).
// Only small, single-record actions. Everything else (deletes, Undo, restore, bulk,
// import, money, events, settings, members, uploads) needs internet.
//
// `entity` names the record a change touches, so two changes to the same record are
// merged or sent one after the other, and a conflict holds back only that record.
// A record added offline has the stand-in id "{new:<key>}" until its create lands.

const ID = '([^/]+)';
const RULES = [
  { method: 'POST', re: /^\/tasks$/, kind: 'create', type: 'tasks' },
  { method: 'PATCH', re: new RegExp(`^/tasks/${ID}$`), kind: 'update', type: 'tasks', entity: (m) => `/tasks/${m[1]}` },
  { method: 'POST', re: new RegExp(`^/tasks/${ID}/done$`), kind: 'action', type: 'tasks', entity: (m) => `/tasks/${m[1]}` },
  { method: 'POST', re: new RegExp(`^/tasks/${ID}/items$`), kind: 'create', type: 'task_items', parent: (m) => `/tasks/${m[1]}` },
  { method: 'PATCH', re: new RegExp(`^/tasks/${ID}/items/${ID}$`), kind: 'update', type: 'task_items', entity: (m) => `/tasks/${m[1]}/items/${m[2]}` },
  { method: 'POST', re: /^\/households$/, kind: 'create', type: 'households' },
  { method: 'PATCH', re: new RegExp(`^/households/${ID}$`), kind: 'update', type: 'households', entity: (m) => `/households/${m[1]}` },
  { method: 'PATCH', re: new RegExp(`^/households/${ID}/invitations/${ID}$`), kind: 'update', type: 'invitations', entity: (m) => `/households/${m[1]}/invitations/${m[2]}` },
];

/** The rule for this save, or null when it needs internet. */
export function ruleFor(method, path) {
  const m = String(method).toUpperCase();
  for (const r of RULES) {
    const match = r.method === m ? path.match(r.re) : null;
    if (match) return { ...r, match };
  }
  return null;
}

export const isQueueable = (method, path) => ruleFor(method, path) !== null;

/** The stand-in id for a record added offline, and the test for one. */
export const placeholderId = (key) => `{new:${key}}`;
export const isPlaceholder = (id) => /^\{new:[^}]+\}$/.test(String(id ?? ''));
export const hasPlaceholder = (path) => /\{new:[^}]+\}/.test(String(path ?? ''));

/**
 * Which record the change touches. Creates name their own new record; a checklist item
 * added to a task waits behind that task (so "add task offline, then add an item" works).
 */
export function entityFor(rule, key) {
  if (rule.entity) return rule.entity(rule.match);
  if (rule.type === 'tasks') return `/tasks/${placeholderId(key)}`;
  if (rule.type === 'households') return `/households/${placeholderId(key)}`;
  if (rule.type === 'task_items') return `${rule.parent(rule.match)}/items/${key}`;
  return null;
}

/** A Coming? chip on a family that was added offline: its invitation doesn't exist yet. */
export function blockedReason(method, path) {
  const r = ruleFor(method, path);
  if (r && r.type === 'invitations' && isPlaceholder(r.match[1])) return 'sendFamilyFirst';
  return null;
}
