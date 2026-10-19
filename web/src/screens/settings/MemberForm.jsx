// Add or edit a member (FEATURES B1, API.md §6.2). Admins only (the server checks).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, PhoneField, PasswordField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import SecretCard from '../../components/SecretCard.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { api } from '../../api/client.js';
import { ValidationError, DuplicateError, ForbiddenError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useSave } from '../../forms/useSave.js';
import { useEntityForm } from '../../forms/useEntityForm.js';
import DraftBanner from '../../components/DraftBanner.jsx';
import ConflictScreen from '../../components/ConflictScreen.jsx';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const ROLES = ['partner', 'family', 'viewer'];
const roleOptions = ROLES.map((r) => ({ value: r, label: t(`members.roles.${r}`) }));
const modeOptions = ['link', 'generate', 'set'].map((m) => ({ value: m, label: t(`members.modes.${m}`) }));

function errorsFrom(err) {
  if (err instanceof ValidationError) return err.fields;
  if (err instanceof DuplicateError) return { phone: err.message };
  return {};
}

export default function MemberForm() {
  const { id } = useParams();
  return id ? <EditMember id={id} /> : <AddMember />;
}

function AddMember() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', phone: '', role: 'family', canSeeMoney: false, accessEndsOn: '', passwordMode: 'link', password: '' });
  const [fields, setFields] = useState({});
  const [done, setDone] = useState(null);
  const save = useSave();
  const set = (k) => (v) => setF({ ...f, [k]: v });

  async function submit(e) {
    e.preventDefault();
    setFields({});
    const body = { ...f, accessEndsOn: f.accessEndsOn || null, canSeeMoney: f.role === 'partner' ? true : f.canSeeMoney };
    if (body.passwordMode !== 'set') delete body.password;
    try {
      const res = await save.run((idemKey) => api('POST', '/members', { body, idemKey }));
      qc.invalidateQueries({ queryKey: ['members'] });
      setDone(res.data);
    } catch (err) {
      setFields(errorsFrom(err));
    }
  }

  if (done) {
    return (
      <Screen title={t('members.add')} back="/settings/members">
        <Notice kind="success">{done.member.name} ✓</Notice>
        {(done.passwordOnce || done.setupLink) && (
          <SecretCard member={done.member} password={done.passwordOnce} link={done.setupLink} onDone={() => navigate('/settings/members')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen title={t('members.add')} back="/settings/members">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={fields} />
        <TextField label={t('members.name')} value={f.name} onChange={set('name')} error={fields.name} autoComplete="off" />
        <PhoneField label={t('members.phone')} value={f.phone} onChange={set('phone')} error={fields.phone} autoComplete="off" />
        <ChoiceChips label={t('members.role')} options={roleOptions} value={f.role} onChange={set('role')} error={fields.role} help={t(`members.roleHelp.${f.role}`)} />
        {f.role !== 'partner' && <Toggle label={t('members.money')} help={t('members.moneyHelp')} checked={f.canSeeMoney} onChange={set('canSeeMoney')} />}
        <TextField type="date" label={t('members.endsOn')} help={t('members.endsHelp')} value={f.accessEndsOn} onChange={set('accessEndsOn')} error={fields.accessEndsOn} />
        <ChoiceChips label={t('members.passwordHow')} options={modeOptions} value={f.passwordMode} onChange={set('passwordMode')} error={fields.passwordMode} />
        {f.passwordMode === 'set' && (
          <PasswordField label={t('members.password')} help={t('setPassword.rules')} value={f.password} onChange={set('password')} error={fields.password} autoComplete="new-password" />
        )}
        <SavedIndicator {...save} />
        <Button type="submit" loading={save.status === 'saving'}>{t('members.save')}</Button>
      </form>
    </Screen>
  );
}

const MEMBER_FIELDS = ['name', 'phone', 'role', 'canSeeMoney', 'accessEndsOn', 'isActive'];
const memberForm = (m) => ({ name: m.name, phone: m.phone, role: m.role, canSeeMoney: m.canSeeMoney, accessEndsOn: m.accessEndsOn ?? '', isActive: m.isActive });

function memberShow(field, v) {
  if (field === 'role') return t(`members.roles.${v}`);
  if (field === 'canSeeMoney' || field === 'isActive') return v ? t('yes') : t('no');
  return v;
}

/** "Link open until Sun, 11 Oct, 2:42 PM" · "Link expired …" · "Link used …" · "No link sent" (1.0.24) */
export function linkText(link) {
  if (!link || link.status === 'none') return t('members.access.noLink');
  if (link.status === 'open') return t('members.access.open', { when: formatDateTime(link.expiresAt) });
  if (link.status === 'used') return t('members.access.used', { when: formatDateTime(link.usedAt) });
  return t('members.access.expired', { when: formatDateTime(link.expiresAt) });
}

/** Recent log-ins, phones and password changes (admins, 1.0.24). Loads when opened. */
function AccessHistory({ id }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['member-access', id], queryFn: () => api('GET', `/members/${id}/access`).then((r) => r.data), enabled: open });
  const why = (w) => (w ? t(`members.access.why.${w}`) : '');
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-sm border border-border p-3">
      <summary className="tap cursor-pointer font-bold">{t('members.access.history')}</summary>
      {q.isPending && open && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{t('errors.loadFailed')}</Notice>}
      {q.data && (
        <div className="mt-2 flex flex-col gap-3">
          <section>
            <h3 className="font-bold">{t('members.access.logins')}</h3>
            {q.data.logins.length === 0 ? <p className="text-text-muted">{t('members.never')}</p> : (
              <ul className="text-sm">{q.data.logins.map((l, i) => <li key={i} className={l.ok ? '' : 'text-danger'}>{formatDateTime(l.at)} · {l.ok ? t('members.access.ok') : t('members.access.failed')}</li>)}</ul>
            )}
          </section>
          <section>
            <h3 className="font-bold">{t('members.access.phones')}</h3>
            <ul className="text-sm">{q.data.phones.map((p, i) => (
              <li key={i}>{p.deviceLabel || t('members.access.aPhone')} · {t('members.lastSeen', { when: formatDateTime(p.lastUsedAt) })}{p.loggedOutAt ? ` · ${t('members.access.loggedOut', { when: formatDateTime(p.loggedOutAt) })} ${why(p.why)}` : ''}</li>
            ))}</ul>
          </section>
          <section>
            <h3 className="font-bold">{t('members.access.passwords')}</h3>
            <ul className="text-sm">{q.data.passwords.map((p, i) => <li key={i}>{formatDateTime(p.at)} · {t(`members.access.method.${p.method}`)}{p.by ? ` · ${p.by.name}` : ''}</li>)}</ul>
          </section>
        </div>
      )}
    </details>
  );
}

function EditMember({ id }) {
  const qc = useQueryClient();
  const { user, permissions } = useSession();
  const q = useQuery({ queryKey: ['member', id], queryFn: () => api('GET', `/members/${id}`).then((r) => r.data) });
  const [notice, setNotice] = useState(null);
  const [resetMode, setResetMode] = useState('link');
  const [resetPassword, setResetPassword] = useState('');
  const [resetErrors, setResetErrors] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [secret, setSecret] = useState(null);
  const reset = useSave();
  const m = q.data;

  const form = useEntityForm({
    form: 'member',
    recordId: id,
    record: m,
    fields: MEMBER_FIELDS,
    neverAuto: ['role', 'canSeeMoney', 'isActive'],
    fromServer: memberForm,
    toBody: (keys, v) => Object.fromEntries(keys.map((k) => [k, k === 'accessEndsOn' ? v[k] || null : v[k]])),
    send: (body, version, idemKey) => api('PATCH', `/members/${id}`, { body, ifMatch: version, idemKey }).then((r) => r.data),
    mapError: (err) => (err instanceof DuplicateError ? { phone: err.message } : null),
    onSaved(saved) {
      if (saved) {
        if (m?.isActive && saved.isActive === false) setNotice(t('members.deactivated'));
        qc.setQueryData(['member', id], saved);
      } else {
        qc.invalidateQueries({ queryKey: ['member', id] });
      }
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });

  // This form is always open: start (again) whenever it isn't editing.
  useEffect(() => {
    if (m && !form.editing && !form.conflict) form.start();
  });

  if (q.isError) return <Screen title={t('members.title')} back="/settings/members"><Notice kind="danger">{t('errors.loadFailed')}</Notice></Screen>;
  if (q.isPending || !form.editing) return <Screen title={t('members.title')} back="/settings/members" loading />;

  if (form.conflict) {
    const labels = { name: t('members.name'), phone: t('members.phone'), role: t('members.role'), canSeeMoney: t('members.money'), accessEndsOn: t('members.endsOn'), isActive: t('members.active') };
    return <ConflictScreen conflict={form.conflict} labels={labels} format={memberShow} saving={form.save.status === 'saving'} onSave={form.resolve} onKeepTheirs={form.keepTheirs} />;
  }

  const f = form.values;
  const fields = { ...resetErrors, ...form.fieldErrors };
  const self = m.id === user?.id;
  const owner = m.role === 'owner';
  const lockedAccess = owner || self;
  const canReset = permissions?.admin && !self && !(owner && !permissions.owner);
  const set = form.set;
  const save = form.save;
  const forbidden = save.error instanceof ForbiddenError ? save.error.message : null;

  async function submit(e) {
    setNotice(null);
    await form.submit(e);
  }

  async function doReset() {
    setConfirmReset(false);
    try {
      const body = resetMode === 'set' ? { mode: 'set', password: resetPassword } : { mode: resetMode };
      const res = await reset.run((idemKey) => api('POST', `/members/${id}/password-reset`, { body, idemKey }));
      setSecret({ password: res.data.passwordOnce, link: res.data.setupLink });
      setResetPassword('');
    } catch (err) {
      setResetErrors(errorsFrom(err));
    }
  }

  return (
    <Screen title={m.name} back="/settings/members">
      {form.draft && <DraftBanner time={form.draftTime} onUse={form.useDraft} onDiscard={form.discardDraft} />}
      {(notice || forbidden) && <Notice kind="warning">{notice || forbidden}</Notice>}
      {owner && <p className="text-text-muted">{t('members.ownerNote')}</p>}
      {self && <p className="text-text-muted">{t('members.selfNote')}</p>}
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FixSummary fields={fields} />
        <TextField label={t('members.name')} value={f.name} onChange={set('name')} error={fields.name} />
        <PhoneField label={t('members.phone')} value={f.phone} onChange={set('phone')} error={fields.phone} />
        {!lockedAccess && (
          <>
            <ChoiceChips label={t('members.role')} options={roleOptions} value={f.role} onChange={set('role')} error={fields.role} help={t(`members.roleHelp.${f.role}`)} />
            {f.role !== 'partner' && <Toggle label={t('members.money')} help={t('members.moneyHelp')} checked={f.canSeeMoney} onChange={set('canSeeMoney')} />}
            <TextField type="date" label={t('members.endsOn')} help={t('members.endsHelp')} value={f.accessEndsOn} onChange={set('accessEndsOn')} error={fields.accessEndsOn} />
            <Toggle label={t('members.active')} checked={f.isActive} onChange={set('isActive')} />
          </>
        )}
        <SavedIndicator {...save} />
        <Button type="submit" loading={save.status === 'saving'}>{t('members.saveEdit')}</Button>
      </form>

      {canReset && (
        <section className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
          <h2 className="text-lg font-bold">{t('members.reset')}</h2>
          <p className="text-text-muted">{t('members.resetHelp')}</p>
          {secret ? (
            <SecretCard member={m} password={secret.password} link={secret.link} onDone={() => setSecret(null)} />
          ) : (
            <>
              <ChoiceChips label={t('members.passwordHow')} options={modeOptions} value={resetMode} onChange={setResetMode} />
              {resetMode === 'set' && <PasswordField label={t('members.password')} value={resetPassword} onChange={setResetPassword} error={fields.password} autoComplete="new-password" />}
              <Button variant="danger" onClick={() => setConfirmReset(true)} loading={reset.status === 'saving'}>{t('members.reset')}</Button>
            </>
          )}
        </section>
      )}
      {permissions?.admin && !self && (
        <section aria-labelledby="m-access" className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
          <h2 id="m-access" className="text-lg font-bold">{t('members.access.title')}</h2>
          <p className={m.link?.status === 'expired' ? 'font-bold text-warning' : 'text-text-muted'}>{linkText(m.link)}</p>
          {canReset && ['open', 'expired'].includes(m.link?.status) && !secret && (
            <Button variant="secondary" onClick={() => { setResetMode('link'); setConfirmReset(true); }}>{t('members.access.resend')}</Button>
          )}
          <AccessHistory id={id} />
        </section>
      )}
      {confirmReset && (
        <ConfirmDialog
          title={`${t('members.reset')}: ${m.name}?`}
          body={t('members.resetHelp')}
          confirmLabel={t('members.reset')}
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </Screen>
  );
}
