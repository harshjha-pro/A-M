// Vendors (FEATURES B6): contacts for everyone (so anyone can call the tent wala);
// amounts and balances only for money users — the server never sends them to others.
// 1.0.24: Select → change type or booked, export, and (Ayush and Mahi) delete with Undo.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Store, CircleCheck, CheckSquare, Tags, BadgeCheck, Trash2 } from 'lucide-react';
import SelectBar from '../../components/SelectBar.jsx';
import SortSelect from '../../components/SortSelect.jsx';
import BulkActions, { useSelection } from '../../components/BulkActions.jsx';
import Screen from '../../components/Screen.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice, ChoiceChips } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatPhone } from '../../format/phone.js';
import { formatInr, formatCount } from '../../format/inr.js';
import { t } from '../../i18n/strings.en.js';

const VENDOR_TYPES = ['venue', 'caterer', 'tent_decor', 'photo_video', 'makeup', 'mehndi_artist', 'band_dj', 'florist', 'transport', 'printer', 'pandit', 'jeweller', 'tailor', 'other'];

export default function VendorList() {
  const { permissions } = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const qc = useQueryClient();
  const res = useQuery({ queryKey: ['vendors', q, 'page', sort], queryFn: () => api('GET', '/vendors', { query: { q, limit: 200, sort: sort === 'name' ? undefined : sort } }) });
  const list = { ...res, data: res.data?.data };
  const sel = useSelection();
  const n = (k) => t('money.bulk.nVendors', { n: formatCount(k) });
  const cat = (c) => t(`money.vendorCategories.${c}`);
  const actions = [
    { key: 'set_category', Icon: Tags, label: t('money.bulk.setType'), initial: 'other', body: (v) => ({ category: v }), what: (v) => `${t('money.vendorCategory')} → ${cat(v)}`,
      picker: (v, set) => <ChoiceChips label={t('money.vendorCategory')} value={v} onChange={set} options={VENDOR_TYPES.map((c) => ({ value: c, label: cat(c) }))} /> },
    { key: 'set_booked', Icon: BadgeCheck, label: t('money.bulk.setBooked'), initial: true, body: (v) => ({ isBooked: v }), what: (v) => (v ? t('money.booked') : t('money.bulk.notBooked')),
      picker: (v, set) => <ChoiceChips label={t('money.booked')} value={v ? 'yes' : 'no'} onChange={(x) => set(x === 'yes')} options={[{ value: 'yes', label: t('money.booked') }, { value: 'no', label: t('money.bulk.notBooked') }]} /> },
    ...(permissions?.admin ? [{ key: 'delete', Icon: Trash2, danger: true, label: t('bulk.delete'),
      confirm: { title: t('money.bulk.confirmDelete', { n: formatCount(sel.ids.length) }), body: t('money.bulk.deleteBody') } }] : []),
  ];
  return (
    <Screen title={t('money.vendors')} back={permissions?.money ? '/money' : '/more'}>
      <label className="relative">
        <span className="sr-only">{t('money.searchVendors')}</span>
        <Search aria-hidden="true" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('money.searchVendors')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface pl-10 pr-3 text-base text-text" />
      </label>
      {!permissions?.edit && <p className="text-text-muted">{t('money.vendorReadOnly')}</p>}
      {list.data?.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-text-muted">{t('money.bulk.countShown', { n: formatCount(list.data.length), total: formatCount(res.data.meta.total ?? list.data.length) })}</span>
          <span className="flex items-center gap-2">
          <SortSelect value={sort} onChange={setSort} options={['name', 'category', '-created_at', 'booked'].map((v) => ({ value: v, label: t(`sort.vendors.${v}`) }))} />
          {permissions?.edit && <button type="button" aria-pressed={sel.on} onClick={sel.on ? sel.stop : sel.start}
            className={`tap inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 font-bold ${sel.on ? 'glass-blush text-primary' : 'border-border bg-surface'}`}>
            <CheckSquare aria-hidden="true" size={20} /> {sel.on ? t('bulk.done') : t('tasks.select')}
          </button>}
          </span>
        </div>
      )}
      {sel.on && (
        <SelectBar count={sel.ids.length} visible={list.data?.length ?? 0} onSelectVisible={() => sel.setAll(list.data.map((v) => v.id))} onClear={sel.clear}>
          <BulkActions endpoint="/vendors/bulk" exportPath="/vendors/export" ids={sel.ids} asOf={res.data?.meta.serverTime} actions={actions} noun={n}
            onDone={() => { sel.clear(); qc.invalidateQueries({ queryKey: ['vendors'] }); }} />
        </SelectBar>
      )}
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && list.data.length === 0 && <EmptyState Icon={Store} text={t('money.vendorsEmpty')} />}
      {list.data?.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {list.data.map((v) => (
            <li key={v.id} className="border-b border-border last:border-b-0">
              {sel.on ? (
                <label className={`flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2 ${sel.picked.has(v.id) ? 'bg-primary-soft' : ''}`}>
                  <input type="checkbox" checked={sel.picked.has(v.id)} onChange={() => sel.toggle(v.id)} aria-label={t('bulk.choose', { name: v.name })} className="size-6 shrink-0 accent-[var(--c-primary)]" />
                  <span className="flex flex-col"><span className="text-lg font-bold">{v.name}</span><span className="text-sm text-text-muted">{cat(v.category)}{v.isBooked ? ` · ${t('money.booked')}` : ''}</span></span>
                </label>
              ) : (
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
              )}
            </li>
          ))}
        </ul>
      )}
      {permissions?.edit && !sel.on && <AddButton label={t('money.addVendor')} onClick={() => navigate('/vendors/new')} />}
    </Screen>
  );
}
