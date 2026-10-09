// Import a list (FEATURES A8; Ayush and Mahi): Excel, CSV, pasted text or a contacts
// file is read on this phone → defaults (side, invite everyone to, city) → columns →
// preview with counts, problems and duplicates (Skip / Add anyway / Fill in) → one
// import with an Undo. Nothing is saved before "Import".
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ChipFilter, { MultiChips } from '../../components/ChipFilter.jsx';
import { ChoiceChips, Notice, TextField } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatCount } from '../../format/inr.js';
import { formatPhone } from '../../format/phone.js';
import { FIELDS, mapHeaders, findHeader, rowsFromTable, parseCsv, parsePaste, parseVcf, readXlsx } from '../../data/importParse.js';
import { SIDES } from '../../data/guests.js';
import { useGuestEvents } from './GuestList.jsx';
import { t } from '../../i18n/strings.en.js';

const MAX_ROWS = 3000;
const PAGE = 100;

/** File → text with FileReader (works on every phone browser). */
function fileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Read a chosen file into either a table (needs column mapping) or ready rows. */
async function readFile(file) {
  const name = file.name || 'file';
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'vcf' || /vcard/.test(file.type)) return { source: 'vcf', rows: parseVcf(await fileText(file)) };
  if (ext === 'csv' || ext === 'txt' || /csv/.test(file.type)) return { source: 'csv', table: parseCsv(await fileText(file)) };
  return { source: 'xlsx', table: await readXlsx(file) };
}

export default function ImportScreen() {
  const { settingsBrief } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const events = useGuestEvents();
  const evs = events.data ?? [];
  const [step, setStep] = useState('source'); // source → setup → preview
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState(null); // {name, source, table?, rows?}
  const [mapping, setMapping] = useState([]);
  const [defaults, setDefaults] = useState({ side: '', eventIds: [], city: settingsBrief?.city ?? '' });
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({}); // row_no → {decision, target}
  const [edits, setEdits] = useState({}); // row_no → {name, phone} typed fixes
  const [show, setShow] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const header = file?.table ? findHeader(file.table, evs) : -1;
  const rows = useMemo(() => {
    if (!file) return [];
    const base = file.rows ?? (header >= 0 ? rowsFromTable(file.table, mapping, header) : []);
    return base.map((r) => ({ ...r, ...(edits[r.row_no] ?? {}) }));
  }, [file, mapping, header, edits]);

  function begin(f) {
    setProblem(null);
    setPreview(null);
    setDecisions({});
    setEdits({});
    if (f.table) {
      const h = findHeader(f.table, evs);
      if (h < 0) { setProblem(t('import.noName')); return; }
      setMapping(mapHeaders(f.table[h], evs));
    }
    const count = f.rows ? f.rows.length : f.table.length - findHeader(f.table, evs) - 1;
    if (count <= 0) { setProblem(t('import.noRows')); return; }
    if (count > MAX_ROWS) { setProblem(t('import.tooMany')); return; }
    setFile(f);
    setStep('setup');
  }

  async function onFile(e) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setBusy(true);
    try {
      begin({ name: chosen.name, ...(await readFile(chosen)) });
    } catch {
      setProblem(t('import.unreadable'));
    } finally {
      setBusy(false);
    }
  }

  const body = (withDecisions) => ({
    source: file.source,
    fileName: file.source === 'paste' ? null : file.name,
    defaults: { side: defaults.side || null, eventIds: defaults.eventIds, city: defaults.city.trim() || null },
    rows: rows.map((r) => {
      if (!withDecisions) return r;
      const d = decisions[r.row_no];
      const status = preview?.rows.find((p) => p.rowNo === r.row_no)?.status;
      if (status === 'error' || status === 'skipped_example') return { ...r, decision: 'skip' }; // problems are skipped, never sent half-fixed
      return d ? { ...r, decision: d.decision, updateTargetId: d.target ?? undefined } : r;
    }),
  });

  async function check() {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('POST', '/imports/preview', { body: body(false), idemKey: newIdemKey() }));
      setPreview(res.data);
      setStep('preview');
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('POST', '/imports', { body: body(true), idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['households'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['imports'] });
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: t('import.done', { created: formatCount(res.data.createdCount) }) });
      navigate('/guests', { replace: true });
    } catch (e) {
      showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  const title = t('import.title');
  if (step === 'source') {
    return (
      <Screen title={title} back="/guests">
        <section className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
          <p>{t('import.templateHelp')}</p>
          <a href="/templates/AM_Guest_List_Template.xlsx" download className="tap inline-flex items-center gap-2 font-bold text-primary">
            <FileSpreadsheet aria-hidden="true" size={22} /> {t('import.template')}
          </a>
        </section>
        <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary">
          <Upload aria-hidden="true" size={20} /> {busy ? t('import.reading') : t('import.chooseFile')}
          <input type="file" accept=".xlsx,.csv,.txt,.vcf,text/csv,text/vcard,text/x-vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} className="sr-only" />
        </label>
        <p className="text-center text-text-muted">{t('import.or')}</p>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('import.paste')}</span>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder={t('import.pasteHelp')}
            className="w-full rounded-sm border-[1.5px] border-border-strong bg-surface p-3 text-base text-text" />
        </label>
        <Button variant="secondary" disabled={!pasted.trim()} onClick={() => begin({ name: 'pasted', source: 'paste', rows: parsePaste(pasted) })}>{t('import.usePaste')}</Button>
        {problem && <Notice kind="danger">{problem}</Notice>}
      </Screen>
    );
  }

  if (step === 'setup') {
    return (
      <Screen title={title} back="/guests">
        <p className="font-bold">{t('import.rowsFound', { n: formatCount(rows.length), file: file.source === 'paste' ? t('import.paste').toLowerCase() : file.name })}</p>
        <section className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">{t('import.defaults')}</h2>
          <ChoiceChips label={t('import.side')} value={defaults.side} onChange={(v) => setDefaults({ ...defaults, side: v })}
            options={[{ value: '', label: t('import.noDefault') }, ...SIDES.map((s) => ({ value: s, label: t(`guests.sides.${s}`) }))]} />
          {evs.length > 0 && (
            <MultiChips label={t('import.inviteAll')} value={defaults.eventIds} onChange={(v) => setDefaults({ ...defaults, eventIds: v })} options={evs.map((e) => ({ value: e.id, label: e.name }))} />
          )}
          <TextField label={t('import.city')} value={defaults.city} onChange={(v) => setDefaults({ ...defaults, city: v })} maxLength={60} />
        </section>
        {file.table && (
          <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
            <h2 className="text-lg font-bold">{t('import.columns')}</h2>
            {file.table[header].map((h, c) => (String(h ?? '').trim() === '' ? null : (
              <label key={c} className="flex flex-col gap-1">
                <span className="font-bold">{t('import.columnFor', { name: String(h) })}</span>
                <select value={mapping[c] ?? ''} onChange={(e) => setMapping(mapping.map((m, i) => (i === c ? e.target.value || null : m)))}
                  className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                  <option value="">{t('import.ignore')}</option>
                  {FIELDS.map((f) => <option key={f} value={f}>{t(`import.fields.${f}`)}</option>)}
                  {evs.map((e) => <option key={e.id} value={`event:${e.id}`}>{t('import.eventColumn', { event: e.name })}</option>)}
                </select>
              </label>
            )))}
          </section>
        )}
        <Button onClick={check} loading={busy} loadingLabel={t('import.checking')}>{t('import.check')}</Button>
        <Button variant="secondary" onClick={() => { setFile(null); setStep('source'); }}>{t('login.cancel')}</Button>
      </Screen>
    );
  }

  const c = preview.counts;
  const list = preview.rows.filter((r) => r.status !== 'skipped_example' && (show === 'all' || r.status === show));
  const decisionOf = (r) => decisions[r.rowNo]?.decision ?? (r.status === 'new' ? 'add' : 'skip');
  const toAdd = preview.rows.filter((r) => r.status !== 'skipped_example' && r.status !== 'error' && decisionOf(r) !== 'skip').length;
  return (
    <Screen title={title} back="/guests">
      <p className="text-lg font-bold" aria-live="polite">{t('import.counts', { new: formatCount(c.new), duplicates: formatCount(c.duplicates), errors: formatCount(c.errors) })}</p>
      {c.skippedExamples > 0 && <p className="text-text-muted">{t('import.examples', { n: c.skippedExamples })}</p>}
      <ChipFilter label={t('import.status.new')} value={show} onChange={(v) => { setShow(v); setLimit(PAGE); }}
        options={['all', 'new', 'duplicate', 'error'].map((k) => ({ value: k, label: t(`import.filter.${k}`) }))} />
      <ul className="flex flex-col gap-2">
        {list.slice(0, limit).map((r) => {
          const n = r.normalised;
          return (
            <li key={r.rowNo} className={`flex flex-col gap-2 rounded-md bg-surface p-3 shadow-card ${r.status === 'error' ? 'border-l-4 border-danger' : r.status === 'duplicate' ? 'border-l-4 border-warning' : ''}`}>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-text-muted">{t('import.rowLabel', { n: r.rowNo })}</span>
                <span className="font-bold">{n.name || '—'}</span>
                {n.phone && <span className="text-text-muted">{formatPhone(n.phone)}</span>}
                <span className="text-sm font-bold">{t(`import.status.${r.status}`)}</span>
              </p>
              {r.status === 'error' && (
                <>
                  <ul className="text-sm text-danger">{Object.values(r.errors).map((e) => <li key={e}>{e}</li>)}</ul>
                  <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                    <TextField label={t('import.fields.name')} value={edits[r.rowNo]?.name ?? rows.find((x) => x.row_no === r.rowNo)?.name ?? ''} onChange={(v) => setEdits({ ...edits, [r.rowNo]: { ...edits[r.rowNo], name: v } })} />
                    <TextField label={t('import.fields.phone')} type="tel" value={edits[r.rowNo]?.phone ?? rows.find((x) => x.row_no === r.rowNo)?.phone ?? ''} onChange={(v) => setEdits({ ...edits, [r.rowNo]: { ...edits[r.rowNo], phone: v } })} />
                  </div>
                  <p className="text-sm text-text-muted">{t('import.willSkip')}</p>
                </>
              )}
              {r.status === 'duplicate' && (
                <>
                  <ul className="text-sm">{r.matches.map((m, i) => <li key={i}>{m.rowNo ? t('import.sameRow', { n: m.rowNo, name: m.name }) : t('import.sameAs', { name: m.name })}</li>)}</ul>
                  <label className="flex flex-col gap-1">
                    <span className="sr-only">{t('import.decision')} · {t('import.rowLabel', { n: r.rowNo })}</span>
                    <select value={decisions[r.rowNo] ? `${decisions[r.rowNo].decision}:${decisions[r.rowNo].target ?? ''}` : 'skip:'}
                      onChange={(e) => { const [decision, target] = e.target.value.split(':'); setDecisions({ ...decisions, [r.rowNo]: { decision, target: target || null } }); }}
                      className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                      <option value="skip:">{t('import.decisions.skip')}</option>
                      <option value="add_anyway:">{t('import.decisions.add_anyway')}</option>
                      {r.matches.filter((m) => m.id).map((m) => <option key={m.id} value={`update_existing:${m.id}`}>{t('import.decisions.update_existing', { name: m.name })}</option>)}
                    </select>
                  </label>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {list.length > limit && <button type="button" className="tap font-bold text-primary" onClick={() => setLimit(limit + PAGE)}>{t('import.showMore')}</button>}
      {Object.keys(edits).length > 0 && <Button variant="secondary" onClick={check} loading={busy}>{t('import.checkAgain')}</Button>}
      <Button onClick={run} loading={busy} loadingLabel={t('import.running')} disabled={toAdd === 0}>{t('import.run', { n: formatCount(toAdd) })}</Button>
      <Button variant="secondary" onClick={() => setStep('setup')}>{t('guests.previous')}</Button>
    </Screen>
  );
}
