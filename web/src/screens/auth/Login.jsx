// Log in (DESIGN S02): phone, password with Show, one big button. No sign-up.
import { useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import LoginForm from './LoginForm.jsx';
import { useSession } from '../../api/session.js';
import { loadSession } from '../../api/auth.js';
import { t } from '../../i18n/strings.en.js';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const next = safeNext(params.get('next'));
  // Opened /login on a phone that is still logged in (bookmark, Home Screen icon): go straight in.
  useEffect(() => { if (session.status === 'unknown') loadSession().catch(() => {}); }, [session.status]);
  if (session.status === 'in') return <Navigate to={next} replace />;
  const notice = session.reason ? t(`login.ended.${session.reason}`) : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-safe py-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-soft via-accent-soft to-surface-2 p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-full border-[1.5px] border-accent bg-surface font-display text-xl text-primary" aria-hidden="true">A&amp;M</span>
          <div className="min-w-0">
            <p className="font-display text-3xl leading-none text-text">{t('home.coupleNames')}</p>
            <p className="mt-1 text-sm font-bold text-text-muted">{t('home.subtitle').replace(/^[^·]*·\s*/, '')}</p>
          </div>
        </div>
        <h1 className="mt-4 text-lg font-bold">{t('appName')}</h1>
      </div>
      <h2 className="text-[1.625rem] font-bold">{t('login.title')}</h2>
      <LoginForm notice={notice?.startsWith('login.') ? null : notice} onDone={() => navigate(next, { replace: true })}>
        <p className="text-text-muted">{t('login.help')}</p>
      </LoginForm>
    </main>
  );
}

/** Only our own paths: never an open redirect. */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : '/';
}
