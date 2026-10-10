// Guests (FEATURES B5): "512 families · 1,804 people" for the current filter, server
// search, side chips, event + Coming? filters, more filters in a sheet (remembered per
// user), 50 at a time with more loading as you scroll. + adds a family.
// Select mode: tick families (or all filtered) → one bulk action with one Undo.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Star, Users, PhoneOff, Copy, MessageCircle, CheckSquare, FileDown, Upload } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import ChipFilter, { MultiChips } from '../../components/ChipFilter.jsx';
import AddButton from '../../components/AddButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { Notice, Toggle } from '../../components/Field.jsx';
import { api, API_BASE } from '../../api/client.js';
import BulkBar from './BulkBar.jsx';
import WaitingMark from '../../components/WaitingMark.jsx';
import { useSession } from '../../api/session.js';
import { formatCount } from '../../format/inr.js';
import { SIDES, FOODS, RSVPS, listQuery, loadFilters, saveFilters, peopleText } from '../../data/guests.js';
import { t } from '../../i18n/strings.en.js';

export function useGuestEvents() {
  return useQuery({ queryKey: ['events', 'guests'], queryFn: () => api('GET', '/events', { query: { guestsInvited: 'true' } }).then((r) => r.data), staleTime: 60_000 });
}

const suggest = (field) => ({
  queryKey: ['household-suggestions', field],
  queryFn: () => api('GET', '/households/suggestions', { query: { field } }).then((r) => r.data),
  staleTime: 60_000,
});

export function FamilyRow({ family, eventId, selecting, checked, onToggle }) {
  const inv = eventId ? family.invitation : null;
  const Wrap = selecting ? 'label' : Link;
  const wrapProps = selecting ? { className: 'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2' } : { to: `/guests/${family.id}`, className: 'flex min-h-16 flex-col justify-center px-4 py-2' };
  return (
    <li className="border-b border-border last:border-b-0">
      <Wrap {...wrapProps}>
        {selecting && <input type="checkbox" checked={checked} onChange={() => onToggle(family.id)} aria-label={t('bulk.choose', { name: family.name })} className="h-6 w-6 shrink-0 accent-[var(--c-primary)]" />}
        <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-lg font-bold">
          {family.isVip && <Star aria-label={t('guests.important')} size={18} className="shrink-0 fill-current text-warning" />}
          <span className="truncate">{family.name}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          <WaitingMark entity={`/households/${family.id}`} />
          <span>{peopleText(family.people)}</span>
          <span>· {t(`guests.sideShort.${family.side}`)}</span>
          {family.area && <span>· {family.area}</span>}
          {!family.phone && !family.altPhone && <span className="inline-flex items-center gap-1">· <PhoneOff aria-hidden="true" size={14} />{t('guests.noPhone')}</span>}
          {family.possibleDuplicate && <span className="inline-flex items-center gap-1 text-warning">· <Copy aria-hidden="true" size={14} />{t('guests.possibleDuplicates')}</span>}
          {eventId && <span className={`font-bold ${inv?.rsvp === 'coming' ? 'text-success' : inv?.rsvp === 'not_coming' ? 'text-danger' : ''}`}>· {inv ? t(`guests.rsvp.${inv.rsvp}`) : t('guests.notInvited')}</span>}
        </span>
        </span>
      </Wrap>
    </li>
  );
}

export default function GuestList() {
  const { user, permissions } = useSession();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => loadFilters(user?.id ?? 'anon'));
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const events = useGuestEvents();
  const groups = useQuery({ ...suggest('group_name'), enabled: sheet });
  const areas = useQuery({ ...suggest('area'), enabled: sheet });
  const more = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [allFiltered, setAllFiltered] = useState(false);

  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  useEffect(() => { saveFilters(user?.id ?? 'anon', filters); }, [user?.id, filters]);

  const query = listQuery(filters, q);
  const list = useInfiniteQuery({
    queryKey: ['households', query],
    queryFn: ({ pageParam }) => api('GET', '/households', { query: { ...query, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const meta = list.data?.pages[0]?.meta;
  useEffect(() => { setPicked(new Set()); setAllFiltered(false); }, [JSON.stringify(query)]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => { setAllFiltered(false); setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const count = allFiltered ? meta?.total ?? 0 : picked.size;
  const filterBody = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
  const target = allFiltered ? { filter: filterBody } : { ids: [...picked] };
  const exportHref = `${API_BASE}/households/export?${new URLSearchParams(Object.entries(query).filter(([, v]) => v).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v])).toString()}`;

  // Load the next 50 when the end of the list comes into view.
  useEffect(() => {
    const el = more.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage, rows.length]);

  const set = (k, v) => setFilters((f) => {
    const next = { ...f, [k]: v };
    if (k === 'event' && !v) delete next.rsvp;
    return next;
  });
  const extra = ['group', 'area', 'food', 'vip', 'noPhone', 'possibleDuplicates'].filter((k) => filters[k]).length;
  const anyFilter = q || Object.values(query).some(Boolean);

  return (
    <Screen title={t('guests.title')}>
      {meta && (
        <p className="text-lg font-bold" aria-live="polite">
          {t('guests.header', { families: formatCount(meta.total), people: formatCount(meta.totals.people) })}
        </p>
      )}
      <label className="relative">
        <span className="sr-only">{t('guests.search')}</span>
        <Search aria-hidden="true" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('guests.search')}
          className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface pl-10 pr-3 text-base text-text" />
      </label>
      <ChipFilter label={t('guests.side')} value={filters.side || ''} onChange={(v) => set('side', v)}
        options={[{ value: '', label: t('guests.allSides') }, ...SIDES.map((s) => ({ value: s, label: t(`guests.sideShort.${s}`) }))]} />
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('guests.event')}</span>
          <select value={filters.event || ''} onChange={(e) => set('event', e.target.value)}
            className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
            <option value="">{t('guests.anyEvent')}</option>
            {(events.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setSheet(true)} className="tap inline-flex items-center gap-2 rounded-sm border-[1.5px] border-border-strong bg-surface px-3">
          <SlidersHorizontal aria-hidden="true" size={20} /> {t('guests.filters')}{extra > 0 && <span className="rounded-full bg-primary px-1.5 text-sm text-on-primary">{extra}</span>}
        </button>
      </div>
      {filters.event && (
        <MultiChips label={t('guests.rsvpFilter')} value={filters.rsvp || []} onChange={(v) => set('rsvp', v)}
          options={RSVPS.map((r) => ({ value: r, label: t(`guests.rsvp.${r}`) }))} />
      )}
      {filters.event && permissions?.edit && rows.length > 0 && (
        <Button variant="secondary" onClick={() => navigate(`/guests/remind?${new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString()}`)}>
          <MessageCircle aria-hidden="true" size={20} /> {t('guests.remindOneByOne')}
        </Button>
      )}
      {permissions?.edit && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setPicked(new Set()); setAllFiltered(false); }}
            className={`tap inline-flex items-center gap-2 rounded-sm border-[1.5px] px-3 ${selecting ? 'border-primary bg-primary-soft font-bold text-primary' : 'border-border-strong bg-surface'}`}>
            <CheckSquare aria-hidden="true" size={20} /> {selecting ? t('bulk.done') : t('bulk.select')}
          </button>
          {permissions?.export && !selecting && (
            <a href={exportHref} download className="tap inline-flex items-center gap-2 rounded-sm border-[1.5px] border-border-strong bg-surface px-3">
              <FileDown aria-hidden="true" size={20} /> {t('guests.exportCsv')}
            </a>
          )}
        </div>
      )}
      {selecting && (
        <section aria-label={t('bulk.pick')} className="flex flex-col gap-2 rounded-md bg-surface p-3 shadow-card">
          <p className="flex flex-wrap items-center gap-3" aria-live="polite">
            <span className="font-bold">{allFiltered ? t('bulk.allFiltered', { n: formatCount(meta?.total ?? 0) }) : t('bulk.selected', { n: formatCount(picked.size) })}</span>
            {!allFiltered && meta?.total > picked.size && (
              <button type="button" className="tap font-bold text-primary" onClick={() => setAllFiltered(true)}>{t('bulk.selectAll', { n: formatCount(meta.total) })}</button>
            )}
            {(allFiltered || picked.size > 0) && <button type="button" className="tap text-primary" onClick={() => { setAllFiltered(false); setPicked(new Set()); }}>{t('bulk.clear')}</button>}
          </p>
          <BulkBar count={count} target={target} asOf={meta?.serverTime} events={events.data ?? []} isAdmin={Boolean(permissions?.admin)} defaultEvent={filters.event}
            onDone={() => { setPicked(new Set()); setAllFiltered(false); list.refetch(); }} />
        </section>
      )}
      {!permissions?.edit && <p className="text-text-muted">{t('guests.viewerNote')}</p>}
      {list.isPending && <p aria-busy="true">…</p>}
      {list.isError && <Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice>}
      {list.isSuccess && rows.length === 0 && <EmptyState Icon={Users} text={anyFilter ? t('guests.emptyFilter') : t('guests.empty')} />}
      {list.isSuccess && rows.length === 0 && !anyFilter && permissions?.admin && (
        <Button variant="secondary" onClick={() => navigate('/guests/import')}><Upload aria-hidden="true" size={20} />{t('import.open')}</Button>
      )}
      {rows.length > 0 && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {rows.map((f) => <FamilyRow key={f.id} family={f} eventId={filters.event} selecting={selecting} checked={allFiltered || picked.has(f.id)} onToggle={toggle} />)}
        </ul>
      )}
      <div ref={more} />
      {list.hasNextPage && (
        <button type="button" className="tap font-bold text-primary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? '…' : t('guests.showMore')}
        </button>
      )}
      {permissions?.edit && <AddButton label={t('guests.addFamily')} onClick={() => navigate('/guests/new')} />}

      {sheet && (
        <Sheet title={t('guests.filters')} onClose={() => setSheet(false)}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t('guests.group')}</span>
              <select value={filters.group || ''} onChange={(e) => set('group', e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                <option value="">{t('guests.anyValue')}</option>
                {(groups.data ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold">{t('guests.area')}</span>
              <select value={filters.area || ''} onChange={(e) => set('area', e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base text-text">
                <option value="">{t('guests.anyValue')}</option>
                {(areas.data ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <ChipFilter label={t('guests.foodLabel')} value={filters.food || ''} onChange={(v) => set('food', v)}
              options={[{ value: '', label: t('guests.anyValue') }, ...FOODS.map((f) => ({ value: f, label: t(`guests.food.${f}`) }))]} />
            <Toggle label={t('guests.important')} checked={Boolean(filters.vip)} onChange={(v) => set('vip', v)} />
            <Toggle label={t('guests.noPhone')} checked={Boolean(filters.noPhone)} onChange={(v) => set('noPhone', v)} />
            <Toggle label={t('guests.possibleDuplicates')} checked={Boolean(filters.possibleDuplicates)} onChange={(v) => set('possibleDuplicates', v)} />
            <Button variant="secondary" onClick={() => { setFilters({}); setSheet(false); }}>{t('guests.clearFilters')}</Button>
            {permissions?.admin && <Button variant="secondary" onClick={() => navigate('/guests/import')}><Upload aria-hidden="true" size={20} />{t('import.open')}</Button>}
            <Button onClick={() => setSheet(false)}>{t('tasks.close')}</Button>
          </div>
        </Sheet>
      )}
    </Screen>
  );
}
