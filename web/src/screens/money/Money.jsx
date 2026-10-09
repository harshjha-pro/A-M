// Money (FEATURES B6): Planned · Spent · Still to pay · Left · Free (red "Over by"),
// "Not yet split", the categories with red over-plan rows, and links to Payments and
// Vendors. Money users only — the server refuses everyone else (403 no_money_access).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, ChevronRight, Receipt, Store, Plus } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import MoneyField, { readAmount } from '../../components/MoneyField.jsx';
import { Notice, TextField } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { useSession } from '../../api/session.js';
import { DuplicateError, RuleError, ValidationError } from '../../api/errors.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { formatInr } from '../../format/inr.js';
import { useMoneyGuard } from '../../data/money.js';
import { t } from '../../i18n/strings.en.js';

function Totals({ s }) {
  const rows = [['planned', s.plannedPaise], ['spent', s.spentPaise], ['stillToPay', s.stillToPayPaise], ['left', s.leftPaise]];
  return (
    <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card" aria-label={t('money.title')}>
      <dl className="grid grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <div key={k}><dt className="text-sm text-text-muted">{t(`money.${k}`)}</dt><dd className="text-xl font-bold">{formatInr(v)}</dd></div>
        ))}
      </dl>
      <p className={`text-lg font-bold ${s.freePaise < 0 ? 'text-danger' : 'text-success'}`}>
        {s.freePaise < 0 ? t('money.overBy', { amount: formatInr(-s.freePaise) }) : `${t('money.free')} ${formatInr(s.freePaise)}`}
      </p>
      {s.notYetSplitPaise > 0 && <p className="text-text-muted">{t('money.notSplit', { amount: formatInr(s.notYetSplitPaise) })}</p>}
      {!s.totalBudgetSet && (
        <p className="text-sm"><Link to="/settings/wedding" className="font-bold text-primary">{t('money.setBudget')}</Link> · {t('money.setBudgetHelp')}</p>
      )}
    </section>
  );
}

function CategorySheet({ cat, cats, isAdmin, onClose, onDone }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [planned, setPlanned] = useState(cat ? String(cat.plannedPaise / 100) : '');
  const [errors, setErrors] = useState({});
  const [moving, setMoving] = useState(null); // count when the server says move first
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = readAmount(planned, { required: false, max: 1e14 });
    const errs = {};
    if (!name.trim()) errs.name = t('money.vendorNameRequired');
    if (amt.error) errs.planned = amt.error;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = {};
      if (!cat || name.trim() !== cat.name) body.name = name.trim();
      if (!cat || (amt.paise ?? 0) !== cat.plannedPaise) body.plannedPaise = amt.paise ?? 0;
      if (Object.keys(body).length) {
        await withRelogin(() => (cat
          ? api('PATCH', `/budget-categories/${cat.id}`, { body, ifMatch: cat.version, idemKey: newIdemKey() })
          : api('POST', '/budget-categories', { body, idemKey: newIdemKey() })));
      }
      onDone();
    } catch (e) {
      if (e instanceof DuplicateError) setErrors({ name: e.message });
      else if (e instanceof ValidationError) setErrors(e.fields);
      else showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await withRelogin(() => api('DELETE', `/budget-categories/${cat.id}`, { body: target ? { movePaymentsTo: target } : {}, ifMatch: cat.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: onDone });
      onDone();
    } catch (e) {
      if (e instanceof RuleError && e.details?.rule === 'category_has_payments') setMoving(e.details.count);
      else showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={cat ? cat.name : t('money.addCategory')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={t('money.categoryName')} value={name} onChange={setName} error={errors.name} maxLength={60} />
        <MoneyField label={t('money.plannedAmount')} value={planned} onChange={setPlanned} error={errors.planned ?? errors.plannedPaise} required={false} />
        <Button onClick={save} loading={busy}>{t('money.saveCategory')}</Button>
        {cat?.isFallback && <p className="text-sm text-text-muted">{t('money.fallbackNote')}</p>}
        {cat && !cat.isFallback && isAdmin && !moving && <Button variant="danger" onClick={remove} disabled={busy}>{t('money.deleteCategory')}</Button>}
        {moving && (
          <div role="alert" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
            <p className="font-bold">{t('money.moveTitle', { n: moving })}</p>
            <label className="flex flex-col gap-1">
              <span>{t('money.moveTo')}</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                <option value="">—</option>
                {cats.filter((c) => c.id !== cat.id && !c.deleted).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Button variant="danger" onClick={remove} disabled={!target || busy}>{t('money.moveAndDelete')}</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default function Money() {
  const { permissions } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['money-summary'], queryFn: () => api('GET', '/money/summary').then((r) => r.data) });
  const [editing, setEditing] = useState(null); // category or 'new'
  const lost = useMoneyGuard(q.error);
  const refresh = () => { setEditing(null); qc.invalidateQueries({ queryKey: ['money-summary'] }); qc.invalidateQueries({ queryKey: ['budget-categories'] }); qc.invalidateQueries({ queryKey: ['payments'] }); };

  if (lost) return <Screen title={t('money.title')} back="/more"><Notice kind="danger">{t('money.noAccess')}</Notice></Screen>;
  return (
    <Screen title={t('money.title')} back="/more">
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.data && <Totals s={q.data} />}
      <nav className="grid grid-cols-2 gap-3" aria-label={t('money.title')}>
        <Link to="/money/payments" className="tap flex items-center gap-2 rounded-md bg-surface px-4 font-bold shadow-card"><Receipt aria-hidden="true" size={22} className="text-primary" />{t('money.payments')}</Link>
        <Link to="/vendors" className="tap flex items-center gap-2 rounded-md bg-surface px-4 font-bold shadow-card"><Store aria-hidden="true" size={22} className="text-primary" />{t('money.vendors')}</Link>
      </nav>
      {q.data && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{t('money.categories')}</h2>
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {q.data.categories.map((c) => (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => !c.deleted && setEditing(c)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{c.name}</span>
                    <span className={`text-sm ${c.isOver ? 'font-bold text-danger' : 'text-text-muted'}`}>
                      {c.plannedPaise > 0
                        ? t('money.categoryLine', { spent: formatInr(c.spentPaise), due: formatInr(c.duePaise), planned: formatInr(c.plannedPaise) })
                        : `${formatInr(c.spentPaise)} · ${t('money.noPlan')}`}
                      {c.isOver && ` · ${t('money.overBy', { amount: formatInr(c.spentPaise + c.duePaise - c.plannedPaise) })}`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={22} className="text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setEditing('new')}><Plus aria-hidden="true" size={20} />{t('money.addCategory')}</Button>
        </section>
      )}
      {q.isSuccess && q.data.categories.length === 0 && <p className="flex items-center gap-2 text-text-muted"><IndianRupee aria-hidden="true" />{t('money.empty')}</p>}
      {editing && <CategorySheet cat={editing === 'new' ? null : editing} cats={q.data?.categories ?? []} isAdmin={Boolean(permissions?.admin)} onClose={() => setEditing(null)} onDone={refresh} />}
    </Screen>
  );
}
