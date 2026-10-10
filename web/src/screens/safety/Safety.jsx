// Safety (FEATURES B10): health checks, nightly backups, and the monthly
// restore-drill log. Admins only. Deleting a drill offers Undo for 8 s.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, TriangleAlert, CircleAlert, CircleMinus, History, Trash2 } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { TextField, ChoiceChips, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { useSave } from '../../forms/useSave.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatDateTime, formatDateOnly, todayIst } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const ICON = { green: CircleCheck, amber: TriangleAlert, red: CircleAlert, not_in_use: CircleMinus };
const TONE = { green: 'text-success', amber: 'text-warning', red: 'text-danger', not_in_use: 'text-text-muted' };

function StatusLine({ name, status, children }) {
  const Icon = ICON[status] ?? CircleMinus;
  return (
    <li className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
      <Icon aria-hidden="true" size={22} className={`mt-0.5 shrink-0 ${TONE[status] ?? ''}`} />
      <div className="flex flex-col">
        <span className="font-bold">{name}: {t(`safety.status.${status}`)}</span>
        {children && <span className="text-sm text-text-muted">{children}</span>}
      </div>
    </li>
  );
}

function BackupCard({ health }) {
  const b = useQuery({ queryKey: ['backups'], queryFn: () => api('GET', '/backups', { query: { limit: 7 } }).then((r) => r.data) });
  const check = health?.checks?.backup;
  let note = null;
  if (check?.status === 'not_in_use') note = t('safety.backupNotInUse');
  else if (check?.status === 'red') note = check.lastOkAt ? t('safety.backupOld') : t('safety.noBackup');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{t('safety.backups')}</h2>
      {check && <Notice kind={check.status === 'red' ? 'danger' : check.status === 'green' ? 'success' : 'info'}>
        {check.lastOkAt ? t('safety.lastOk', { when: formatDateTime(check.lastOkAt) }) : t('safety.noBackup')}{note ? ` ${note}` : ''}
      </Notice>}
      {b.data?.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {b.data.map((r, i) => (
            <StatusLine key={i} name={formatDateTime(r.startedAt)} status={r.status === 'ok' ? 'green' : r.status === 'failed' ? 'red' : 'amber'}>
              {r.status === 'failed' ? t('safety.failed', { error: r.error ?? '—' }) : r.fileName}
            </StatusLine>
          ))}
        </ul>
      )}
    </section>
  );
}

function DrillForm({ onDone }) {
  const [f, setF] = useState({ doneOn: todayIst(), result: 'passed', backupFile: '', notes: '' });
  const [fields, setFields] = useState({});
  const save = useSave();
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function submit(e) {
    e.preventDefault();
    setFields({});
    try {
      await save.run((idemKey) => api('POST', '/restore-drills', { body: { ...f, backupFile: f.backupFile || null, notes: f.notes || null }, idemKey }));
      setF({ doneOn: todayIst(), result: 'passed', backupFile: '', notes: '' });
      onDone();
    } catch (err) {
      if (err instanceof ValidationError) setFields(err.fields);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card" noValidate>
      <h3 className="font-bold">{t('safety.logDrill')}</h3>
      <FixSummary fields={fields} />
      <TextField type="date" label={t('safety.doneOn')} value={f.doneOn} onChange={set('doneOn')} error={fields.doneOn} max={todayIst()} />
      <ChoiceChips label={t('safety.result')} options={[{ value: 'passed', label: t('safety.passed') }, { value: 'failed', label: t('safety.failedResult') }]} value={f.result} onChange={set('result')} error={fields.result} />
      <TextField label={t('safety.file')} value={f.backupFile} onChange={set('backupFile')} error={fields.backupFile} maxLength={120} />
      <TextField label={t('safety.notes')} value={f.notes} onChange={set('notes')} error={fields.notes} />
      <SavedIndicator {...save} />
      <Button type="submit" loading={save.status === 'saving'}>{t('safety.save')}</Button>
    </form>
  );
}

export default function Safety() {
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ['health-admin'], queryFn: () => api('GET', '/health').then((r) => r.data).catch((e) => ({ status: 'red', error: e.message })) });
  const drills = useQuery({ queryKey: ['restore-drills'], queryFn: () => api('GET', '/restore-drills').then((r) => r.data) });
  const h = health.data;

  async function remove(d) {
    try {
      const res = await withRelogin(() => api('DELETE', `/restore-drills/${d.id}`, { ifMatch: d.version, idemKey: newIdemKey() }));
      await qc.invalidateQueries({ queryKey: ['restore-drills'] });
      qc.invalidateQueries({ queryKey: ['health-admin'] });
      const u = res.meta.undo;
      if (u) showUndo({ batchId: u.batchId, summary: u.summary });
    } catch (e) {
      showToast(e.message || t('errors.server'));
    }
  }

  return (
    <Screen title={t('safety.title')} back="/settings">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('safety.checks')}</h2>
        {health.isPending && <p aria-busy="true">…</p>}
        {h?.checks && (
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {['database', 'backup', 'audit_log', 'restore_drill', 'storage', 'reminders'].filter((k) => h.checks[k]).map((k) => (
              <StatusLine key={k} name={t(`safety.check.${k}`)} status={h.checks[k].status}>
                {k === 'storage' && h.checks.storage.usedPct != null ? `${h.checks.storage.usedPct}%` : null}
                {k === 'restore_drill' && h.checks.restore_drill.lastPassedOn ? formatDateOnly(h.checks.restore_drill.lastPassedOn) : null}
              </StatusLine>
            ))}
          </ul>
        )}
        {h?.error && <Notice kind="danger">{h.error}</Notice>}
      </section>

      <BackupCard health={h} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t('safety.drills')}</h2>
        <p className="text-text-muted">{t('safety.drillsHelp')}</p>
        {drills.data?.length === 0 && <p>{t('safety.noDrills')}</p>}
        {drills.data?.length > 0 && (
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {drills.data.map((d) => (
              <li key={d.id} className="flex items-center gap-2 border-b border-border p-4 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{formatDateOnly(d.doneOn)}</span>
                  <span className="text-sm text-text-muted">{t('safety.by', { result: d.result === 'passed' ? t('safety.passed') : t('safety.failedResult'), name: d.doneBy?.name ?? '—' })}</span>
                  {d.notes && <span className="break-words text-sm">{d.notes}</span>}
                </div>
                <Link to={`/history/restore-drills/${d.id}`} className="tap flex items-center justify-center px-2 text-primary" aria-label={`${t('history.title')}: ${formatDateOnly(d.doneOn)}`}>
                  <History aria-hidden="true" size={22} />
                </Link>
                <button type="button" onClick={() => remove(d)} className="tap flex items-center justify-center px-2 text-danger" aria-label={`${t('safety.delete')}: ${formatDateOnly(d.doneOn)}`}>
                  <Trash2 aria-hidden="true" size={22} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <DrillForm onDone={() => { qc.invalidateQueries({ queryKey: ['restore-drills'] }); qc.invalidateQueries({ queryKey: ['health-admin'] }); }} />
      </section>
    </Screen>
  );
}
