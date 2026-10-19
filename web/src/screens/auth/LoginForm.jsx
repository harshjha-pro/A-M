// LoginForm.jsx — Glassmorphism login form matching A&M Wedding Planner reference.
import { useState } from 'react';
import { Phone, LockKeyhole, ArrowRight } from 'lucide-react';
import { login } from '../../api/auth.js';
import { loginErrorText } from './loginErrors.js';
import { t } from '../../i18n/strings.en.js';

export function AlertBanner({ kind = 'danger', message }) {
  if (!message) return null;
  const str = String(message).trim();

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex w-full items-start gap-3.5 rounded-2xl border border-[#F3B8C1] bg-[#FDE8EB]/95 p-3.5 shadow-sm backdrop-blur-sm"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#8A1C2B] text-sm font-bold text-white shadow-sm">
        !
      </div>
      <div className="my-auto h-9 w-[1px] shrink-0 self-stretch bg-[#E8A5B0]" />
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold leading-snug text-[#8A1C2B]">
          {str}
        </span>
      </div>
    </div>
  );
}

export default function LoginForm({ initialPhone = '', notice = null, onDone, children }) {
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;

  async function submit(e) {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError(t('login.empty'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
      onDone?.();
    } catch (err) {
      setError(loginErrorText(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 text-left" noValidate>
      {notice && <AlertBanner kind="info" message={notice} />}
      {error && <AlertBanner kind="danger" message={error} />}
      {!online && <AlertBanner kind="info" message={t('login.offline')} />}

      {/* Phone number field */}
      <div className="flex flex-col">
        <label
          htmlFor="login-phone"
          className="mb-1.5 block text-sm font-bold text-[#2A1F1A]"
        >
          {t('login.phone')}
        </label>
        <div className="group relative flex min-h-[3.5rem] w-full items-center rounded-2xl border border-white/85 bg-white/85 px-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-sm transition-all focus-within:border-[#8A1C2B] focus-within:ring-2 focus-within:ring-[#8A1C2B]/15">
          <Phone
            aria-hidden="true"
            size={20}
            className="mr-3 shrink-0 text-[#8A1C2B]"
          />
          <input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98290 00001"
            required
            className="tap w-full bg-transparent text-base text-[#2A1F1A] placeholder:text-[#9E8E89] focus:outline-none"
          />
        </div>
        <p id="login-phone-help" className="mt-1.5 pl-1 text-xs text-[#7A6A65]">
          {t('login.phoneHelp')}
        </p>
      </div>

      {/* Password field */}
      <div className="flex flex-col">
        <label
          htmlFor="login-password"
          className="mb-1.5 block text-sm font-bold text-[#2A1F1A]"
        >
          {t('login.password')}
        </label>
        <div className="group relative flex min-h-[3.5rem] w-full items-center rounded-2xl border border-white/85 bg-white/85 px-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-sm transition-all focus-within:border-[#8A1C2B] focus-within:ring-2 focus-within:ring-[#8A1C2B]/15">
          <LockKeyhole
            aria-hidden="true"
            size={20}
            className="mr-3 shrink-0 text-[#8A1C2B]"
          />
          <input
            id="login-password"
            type={shown ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck="false"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="tap w-full bg-transparent text-base text-[#2A1F1A] placeholder:text-[#9E8E89] focus:outline-none"
          />
          <div className="mx-2 h-6 w-[1px] shrink-0 bg-[#D4C3BD]" />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-pressed={shown}
            aria-label={shown ? t('hide') : t('show')}
            className="tap shrink-0 rounded-sm px-2 text-sm font-bold text-[#8A1C2B] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A1C2B] focus-visible:ring-offset-1"
          >
            {shown ? t('hide') : t('show')}
          </button>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-2">
        <button
          type="submit"
          disabled={!online || busy}
          aria-busy={busy || undefined}
          className="group relative flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#63141F] via-[#851928] to-[#63141F] px-8 text-white shadow-[0_10px_25px_rgba(133,25,40,0.35)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_12px_28px_rgba(133,25,40,0.45)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A1C2B] focus-visible:ring-offset-2"
        >
          <span className="text-lg font-bold tracking-wide">
            {busy ? t('login.busy') : t('login.submit')}
          </span>
          <span className="absolute right-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-0.5">
            {busy ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <ArrowRight size={18} className="text-white" />
            )}
          </span>
        </button>
      </div>

      {/* Footer helper text or custom children */}
      {children ? (
        <div className="mt-1 flex flex-col items-center justify-center">{children}</div>
      ) : (
        <p className="mt-2 text-center text-sm text-[#7A6A65]">
          {t('login.help')}
        </p>
      )}
    </form>
  );
}
