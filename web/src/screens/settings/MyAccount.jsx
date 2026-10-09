// My account (FEATURES B10): name, password, colours, my phones, log out.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, PasswordField, ChoiceChips, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { countDrafts } from '../../forms/drafts.js';
import { api } from '../../api/client.js';
import { ValidationError, ConflictError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { logout, logoutEverywhere, changePassword, loadSession } from '../../api/auth.js';
import { useSave } from '../../forms/useSave.js';
import { getTheme, setTheme } from '../../pwa/theme.js';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const themeOptions = ['follow', 'light', 'dark'].map((v) => ({ value: v, label: t(`account.themes.${v}`) }));

export default function MyAccount() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const me = useQuery({ queryKey: ['member', user.id], queryFn: () => api('GET', `/members/${user.id}`).then((r) => r.data) });
  const phones = useQuery({ queryKey: ['me', 'sessions'], queryFn: () => api('GET', '/me/sessions').then((r) => r.data) });
  const [name, setName] = useState(null);
  const [nameErr, setNameErr] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwFields, setPwFields] = useState({});
  const [pwDone, setPwDone] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const [confirm, setConfirm] = useState(null);
  const drafts = confirm ? countDrafts(user?.id) : 0;
  const draftWarning = drafts === 0 ? null : drafts === 1 ? t('draft.logoutOne') : t('draft.logout', { n: drafts }); // FEATURES A3
  const saveName = useSave();
  const savePw = useSave();

  useEffect(() => { if (me.data && name === null) setName(me.data.name); }, [me.data, name]);

  async function submitName(e) {
    e.preventDefault();
    setNameErr(null);
    try {
      const res = await saveName.run((idemKey) => api('PATCH', `/members/${user.id}`, { body: { name }, ifMatch: me.data.version, idemKey }));
      qc.setQueryData(['member', user.id], res.data);
      await loadSession();
    } catch (err) {
      if (err instanceof ValidationError) setNameErr(err.fields.name);
      else if (err instanceof ConflictError) qc.setQueryData(['member', user.id], { ...me.data, ...err.current });
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setPwFields({});
    setPwDone(false);
    try {
      await savePw.run((idemKey) => changePassword(pw.current, pw.next, idemKey));
      setPw({ current: '', next: '' });
      setPwDone(true);
      qc.invalidateQueries({ queryKey: ['me', 'sessions'] });
    } catch (err) {
      if (err instanceof ValidationError) setPwFields(err.fields);
    }
  }

  async function doLogout(all) {
    setConfirm(null);
    await (all ? logoutEverywhere() : logout()).catch(() => {});
    qc.clear();
    navigate('/login', { replace: true });
  }

  return (
    <Screen title={t('account.title')} back="/settings">
      <form onSubmit={submitName} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card" noValidate>
        <TextField label={t('account.name')} value={name ?? ''} onChange={setName} error={nameErr} disabled={!me.data} />
        <SavedIndicator {...saveName} />
        <Button type="submit" variant="secondary" loading={saveName.status === 'saving'} disabled={!me.data || name === me.data?.name}>{t('account.saveName')}</Button>
      </form>

      <form onSubmit={submitPassword} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card" noValidate>
        <h2 className="text-lg font-bold">{t('account.changePassword')}</h2>
        <FixSummary fields={pwFields} />
        {pwDone && <Notice kind="success">{t('account.passwordChanged')}</Notice>}
        <PasswordField label={t('account.current')} value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} error={pwFields.currentPassword} />
        <PasswordField label={t('account.newPassword')} help={t('setPassword.rules')} value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} error={pwFields.newPassword} autoComplete="new-password" />
        <Button type="submit" variant="secondary" loading={savePw.status === 'saving'} disabled={!pw.current || !pw.next}>{t('account.savePassword')}</Button>
      </form>

      <section className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
        <ChoiceChips label={t('account.theme')} options={themeOptions} value={theme} onChange={(v) => { setTheme(v); setThemeState(v); }} />
      </section>

      <section className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
        <h2 className="text-lg font-bold">{t('account.phones')}</h2>
        <ul className="flex flex-col gap-2">
          {(phones.data ?? []).map((s, i) => (
            <li key={i} className="flex flex-col">
              <span className="font-bold">{s.deviceLabel || '—'}{s.current ? ` · ${t('account.thisPhone')}` : ''}</span>
              <span className="text-sm text-text-muted">{formatDateTime(s.lastUsedAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="danger" onClick={() => setConfirm('one')}>{t('account.logout')}</Button>
      <Button variant="danger" onClick={() => setConfirm('all')}>{t('account.logoutAll')}</Button>
      {confirm && (
        <ConfirmDialog
          title={t(confirm === 'all' ? 'account.confirmLogoutAll' : 'account.confirmLogout')}
          body={[t(confirm === 'all' ? 'account.confirmLogoutAllBody' : 'account.confirmLogoutBody'), draftWarning].filter(Boolean).join(' ')}
          confirmLabel={t(confirm === 'all' ? 'account.logoutAll' : 'account.logout')}
          danger
          onConfirm={() => doLogout(confirm === 'all')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Screen>
  );
}
