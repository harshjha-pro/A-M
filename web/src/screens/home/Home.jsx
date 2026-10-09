// Home (FEATURES B2): every card from one call, GET /dashboard; only the cards this
// person may see come back. Refreshes when the app comes to the front; "Updated 10:42".
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
import { MyTasksCard, OverdueCard, HeadcountCard, PaymentsCard, BudgetCard, SafetyCard, ActivityCard, StartHere } from './Cards.jsx';
import { t } from '../../i18n/strings.en.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export default function Home() {
  const { user } = useSession();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('GET', '/dashboard').then((r) => r.data), refetchOnWindowFocus: true, staleTime: 15_000 });
  const d = q.data;

  return (
    <Screen title={t('home.title')}>
      {d && <Countdown data={d.countdown} name={user?.name} />}
      {!d && user && <p className="text-lg">{t('home.hello', { name: user.name })}</p>}
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && (
        <Notice kind="danger"><span className="inline-flex items-center gap-2"><TriangleAlert aria-hidden="true" size={20} />{t('home.serverFail')}</span></Notice>
      )}
      {d?.startHere && <StartHere data={d.startHere} />}
      {d?.myTasks && <MyTasksCard data={d.myTasks} />}
      {d?.overdue && <OverdueCard data={d.overdue} />}
      {d?.paymentsDue && <PaymentsCard data={d.paymentsDue} />}
      {d?.budget && <BudgetCard data={d.budget} />}
      {d?.headcount && <HeadcountCard data={d.headcount} />}
      {d?.safety && <SafetyCard data={d.safety} />}
      {d?.recentActivity?.length > 0 && <ActivityCard data={d.recentActivity} />}
      <footer className="flex flex-col gap-1 text-sm text-text-muted" aria-live="polite">
        {q.isSuccess && (
          <span className="inline-flex items-center gap-1"><CircleCheck aria-hidden="true" size={16} className="text-success" />{t('home.serverOk')} · {t('home.updated', { time: formatTime(new Date(q.dataUpdatedAt)) })}</span>
        )}
        <span>{t('home.welcome', { version: VERSION })}</span>
        <span>{t('home.buildNote')}</span>
      </footer>
      <AddButton onClick={() => setAdding(true)} />
      {adding && <QuickAddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
