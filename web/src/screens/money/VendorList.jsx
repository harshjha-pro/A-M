// Vendors (FEATURES B6): contacts for everyone (so anyone can call the tent wala);
// amounts and balances only for money users — the server never sends them to others.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Store, CircleCheck } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatPhone } from '../../format/phone.js';
import { formatInr } from '../../format/inr.js';
import { t } from '../../i18n/strings.en.js';

export default function VendorList() {
  const { permissions } = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const list = useQuery({ queryKey: ['vendors', q], queryFn: () => api('GET', '/vendors', { query: { q, limit: 200 } }).then((r) => r.data) });
  return (
    <Screen title={t('money.vendors')} back={permissions?.money ? '/money' : '/more'}>
      <label className="relative">
        <span className="sr-only">{t('money.searchVendors')}</span>
        <Search aria-hidden="true" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('money.searchVendors')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface pl-10 pr-3 text-base text-text" />
      </label>
      {!permissions?.edit && <p className="text-text-muted">{t('money.vendorReadOnly')}</p>}
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && list.data.length === 0 && <EmptyState Icon={Store} text={t('money.vendorsEmpty')} />}
      {list.data?.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {list.data.map((v) => (
            <li key={v.id} className="border-b border-border last:border-b-0">
              <Link to={`/vendors/${v.id}`} className="flex min-h-16 flex-col justify-center px-4 py-2">
                <span className="flex items-center gap-2 text-lg font-bold">{v.name}{v.isBooked && <CircleCheck aria-label={t('money.booked')} size={18} className="text-success" />}</span>
                <span className="text-sm text-text-muted">
                  {t(`money.vendorCategories.${v.category}`)}{v.phone ? ` · ${formatPhone(v.phone)}` : ''}
                  {v.balance && v.balance.notScheduledPaise !== 0 && v.balance.agreedPaise !== null && (
                    <span className={v.balance.notScheduledPaise < 0 ? 'font-bold text-danger' : 'font-bold text-warning'}>
                      {' · '}{v.balance.notScheduledPaise > 0 ? t('money.notScheduled', { amount: formatInr(v.balance.notScheduledPaise) }) : t('money.moreThanAgreed', { amount: formatInr(-v.balance.notScheduledPaise) })}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {permissions?.edit && <AddButton label={t('money.addVendor')} onClick={() => navigate('/vendors/new')} />}
    </Screen>
  );
}
