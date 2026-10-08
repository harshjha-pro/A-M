// /set-password#t=… — from an invite or reset link on WhatsApp (API.md §3.5).
// The token is in the #fragment, so it never reaches server logs; it is removed
// from the address bar as soon as it has been read.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { completeLink } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { PasswordField, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { t } from '../../i18n/strings.en.js';

function readToken() {
  const m = /[#&]t=([A-Za-z0-9_-]{40,64})/.exec(window.location.hash);
  return m ? m[1] : null;
}

export default function SetPassword() {
  const navigate = useNavigate();
  const [token] = useState(readToken);
  const [info, setInfo] = useState(null);
  const [state, setState] = useState(token ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, '', window.location.pathname); // hide the token
    api('POST', '/auth/password-link/inspect', { body: { token }, idempotent: false })
      .then((r) => { setInfo(r.data); setState('ready'); })
      .catch(() => setState('invalid'));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await completeLink(token, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) setError(err.fields.newPassword || t('setPassword.rules'));
      else if (err.status === 410) setState('invalid');
      else setError(t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-safe py-8">
      <h1 className="text-2xl font-bold">{t('setPassword.title')}</h1>
      {state === 'checking' && <p aria-busy="true">{t('setPassword.checking')}</p>}
      {state === 'invalid' && <Notice kind="danger">{t('setPassword.invalid')}</Notice>}
      {state === 'ready' && info && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-lg">{t(info.purpose === 'reset' ? 'setPassword.welcomeReset' : 'setPassword.welcome', { name: info.name })}</p>
          <p className="text-text-muted">{t('setPassword.forPhone', { phone: info.phoneMasked })}</p>
          <PasswordField label={t('setPassword.newPassword')} help={t('setPassword.rules')} error={error} value={password} onChange={setPassword} autoComplete="new-password" />
          <Button type="submit" loading={busy} loadingLabel={t('setPassword.busy')} disabled={password.length === 0}>{t('setPassword.submit')}</Button>
        </form>
      )}
    </main>
  );
}
