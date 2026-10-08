// The phone + password form, used by the Log in screen and the login sheet.
import { useState } from 'react';
import { PhoneField, PasswordField, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { login } from '../../api/auth.js';
import { loginErrorText } from './loginErrors.js';
import { t } from '../../i18n/strings.en.js';

export default function LoginForm({ initialPhone = '', notice = null, onDone, children }) {
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
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
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {notice && <Notice kind="info">{notice}</Notice>}
      {error && <Notice kind="danger">{error}</Notice>}
      {!online && <Notice kind="info">{t('login.offline')}</Notice>}
      <PhoneField label={t('login.phone')} help={t('login.phoneHelp')} value={phone} onChange={setPhone} autoComplete="username" required />
      <PasswordField label={t('login.password')} value={password} onChange={setPassword} required />
      <Button type="submit" loading={busy} loadingLabel={t('login.busy')} disabled={!online}>{t('login.submit')}</Button>
      {children}
    </form>
  );
}
