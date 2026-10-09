// Home — placeholder for Session 1: name, version and a live server check.
// The real dashboard cards arrive in Session 7.
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import AddButton from '../../components/AddButton.jsx';
import QuickAddSheet from '../../components/QuickAddSheet.jsx';
import Screen from '../../components/Screen.jsx';
import { api } from '../../api/client.js';
import { t } from '../../i18n/strings.en.js';
import { useSession } from '../../api/session.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export default function Home() {
  const { user } = useSession();
  const [adding, setAdding] = useState(false);
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api('GET', '/health').then((r) => r.data),
    retry: 1,
    staleTime: 30_000,
  });

  let status;
  if (health.isPending) {
    status = <span className="text-text-muted">{t('home.serverChecking')}</span>;
  } else if (health.isSuccess) { // 200: {status: ok} for most people, the full check list for admins (API.md §11)
    status = (
      <span className="inline-flex items-center gap-2 font-bold text-success">
        <CircleCheck aria-hidden="true" size={24} /> {t('home.serverOk')}
      </span>
    );
  } else {
    status = (
      <span className="inline-flex items-center gap-2 font-bold text-danger">
        <TriangleAlert aria-hidden="true" size={24} /> {t('home.serverFail')}
      </span>
    );
  }

  return (
    <Screen title={t('home.title')}>
      <section className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
        {user && <p className="text-lg">{t('home.hello', { name: user.name })}</p>}
        <p className="text-2xl font-bold">{t('home.welcome', { version: VERSION })}</p>
        <p className="text-text-muted">{t('home.subtitle')}</p>
      </section>
      <section className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card" aria-live="polite">
        <h2 className="text-lg font-bold">{t('home.server')}</h2>
        <p>{status}</p>
      </section>
      <p className="text-text-muted">{t('home.buildNote')}</p>
      <AddButton onClick={() => setAdding(true)} />
      {adding && <QuickAddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}
