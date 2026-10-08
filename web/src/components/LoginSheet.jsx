// Login sheet over a form (FEATURES A0, DESIGN S43): the login ended while
// someone was typing. They log in here; the form underneath keeps its text
// and the save is tried once more with the same Idempotency-Key.
import { useEffect, useRef } from 'react';
import { useLoginRequest, finishLoginRequest } from '../api/session.js';
import LoginForm from '../screens/auth/LoginForm.jsx';
import { t } from '../i18n/strings.en.js';

export default function LoginSheet() {
  const req = useLoginRequest();
  const ref = useRef(null);
  useEffect(() => { if (req) ref.current?.focus(); }, [req]);
  if (!req) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <section role="dialog" aria-modal="true" aria-labelledby="login-sheet-title" className="flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-xl bg-surface p-5 pb-safe shadow-sheet">
        <h2 id="login-sheet-title" ref={ref} tabIndex={-1} className="text-xl font-bold">{t('login.sheetTitle')}</h2>
        <p>{t('login.sheetBody')}</p>
        <LoginForm initialPhone={req.phone} onDone={() => { finishLoginRequest(true); window.dispatchEvent(new Event('am:relogin')); }}>
          <button type="button" className="tap rounded-md border-[1.5px] border-border-strong bg-surface px-5" onClick={() => finishLoginRequest(false)}>
            {t('login.cancel')}
          </button>
        </LoginForm>
      </section>
    </div>
  );
}
