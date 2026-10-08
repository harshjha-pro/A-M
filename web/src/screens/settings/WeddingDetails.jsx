// Wedding details (FEATURES B10). Everyone reads; admins edit. Only changed
// fields are sent, with If-Match (API.md §4). A clash shows who changed it;
// the full side-by-side conflict screen arrives in Session 3.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import { api } from '../../api/client.js';
import { ConflictError, ValidationError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useSave } from '../../forms/useSave.js';
import { formatDateOnly } from '../../format/ist.js';
import { formatInr, parseInrInput } from '../../format/inr.js';
import { t } from '../../i18n/strings.en.js';

const TEXT = ['brideName', 'groomName', 'brideSideLabel', 'groomSideLabel', 'city'];
const LABEL = { brideName: 'wedding.brideName', groomName: 'wedding.groomName', brideSideLabel: 'wedding.brideSide', groomSideLabel: 'wedding.groomSide', city: 'wedding.city' };

function toForm(s) {
  return {
    ...Object.fromEntries(TEXT.map((k) => [k, s[k] ?? ''])),
    weddingStartDate: s.weddingStartDate, weddingEndDate: s.weddingEndDate,
    budget: s.totalBudgetPaise == null ? '' : String(s.totalBudgetPaise / 100),
  };
}

export default function WeddingDetails() {
  const { permissions } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api('GET', '/settings').then((r) => r.data) });
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState({});
  const [conflict, setConflict] = useState(null);
  const save = useSave();
  const s = q.data;

  if (q.isPending) return <Screen title={t('wedding.title')} back="/settings"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('wedding.title')} back="/settings"><Notice kind="danger">{t('errors.loadFailed')}</Notice></Screen>;

  const editing = form !== null;
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  async function submit(e) {
    e.preventDefault();
    setFields({});
    setConflict(null);
    const before = toForm(s);
    const body = {};
    for (const k of [...TEXT, 'weddingStartDate', 'weddingEndDate']) if (form[k] !== before[k]) body[k] = form[k];
    if (permissions?.money && form.budget !== before.budget) {
      const paise = form.budget.trim() === '' ? null : parseInrInput(form.budget);
      if (paise === undefined || (paise === null && form.budget.trim() !== '')) {
        setFields({ totalBudgetPaise: t('wedding.budgetHelp') });
        return;
      }
      body.totalBudgetPaise = paise;
    }
    if (Object.keys(body).length === 0) { setForm(null); return; }
    try {
      const res = await save.run((idemKey) => api('PATCH', '/settings', { body, ifMatch: s.version, idemKey }));
      qc.setQueryData(['settings'], res.data);
      setForm(null);
    } catch (err) {
      if (err instanceof ValidationError) setFields(err.fields);
      else if (err instanceof ConflictError) setConflict(err);
    }
  }

  return (
    <Screen title={t('wedding.title')} back="/settings">
      <SavedIndicator {...save} />
      {!editing && (
        <>
          <dl className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
            {TEXT.map((k) => (
              <div key={k}><dt className="text-sm text-text-muted">{t(LABEL[k])}</dt><dd className="text-lg">{s[k]}</dd></div>
            ))}
            <div><dt className="text-sm text-text-muted">{t('wedding.start')}</dt><dd className="text-lg">{formatDateOnly(s.weddingStartDate)}</dd></div>
            <div><dt className="text-sm text-text-muted">{t('wedding.end')}</dt><dd className="text-lg">{formatDateOnly(s.weddingEndDate)}</dd></div>
            {permissions?.money && (
              <div><dt className="text-sm text-text-muted">{t('wedding.budget')}</dt><dd className="text-lg">{s.totalBudgetPaise == null ? t('wedding.noBudget') : formatInr(s.totalBudgetPaise)}</dd></div>
            )}
          </dl>
          {permissions?.admin ? <Button onClick={() => { save.reset(); setForm(toForm(s)); }}>{t('wedding.edit')}</Button> : <p className="text-text-muted">{t('wedding.readOnly')}</p>}
        </>
      )}
      {editing && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FixSummary fields={fields} />
          {conflict && (
            <Notice kind="warning">
              {t('wedding.conflict', { name: conflict.changedBy?.name ?? '—' })}{' '}
              <button type="button" className="tap font-bold text-primary underline" onClick={() => { qc.setQueryData(['settings'], conflict.current); setForm(toForm({ ...s, ...conflict.current })); setConflict(null); }}>
                {t('wedding.reload')}
              </button>
            </Notice>
          )}
          {TEXT.map((k) => <TextField key={k} label={t(LABEL[k])} value={form[k]} onChange={set(k)} error={fields[k]} />)}
          <TextField type="date" label={t('wedding.start')} value={form.weddingStartDate} onChange={set('weddingStartDate')} error={fields.weddingStartDate} />
          <TextField type="date" label={t('wedding.end')} value={form.weddingEndDate} onChange={set('weddingEndDate')} error={fields.weddingEndDate} />
          {permissions?.money && (
            <TextField label={t('wedding.budget')} help={t('wedding.budgetHelp')} inputMode="decimal" value={form.budget} onChange={set('budget')} error={fields.totalBudgetPaise} />
          )}
          <Button type="submit" loading={save.status === 'saving'}>{t('wedding.save')}</Button>
          <Button variant="secondary" onClick={() => { setForm(null); setFields({}); setConflict(null); }}>{t('login.cancel')}</Button>
        </form>
      )}
    </Screen>
  );
}
