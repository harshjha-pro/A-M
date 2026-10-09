// "Send reminders one by one" (FEATURES A7, AC-WA-02): family card → [Open WhatsApp] → [Next].
// The position is kept on this phone, because iOS may reload the app on the way back from WhatsApp.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { Notice, ChoiceChips } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatPhone } from '../../format/phone.js';
import { getLang, setLang, mobileOf, peopleText } from '../../data/guests.js';
import { useGuestEvents } from './GuestList.jsx';
import { ReminderButton, recordTap } from './FamilyDetail.jsx';
import { t } from '../../i18n/strings.en.js';

const MAX = 2000;

async function loadAll(query) {
  const out = [];
  let cursor;
  do {
    const r = await api('GET', '/households', { query: { ...query, limit: 200, cursor } });
    out.push(...r.data);
    cursor = r.meta.hasMore ? r.meta.nextCursor : undefined;
  } while (cursor && out.length < MAX);
  return out;
}

const read = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* not remembered */ } };

export default function ReminderStepper() {
  const [params] = useSearchParams();
  const { user } = useSession();
  const query = Object.fromEntries(params.entries());
  const posKey = `am:remind-pos:${params.toString()}`;
  const list = useQuery({ queryKey: ['households', 'stepper', query], queryFn: () => loadAll(query), staleTime: Infinity });
  const events = useGuestEvents();
  const [pos, setPos] = useState(() => read(posKey));
  const [lang, setLangState] = useState(getLang);
  useEffect(() => { write(posKey, pos); }, [posKey, pos]);

  const rows = list.data ?? [];
  const title = t('guests.stepperTitle');
  if (list.isPending) return <Screen title={title} back="/guests"><p aria-busy="true">…</p></Screen>;
  if (list.isError) return <Screen title={title} back="/guests"><Notice kind="danger">{list.error.message || t('errors.loadFailed')}</Notice></Screen>;
  if (rows.length === 0) return <Screen title={title} back="/guests"><p>{t('guests.stepperEmpty')}</p></Screen>;
  if (pos >= rows.length) {
    return (
      <Screen title={title} back="/guests">
        <Notice kind="success">{t('guests.stepperDone', { total: rows.length })}</Notice>
        <Button variant="secondary" onClick={() => setPos(rows.length - 1)}>{t('guests.previous')}</Button>
      </Screen>
    );
  }
  const fam = rows[pos];
  const inv = fam.invitation;
  return (
    <Screen title={title} back="/guests">
      <p className="text-text-muted" aria-live="polite">{t('guests.stepperOf', { n: pos + 1, total: rows.length })}</p>
      <ChoiceChips label={t('guests.language')} value={lang} onChange={(l) => { setLang(l); setLangState(l); }}
        options={['en', 'hi'].map((l) => ({ value: l, label: t(`guests.lang.${l}`) }))} />
      <article className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <h2 className="text-xl font-bold">{fam.name}</h2>
        <p className="text-text-muted">{peopleText(fam.people)}{fam.phone ? ` · ${formatPhone(fam.phone)}` : ''}</p>
        {inv && <p><span className="font-bold">{inv.event.name}</span> · {t(`guests.rsvp.${inv.rsvp}`)}</p>}
        {inv && <ReminderButton family={fam} invitation={inv} events={events.data ?? []} sender={user?.name} lang={lang} onTap={() => recordTap(fam.id, inv.event.id)} />}
        {!mobileOf(fam) && <p className="text-sm text-text-muted">{t('guests.skipNoPhone')}</p>}
      </article>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={pos === 0} onClick={() => setPos(pos - 1)}>{t('guests.previous')}</Button>
        <Button onClick={() => setPos(pos + 1)}>{t('guests.next')}</Button>
      </div>
    </Screen>
  );
}
