// Wedding details (FEATURES B10). Everyone reads; admins edit. Built on the
// shared form rules: changed fields only + If-Match, a draft on this phone, and
// the conflict screen when two people edit at once (FEATURES A3, A4).
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { TextField, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import { formatDateOnly } from '../../format/ist.js';
import { formatInr, parseInrInput } from '../../format/inr.js';
import { t } from '../../i18n/strings.en.js';

const TEXT = ['brideName', 'groomName', 'brideSideLabel', 'groomSideLabel', 'city'];
const LABEL = { brideName: 'wedding.brideName', groomName: 'wedding.groomName', brideSideLabel: 'wedding.brideSide', groomSideLabel: 'wedding.groomSide', city: 'wedding.city', weddingStartDate: 'wedding.start', weddingEndDate: 'wedding.end', budget: 'wedding.budget' };
const FIELDS = [...TEXT, 'weddingStartDate', 'weddingEndDate', 'budget'];
const LABELS = Object.fromEntries(FIELDS.map((f) => [f, t(LABEL[f])]));

function toForm(s) {
  return {
    ...Object.fromEntries(TEXT.map((k) => [k, s[k] ?? ''])),
    weddingStartDate: s.weddingStartDate ?? '', weddingEndDate: s.weddingEndDate ?? '',
    budget: s.totalBudgetPaise == null ? '' : String(s.totalBudgetPaise / 100),
  };
}

function show(field, value) {
  if (field === 'budget') { const p = parseInrInput(value); return p == null ? value : formatInr(p); }
  if (field === 'weddingStartDate' || field === 'weddingEndDate') return formatDateOnly(value);
  return value;
}

export default function WeddingDetails() {
  const { permissions } = useSession();
  const money = Boolean(permissions?.money);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api('GET', '/settings').then((r) => r.data) });
  const s = q.data;

  const f = useEntityForm({
    form: 'settings',
    record: s,
    fields: money ? FIELDS : FIELDS.filter((k) => k !== 'budget'),
    neverAuto: ['budget'],
    fromServer: toForm,
    toBody(keys, v) {
      const body = {};
      for (const k of keys) {
        if (k !== 'budget') { body[k] = v[k]; continue; }
        const paise = v.budget.trim() === '' ? null : parseInrInput(v.budget);
        if (paise === undefined || (paise === null && v.budget.trim() !== '')) return { errors: { totalBudgetPaise: t('wedding.budgetHelp') } };
        body.totalBudgetPaise = paise;
      }
      return body;
    },
    send: (body, version, idemKey) => api('PATCH', '/settings', { body, ifMatch: version, idemKey }).then((r) => r.data),
    onSaved: (saved) => { if (saved) qc.setQueryData(['settings'], saved); else qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  if (q.isPending) return <Screen title={t('wedding.title')} back="/settings"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('wedding.title')} back="/settings"><Notice kind="danger">{t('errors.loadFailed')}</Notice></Screen>;

  if (f.conflict) {
    return (
      <ConflictScreen
        conflict={f.conflict} labels={LABELS} format={show} saving={f.save.status === 'saving'}
        onSave={f.resolve} onKeepTheirs={f.keepTheirs}
      />
    );
  }

  const v = f.values;
  return (
    <Screen title={t('wedding.title')} back="/settings">
      <SavedIndicator {...f.save} />
      {!f.editing && (
        <>
          {permissions?.admin && f.draft && <DraftBanner time={f.draftTime} onUse={f.useDraft} onDiscard={f.discardDraft} />}
          <dl className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
            {TEXT.map((k) => (
              <div key={k}><dt className="text-sm text-text-muted">{t(LABEL[k])}</dt><dd className="text-lg">{s[k]}</dd></div>
            ))}
            <div><dt className="text-sm text-text-muted">{t('wedding.start')}</dt><dd className="text-lg">{formatDateOnly(s.weddingStartDate)}</dd></div>
            <div><dt className="text-sm text-text-muted">{t('wedding.end')}</dt><dd className="text-lg">{formatDateOnly(s.weddingEndDate)}</dd></div>
            {money && (
              <div><dt className="text-sm text-text-muted">{t('wedding.budget')}</dt><dd className="text-lg">{s.totalBudgetPaise == null ? t('wedding.noBudget') : formatInr(s.totalBudgetPaise)}</dd></div>
            )}
          </dl>
          {permissions?.admin ? (
            <>
              <Button onClick={f.start}>{t('wedding.edit')}</Button>
              <Link to="/settings/wedding/history" className="tap flex items-center justify-center gap-2 font-bold text-primary">
                <History aria-hidden="true" size={20} /> {t('history.see')}
              </Link>
            </>
          ) : <p className="text-text-muted">{t('wedding.readOnly')}</p>}
        </>
      )}
      {f.editing && (
        <form onSubmit={f.submit} className="flex flex-col gap-4" noValidate>
          <FixSummary fields={f.fieldErrors} />
          {f.deleted && <Notice kind="warning">{f.deleted.message}</Notice>}
          {TEXT.map((k) => <TextField key={k} label={t(LABEL[k])} value={v[k]} onChange={f.set(k)} error={f.fieldErrors[k]} />)}
          <TextField type="date" label={t('wedding.start')} value={v.weddingStartDate} onChange={f.set('weddingStartDate')} error={f.fieldErrors.weddingStartDate} />
          <TextField type="date" label={t('wedding.end')} value={v.weddingEndDate} onChange={f.set('weddingEndDate')} error={f.fieldErrors.weddingEndDate} />
          {money && (
            <TextField label={t('wedding.budget')} help={t('wedding.budgetHelp')} inputMode="decimal" value={v.budget} onChange={f.set('budget')} error={f.fieldErrors.totalBudgetPaise} />
          )}
          <Button type="submit" loading={f.save.status === 'saving'}>{t('wedding.save')}</Button>
          <Button variant="secondary" onClick={f.cancel}>{t('login.cancel')}</Button>
        </form>
      )}
    </Screen>
  );
}
