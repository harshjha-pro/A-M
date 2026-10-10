// Every app screen needs a login. Checks GET /session once on start; the
// server still checks every request (the app only hides).
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../api/session.js';
import { loadSession } from '../api/auth.js';
import { t } from '../i18n/strings.en.js';

export default function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (session.status === 'unknown') loadSession().then(() => setFailed(false)).catch(() => setFailed(true));
  }, [session.status, attempt]);

  if (session.status === 'unknown' && failed) {
    return (
      <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-safe">
        <p className="text-lg">{t('errors.loadFailed')}</p>
        <button type="button" className="tap rounded-md bg-primary px-5 font-bold text-on-primary" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>
          {t('tryAgain')}
        </button>
      </main>
    );
  }
  if (session.status === 'unknown') {
    return <div className="flex min-h-dvh items-center justify-center p-6 text-text-muted" aria-busy="true">{t('appName')}…</div>;
  }
  if (session.status !== 'in') {
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Shows children only for admins / money users. The server enforces it anyway. */
export function OnlyIf({ when, children }) {
  return when ? children : null;
}
