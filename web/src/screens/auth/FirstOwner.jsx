// /setup — first run only: create the Owner with the SETUP_TOKEN from private/.env (API.md §3.2).
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setupOwner } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { TextField, PhoneField, PasswordField, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { t } from '../../i18n/strings.en.js';

export default function FirstOwner() {
  const navigate = useNavigate();
  const [f, setF] = useState({ setupToken: '', name: '', phone: '', password: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFields({});
    setError(null);
    try {
      await setupOwner(f);
      navigate('/settings/wedding', { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) setFields(err.fields);
      else if (err.status === 410) setDone(true);
      else setError(err.status === 403 ? t('errors.server') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-safe py-8">
      <h1 className="text-2xl font-bold">{t('setup.title')}</h1>
      {done ? (
        <>
          <Notice kind="info">{t('setup.done')}</Notice>
          <Link to="/login" className="tap inline-flex items-center justify-center rounded-md bg-primary px-5 font-bold text-on-primary">{t('login.submit')}</Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p>{t('setup.intro')}</p>
          <FixSummary fields={fields} />
          {error && <Notice kind="danger">{error}</Notice>}
          <PasswordField label={t('setup.token')} value={f.setupToken} onChange={set('setupToken')} autoComplete="off" />
          <TextField label={t('setup.name')} value={f.name} onChange={set('name')} error={fields.name} autoComplete="name" />
          <PhoneField label={t('login.phone')} value={f.phone} onChange={set('phone')} error={fields.phone} />
          <PasswordField label={t('login.password')} help={t('setPassword.rules')} value={f.password} onChange={set('password')} error={fields.password} autoComplete="new-password" />
          <Button type="submit" loading={busy} loadingLabel={t('setup.busy')}>{t('setup.submit')}</Button>
        </form>
      )}
    </main>
  );
}
