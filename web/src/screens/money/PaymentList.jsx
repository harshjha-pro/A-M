// Payments and expenses (FEATURES B6): status chips (Due · Overdue · Paid · No date),
// totals for the filter from the server, rows with red "Overdue" and amber "No date".
// 1.0.24: Select → change category or event, or export. Paid, amounts and delete stay one at a time.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, TriangleAlert, CalendarX, Paperclip, CheckSquare, Tags, PartyPopper } from 'lucide-react';
import SelectBar from '../../components/SelectBar.jsx';
import SortSelect from '../../components/SortSelect.jsx';
import BulkActions, { useSelection } from '../../components/BulkActions.jsx';
import Screen, { ScreenLoader } from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { formatInr, formatCount } from '../../format/inr.js';
import { paymentWhen, payee, useMoneyGuard, useCategories } from '../../data/money.js';
import { t } from '../../i18n/strings.en.js';

const STATUSES = ['all', 'due', 'overdue', 'paid', 'no_date'];

export function PaymentRow({ p, sel = null }) {
  if (sel?.on) {
    return (
      <li className="border-b border-border last:border-b-0">
        <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 ${sel.picked.has(p.id) ? 'bg-primary-soft' : ''}`}>
          <input type="checkbox" checked={sel.picked.has(p.id)} onChange={() => sel.toggle(p.id)} aria-label={t('bulk.choose', { name: p.title })} className="size-6 shrink-0 accent-[var(--c-primary)]" />
          <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-lg font-bold">{p.title}</span><span className="text-sm text-text-muted">{p.category?.name ?? ''}{p.event ? ` · ${p.event.name}` : ''}</span></span>
          <span className="shrink-0 font-bold">{formatInr(p.amountPaise)}</span>
        </label>
      </li>
    );
  }
  return (
    <li className="border-b border-border last:border-b-0">
      <Link to={`/money/payments/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-bold">{p.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
            {p.overdue && <span className="inline-flex items-center gap-1 font-bold text-danger"><TriangleAlert aria-hidden="true" size={14} />{t('money.overdue')}</span>}
            {p.noDate && <span className="inline-flex items-center gap-1 font-bold text-warning"><CalendarX aria-hidden="true" size={14} />{t('money.noDate')}</span>}
            {!p.noDate && <span>{paymentWhen(p)}</span>}
            <span>· {payee(p)}</span>
            {p.receiptCount > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip aria-label={p.receiptCount === 1 ? t('money.receiptOne') : t('money.receipts', { n: p.receiptCount })} size={14} />{p.receiptCount > 1 ? p.receiptCount : ''}</span>}
          </span>
        </span>
        <span className={`shrink-0 text-lg font-bold ${p.status === 'paid' ? 'text-success' : ''}`}>{formatInr(p.amountPaise)}</span>
      </Link>
    </li>
  );
}

export default function PaymentList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('due_date');
  const list = useInfiniteQuery({
    queryKey: ['payments', status, sort],
    queryFn: ({ pageParam }) => api('GET', '/payments', { query: { status: status === 'all' ? undefined : status, sort: sort === 'due_date' ? undefined : sort, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const lost = useMoneyGuard(list.error);
  const qc = useQueryClient();
  const sel = useSelection();
  const cats = useCategories(sel.on);
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000, enabled: sel.on });
  const named = (list, id, none) => (list ?? []).find((x) => x.id === id)?.name ?? none;
  const pick = (options, none) => (v, set) => (
    <select value={v ?? ''} onChange={(e) => set(e.target.value)} aria-label={t('money.bulk.choose')} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
      {none && <option value="">{none}</option>}
      {(options ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );
  const actions = [
    { key: 'set_category', Icon: Tags, label: t('money.bulk.setCategory'), initial: '', ready: (v) => Boolean(v), body: (v) => ({ categoryId: v }),
      what: (v) => `${t('money.bulk.setCategory')} → ${named(cats.data, v, '—')}`, picker: (v, set) => pick(cats.data, t('money.bulk.choose'))(v, set) },
    { key: 'set_event', Icon: PartyPopper, label: t('money.bulk.setEvent'), initial: '', body: (v) => ({ eventId: v || null }),
      what: (v) => `${t('money.bulk.setEvent')} → ${named(events.data, v, t('money.noEvent'))}`, picker: (v, set) => pick(events.data, t('money.noEvent'))(v, set) },
  ];
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const meta = list.data?.pages[0]?.meta;
  if (lost) return <Screen title={t('money.payments')} back="/money"><Notice kind="danger">{t('money.noAccess')}</Notice></Screen>;
  return (
    <Screen title={t('money.payments')} back="/money">
      <ChipFilter label={t('money.payments')} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`money.filters.${s}`) }))} />
      {meta && (
        <p className="font-bold" aria-live="polite">
          {t('money.totals', { n: formatCount(meta.total), amount: formatInr(meta.totals.amountPaise) })}
          <span className="font-normal text-text-muted"> · {t('money.totalsSplit', { due: formatInr(meta.totals.duePaise), paid: formatInr(meta.totals.paidPaise) })}</span>
        </p>
      )}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SortSelect value={sort} onChange={setSort} options={['due_date', '-paid_on', '-amount_paise'].map((v) => ({ value: v, label: t(`sort.payments.${v}`) }))} />
          <button type="button" aria-pressed={sel.on} onClick={sel.on ? sel.stop : sel.start}
            className={`tap inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 font-bold ${sel.on ? 'glass-blush text-primary' : 'border-border bg-surface'}`}>
            <CheckSquare aria-hidden="true" size={20} /> {sel.on ? t('bulk.done') : t('tasks.select')}
          </button>
        </div>
      )}
      {sel.on && (
        <SelectBar count={sel.ids.length} visible={rows.length} onSelectVisible={() => sel.setAll(rows.map((p) => p.id))} onClear={sel.clear}>
          <BulkActions endpoint="/payments/bulk" exportPath="/payments/export" ids={sel.ids} asOf={meta?.serverTime} actions={actions}
            noun={(k) => t('money.bulk.nPayments', { n: formatCount(k) })} onDone={() => { sel.clear(); qc.invalidateQueries({ queryKey: ['payments'] }); }} />
          <p className="text-sm text-text-muted">{t('money.bulk.oneAtATime')}</p>
        </SelectBar>
      )}
      {list.isPending && <ScreenLoader />}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && <EmptyState Icon={Receipt} text={status === 'all' ? t('money.emptyPayments') : t('money.emptyFilter')} />}
      {rows.length > 0 && <ul className="overflow-hidden rounded-md bg-surface shadow-card">{rows.map((p) => <PaymentRow key={p.id} p={p} sel={sel} />)}</ul>}
      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      {!sel.on && <AddButton label={t('money.addPayment')} onClick={() => navigate('/money/payments/new')} />}
    </Screen>
  );
}
