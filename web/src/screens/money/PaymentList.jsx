// Payments and expenses (FEATURES B6): status chips (Due · Overdue · Paid · No date),
// totals for the filter from the server, rows with red "Overdue" and amber "No date".
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Receipt, TriangleAlert, CalendarX } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter from '../../components/ChipFilter.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { formatInr, formatCount } from '../../format/inr.js';
import { paymentWhen, payee, useMoneyGuard } from '../../data/money.js';
import { t } from '../../i18n/strings.en.js';

const STATUSES = ['all', 'due', 'overdue', 'paid', 'no_date'];

export function PaymentRow({ p }) {
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
  const list = useInfiniteQuery({
    queryKey: ['payments', status],
    queryFn: ({ pageParam }) => api('GET', '/payments', { query: { status: status === 'all' ? undefined : status, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const lost = useMoneyGuard(list.error);
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
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && <EmptyState Icon={Receipt} text={status === 'all' ? t('money.emptyPayments') : t('money.emptyFilter')} />}
      {rows.length > 0 && <ul className="overflow-hidden rounded-md bg-surface shadow-card">{rows.map((p) => <PaymentRow key={p.id} p={p} />)}</ul>}
      {list.hasNextPage && <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()}>{t('history.more')}</button>}
      <AddButton label={t('money.addPayment')} onClick={() => navigate('/money/payments/new')} />
    </Screen>
  );
}
