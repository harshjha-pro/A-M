// One edit form on the shared rules (FEATURES A3 + A4, IMPLEMENTATION §3.5):
//   - only changed fields are sent, with If-Match;
//   - a local draft 1 s after each change, offered back with "Use them / Discard";
//   - 409 → 3-way merge: nothing clashing → saved again automatically (AC-CON-01),
//     otherwise the conflict screen; another 409 repeats it;
//   - 409 record_deleted → the deleted message, draft kept (AC-CON-04).
//
// Values are in "form shape" (strings for inputs). The screen gives:
//   fromServer(record) → values      toBody(keys, values) → body | { errors }
//   send(body, version, idemKey) → Promise<record>
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConflictError, DeletedError, ValidationError } from '../api/errors.js';
import { useSession } from '../api/session.js';
import { useSave } from './useSave.js';
import { draftKey, saveDraft, loadDraft, clearDraft } from './drafts.js';
import { merge3, applyChoices, changedKeys } from './merge3.js';
import { formatTime } from '../format/ist.js';
import { useDirtyForm } from '../pwa/dirtyForms.js';

export const DRAFT_DELAY_MS = 1000;

export function useEntityForm({ form, recordId = null, record, fields, neverAuto = [], fromServer, toBody, send, onSaved, mapError, initial = null }) {
  const { user } = useSession();
  const key = useMemo(() => draftKey(user?.id ?? 'anon', form, recordId), [user?.id, form, recordId]);
  const save = useSave();
  const [values, setValues] = useState(null);       // null = not editing
  const [base, setBase] = useState(null);           // values the edit started from
  const [version, setVersion] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [conflict, setConflict] = useState(null);
  const [deleted, setDeleted] = useState(null);
  // Unsaved typing blocks the "new version" refresh (PWA.md §6.2).
  useDirtyForm(key, values !== null && base !== null && changedKeys(fields, base, values).length > 0);
  const [draft, setDraft] = useState(() => loadDraft(key));
  const timer = useRef(null);

  // Draft 1 s after the last change.
  useEffect(() => {
    if (values === null) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(key, { values, baseVersion: version, base }), DRAFT_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [key, values, version, base]);

  // Leaving the screen within that second (e.g. "Open that family") still keeps the typing.
  const latest = useRef(null);
  latest.current = { key, values, version, base };
  useEffect(() => () => {
    const l = latest.current;
    if (l.values !== null && changedKeys(fields, l.base, l.values).length > 0) saveDraft(l.key, { values: l.values, baseVersion: l.version, base: l.base });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function begin(v, b, ver) {
    save.reset();
    setFieldErrors({});
    setConflict(null);
    setDeleted(null);
    setValues(v);
    setBase(b);
    setVersion(ver);
  }

  /** initial: values a new form starts with that still count as typed (e.g. the event a task is added from). */
  function start() {
    const v = fromServer(record);
    begin(initial ? { ...v, ...initial } : v, v, record.version);
  }

  function useDraft() {
    begin(draft.values, draft.base ?? fromServer(record), draft.baseVersion ?? record.version);
    setDraft(null);
  }

  function discardDraft() {
    clearDraft(key);
    setDraft(null);
  }

  function stop() {
    clearTimeout(timer.current);
    setValues(null);
    setConflict(null);
    setFieldErrors({});
  }

  /** Cancel = Discard (the draft goes too). */
  function cancel() {
    clearDraft(key);
    stop();
  }

  const set = (k) => (v) => setValues((cur) => ({ ...cur, [k]: v }));

  async function push(next, from, ver) {
    const keys = changedKeys(fields, from, next);
    if (keys.length === 0) { clearDraft(key); stop(); return null; }
    const body = toBody(keys, next);
    if (body?.errors) { setFieldErrors(body.errors); return null; }
    try {
      const saved = await save.run((idemKey) => send(body, ver, idemKey));
      clearDraft(key);
      stop();
      onSaved?.(saved);
      return saved;
    } catch (err) {
      const mapped = mapError?.(err);
      if (mapped) {
        setFieldErrors(mapped);
      } else if (err instanceof ValidationError) {
        setFieldErrors(err.fields);
      } else if (err instanceof DeletedError) {
        saveDraft(key, { values: next, baseVersion: ver, base: from });
        setDeleted(err);
      } else if (err instanceof ConflictError && err.current) {
        save.renew();
        const theirs = fromServer(err.current);
        const m = merge3({ base: from, mine: next, theirs, fields, neverAuto });
        setBase(theirs);
        setVersion(err.currentVersion);
        setValues(next);
        if (m.conflicts.length === 0) {
          save.reset();
          return push(m.merged, theirs, err.currentVersion); // AC-CON-01
        }
        setConflict({
          who: err.changedBy?.name ?? null,
          at: err.changedAt ? formatTime(err.changedAt) : null,
          conflicts: m.conflicts,
          auto: m.auto,
          merged: m.merged,
          mine: next,
          theirs,
          theirsRecord: err.current,
          version: err.currentVersion,
        });
        save.reset();
      }
      return null;
    }
  }

  function submit(e) {
    e?.preventDefault?.();
    setFieldErrors({});
    return push(values, base, version);
  }

  /** "Save my choices" */
  function resolve(choices) {
    const c = conflict;
    const final = applyChoices(c.merged, c.mine, choices);
    setConflict(null);
    setValues(final);
    return push(final, c.theirs, c.version);
  }

  /** "Keep theirs" — my clashing edits are dropped, nothing is sent. */
  function keepTheirs() {
    const c = conflict;
    clearDraft(key);
    stop();
    onSaved?.({ ...record, ...c.theirsRecord, version: c.version });
  }

  return {
    editing: values !== null,
    values, set, fieldErrors, setFieldErrors,
    start, cancel, submit, resolve, keepTheirs,
    conflict, deleted,
    draft, useDraft, discardDraft, draftTime: draft ? formatTime(new Date(draft.savedAt)) : null,
    save,
  };
}
