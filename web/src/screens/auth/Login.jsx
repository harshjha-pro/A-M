// Log in (DESIGN S02): phone, password with Show, one big button. No sign-up.
import { useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import LoginForm from './LoginForm.jsx';
import Florals from '../../components/Florals.jsx';
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
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 overflow-hidden px-safe py-10">
      <Florals corner="tl" size={170} className="-left-6 -top-4" />
      <Florals corner="tr" size={130} className="-right-4 -top-2" />
      <Florals corner="bl" size={150} className="-bottom-4 -left-6" />
      <Florals corner="br" size={190} className="-bottom-6 -right-6" />
      <div className="relative flex flex-col items-center text-center">
        <p aria-hidden="true" className="inline-flex items-center gap-1 font-display text-5xl leading-none text-primary">A&amp;M<Heart size={22} className="fill-current" /></p>
        <h1 aria-label={t('appName')} className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-text-muted">{t('home.logoSub')}</h1>
        <p className="mt-6 font-display text-[2.25rem] leading-none text-text">{t('login.welcome')}</p>
        <p className="mt-1 text-text-muted">{t('login.tagline')}</p>
      </div>
      <h2 className="sr-only">{t('login.title')}</h2>
      <LoginForm notice={notice?.startsWith('login.') ? null : notice} onDone={() => navigate(next, { replace: true })}>
        <p className="text-center text-text-muted">{t('login.help')}</p>
      </LoginForm>
    </main>
  );
}

/** Only our own paths: never an open redirect. */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : '/';
}
