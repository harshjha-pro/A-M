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
    <main className="relative mx-auto flex min-h-dvh w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-6 bg-[#FAF6F0] transition-colors duration-500">
      {/* Ambient soft blush & warm glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, rgba(247, 215, 220, 0.65) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(247, 215, 220, 0.65) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(247, 215, 220, 0.65) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(247, 215, 220, 0.65) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(254, 243, 230, 0.5) 0%, transparent 60%)',
        }}
      />

      {/* Floating subtle rose petals in the background edges */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {[
          { top: '16%', left: '8%', delay: '0s', dur: '5.2s', size: 9 },
          { top: '22%', left: '88%', delay: '1.4s', dur: '6.1s', size: 11 },
          { top: '78%', left: '10%', delay: '0.8s', dur: '5.8s', size: 8 },
          { top: '74%', left: '90%', delay: '2.2s', dur: '6.4s', size: 10 },
        ].map((p, i) => (
          <span
            key={i}
            className="am-petal-drift absolute rounded-full opacity-0 motion-reduce:hidden"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size * 0.7,
              backgroundColor: '#D27B89',
              boxShadow: '0 0 6px rgba(210, 123, 137, 0.4)',
              animationDelay: p.delay,
              animationDuration: p.dur,
              transform: 'rotate(-20deg)',
            }}
          />
        ))}
      </div>

      {/* Golden bokeh sparkles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {[
          { top: '12%', left: '20%', size: 5, color: '#E8A317', opacity: 0.4 },
          { top: '14%', left: '78%', size: 4, color: '#E8A317', opacity: 0.38 },
          { top: '30%', left: '6%', size: 6, color: '#E8A317', opacity: 0.3 },
          { top: '33%', left: '92%', size: 5, color: '#E8A317', opacity: 0.35 },
          { top: '80%', left: '18%', size: 5, color: '#E8A317', opacity: 0.38 },
          { top: '82%', left: '82%', size: 6, color: '#E8A317', opacity: 0.4 },
        ].map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              backgroundColor: s.color,
              opacity: s.opacity,
              boxShadow: `0 0 8px ${s.color}`,
            }}
          />
        ))}
      </div>

      {/* Corner florals positioned at edges, away from form */}
      <Florals corner="tl" size={190} className="-left-6 -top-6 sm:-left-4 sm:-top-4 opacity-90 transition-transform duration-700 hover:scale-105" />
      <Florals corner="tr" size={150} className="-right-4 -top-4 sm:-right-2 sm:-top-2 opacity-90 transition-transform duration-700 hover:scale-105" />
      <Florals corner="bl" size={170} className="-left-6 -bottom-6 sm:-left-4 sm:-bottom-4 opacity-90 transition-transform duration-700 hover:scale-105" />
      <Florals corner="br" size={210} className="-right-6 -bottom-6 sm:-right-4 sm:-bottom-4 opacity-90 transition-transform duration-700 hover:scale-105" />

      {/* Main Content Area */}
      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
        {/* Header: Monogram, Subtitle, Welcome Back */}
        <div className="mb-5 flex flex-col items-center text-center">
          {/* A&M Monogram with Gold Floral Flourish */}
          <div className="relative mb-2 flex flex-col items-center">
            <img
              src="/art/loading-monogram.png"
              alt="A&M Monogram"
              width={160}
              height={96}
              className="h-16 w-auto object-contain drop-shadow-[0_2px_8px_rgba(201,168,106,0.3)] transition-transform duration-500 hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
              }}
            />
            <div style={{ display: 'none' }} className="flex-col items-center">
              <span className="font-display text-4xl font-bold tracking-widest text-[#8A1C2B]">
                A&amp;M
              </span>
              <div className="mt-1 h-[1.5px] w-14 bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent" />
            </div>
          </div>

          {/* WEDDING PLANNER */}
          <h1
            aria-label={t('appName')}
            className="text-[0.72rem] font-bold uppercase tracking-[0.26em] text-[#9E7D47]"
          >
            {t('home.logoSub')}
          </h1>

          {/* Welcome back */}
          <h2 className="mt-4 font-display text-[2.6rem] font-bold leading-tight tracking-[0.01em] text-[#4A0E17] sm:text-5xl">
            {t('login.welcome')}
          </h2>

          {/* Plan your beautiful tomorrow */}
          <p className="mt-1.5 text-base text-[#7A6A65]">
            {t('login.tagline')}
          </p>
        </div>

        <h2 className="sr-only">{t('login.title')}</h2>

        {/* Glassmorphic Form Card */}
        <div className="glass-card w-full rounded-[2rem] border border-white/70 bg-white/45 p-6 shadow-[0_20px_50px_rgba(138,28,43,0.08),inset_0_1px_2px_rgba(255,255,255,0.7)] backdrop-blur-xl sm:p-8">
          <LoginForm
            notice={notice?.startsWith('login.') ? null : notice}
            onDone={() => navigate(next, { replace: true })}
          />
        </div>
      </div>
    </main>
  );
}

/** Only our own paths: never an open redirect. */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : '/';
}
