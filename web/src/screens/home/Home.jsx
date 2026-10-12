// Home (FEATURES B2; new layout in 1.0.16, owner's request): cover slideshow with the
// monogram, couple photos, Months : Days : Hours countdown, upcoming events, my tasks,
// everyone's overdue, and (Ayush and Mahi only) recent activity. Budget, payments,
// headcount and safety live on their own screens. Refreshes when the app comes to the front.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import AddButton from '../../components/AddButton.jsx';
import QuickAddSheet from '../../components/QuickAddSheet.jsx';
import Screen from '../../components/Screen.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatTime } from '../../format/ist.js';
import Countdown from './Countdown.jsx';
import HomeHero from './HomeHero.jsx';
import { MyTasksCard, OverdueCard, UpcomingEventsCard, ActivityCard, StartHere } from './Cards.jsx';
import { t } from '../../i18n/strings.en.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export default function Home() {
  const { user, permissions } = useSession();
  const admin = Boolean(permissions?.admin);
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('GET', '/dashboard').then((r) => r.data), refetchOnWindowFocus: true, staleTime: 15_000 });
  const d = q.data;

  return (
    <Screen title={t('home.title')}>
      <HomeHero admin={admin} />
      {d && <Countdown data={d.countdown} name={user?.name} />}
      {!d && user && <p className="text-lg">{t('home.hello', { name: user.name })}</p>}
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && (
        <Notice kind="danger"><span className="inline-flex items-center gap-2"><TriangleAlert aria-hidden="true" size={20} />{t('home.serverFail')}</span></Notice>
      )}
      {d?.startHere && <StartHere data={d.startHere} />}
      {d?.upcomingEvents && <UpcomingEventsCard data={d.upcomingEvents} />}
      {d?.myTasks && <MyTasksCard data={d.myTasks} />}
      {d?.overdue && <OverdueCard data={d.overdue} />}
      {admin && d?.recentActivity?.length > 0 && <ActivityCard data={d.recentActivity} />}
      <footer className="flex flex-col gap-1 text-sm text-text-muted" aria-live="polite">
        {q.isSuccess && (
          <span className="inline-flex items-center gap-1"><CircleCheck aria-hidden="true" size={16} className="text-success" />{t('home.serverOk')} · {t('home.updated', { time: formatTime(new Date(q.dataUpdatedAt)) })}</span>
        )}
        <span>{t('home.welcome', { version: VERSION })}</span>
      </footer>
      <AddButton label={t('quickAdd.title')} onClick={() => setAdding(true)} />
      {adding && <QuickAddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
