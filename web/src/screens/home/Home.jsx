// Home (FEATURES B2; new layout in 1.0.16, owner's request): cover slideshow with the
// monogram, couple photos, Months : Days : Hours countdown, upcoming events, my tasks,
// everyone's overdue, and (Ayush and Mahi only) recent activity. Budget, payments,
// headcount and safety live on their own screens. Refreshes when the app comes to the front.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import AddButton from '../../components/AddButton.jsx';
import QuickAddSheet from '../../components/QuickAddSheet.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatTime } from '../../format/ist.js';
import HomeHero, { CouplePhotos } from './HomeHero.jsx';
import { NextEventCard, StatTiles } from './HomeTiles.jsx';
import { useHomePhotos } from '../../data/homePhotos.js';
import { MyTasksCard, OverdueCard, UpcomingEventsCard, ActivityCard, StartHere } from './Cards.jsx';
import { t } from '../../i18n/strings.en.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export default function Home() {
  const { user, permissions } = useSession();
  const admin = Boolean(permissions?.admin);
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('GET', '/dashboard').then((r) => r.data), refetchOnWindowFocus: true, staleTime: 15_000 });
  const d = q.data;

  const photos = useHomePhotos();
  const g = photos.data ?? { couple: [], cover: [] };
  // Layout (1.0.23, owner's reference): the photo fills the top with the logo, headline and
  // countdown; the next event card overlaps its bottom edge; then the four tiles and the cards.
  return (
    <>
      <div className="mx-auto max-w-xl sm:px-4 sm:pt-4"><HomeHero admin={admin} countdown={d?.countdown ?? null} name={user?.name ?? null} couple={false} /></div>
      <main className="relative mx-auto -mt-10 flex max-w-xl flex-col gap-5 px-safe pb-6">
      {d?.countdown?.nextEvent && <NextEventCard event={d.countdown.nextEvent} />}
      {d?.stats && <StatTiles stats={d.stats} budget={d.budget ?? null} />}
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && (
        <Notice kind="danger"><span className="inline-flex items-center gap-2"><TriangleAlert aria-hidden="true" size={20} />{t('home.serverFail')}</span></Notice>
      )}
      {d?.startHere && <StartHere data={d.startHere} />}
      {d?.upcomingEvents && <UpcomingEventsCard data={d.upcomingEvents} />}
      {d?.myTasks && <MyTasksCard data={d.myTasks} />}
      {d?.overdue && <OverdueCard data={d.overdue} />}
      <section className="flex flex-col gap-2" aria-labelledby="home-moments">
        <h2 id="home-moments" className="text-lg font-bold">{t('home.moments')}</h2>
        <CouplePhotos photos={g.couple} admin={admin && photos.isSuccess && g.cover.length === 0} />
      </section>
      {admin && d?.recentActivity?.length > 0 && <ActivityCard data={d.recentActivity} />}
      <footer className="flex flex-col gap-1 text-sm text-text-muted" aria-live="polite">
        {q.isSuccess && (
          <span className="inline-flex items-center gap-1"><CircleCheck aria-hidden="true" size={16} className="text-success" />{t('home.serverOk')} · {t('home.updated', { time: formatTime(new Date(q.dataUpdatedAt)) })}</span>
        )}
        <span>{t('home.welcome', { version: VERSION })}</span>
      </footer>
      <AddButton label={t('quickAdd.title')} onClick={() => setAdding(true)} />
      {adding && <QuickAddSheet onClose={() => setAdding(false)} />}
      </main>
    </>
  );
}
