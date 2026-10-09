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
  if (q.isPending || !form.editing) return <Screen title={t('members.title')} back="/settings/members"><p aria-busy="true">…</p></Screen>;

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
