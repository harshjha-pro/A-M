// Add or edit a member (FEATURES B1, API.md §6.2). Admins only (the server checks).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import { TextField, PhoneField, PasswordField, ChoiceChips, Toggle, FixSummary, Notice } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import SavedIndicator from '../../components/SavedIndicator.jsx';
import SecretCard from '../../components/SecretCard.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { api } from '../../api/client.js';
import { ValidationError, DuplicateError, ConflictError, ForbiddenError } from '../../api/errors.js';
import { useSession } from '../../api/session.js';
import { useSave } from '../../forms/useSave.js';
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

function EditMember({ id }) {
  const qc = useQueryClient();
  const { user, permissions } = useSession();
  const q = useQuery({ queryKey: ['member', id], queryFn: () => api('GET', `/members/${id}`).then((r) => r.data) });
  const [f, setF] = useState(null);
  const [fields, setFields] = useState({});
  const [notice, setNotice] = useState(null);
  const [resetMode, setResetMode] = useState('link');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [secret, setSecret] = useState(null);
  const save = useSave();
  const reset = useSave();
  const loaded = useRef(false);

  useEffect(() => {
    if (q.data && !loaded.current) {
      loaded.current = true;
      setF({ name: q.data.name, phone: q.data.phone, role: q.data.role, canSeeMoney: q.data.canSeeMoney, accessEndsOn: q.data.accessEndsOn ?? '', isActive: q.data.isActive });
    }
  }, [q.data]);

  if (q.isPending || !f) return <Screen title={t('members.title')} back="/settings/members"><p aria-busy="true">…</p></Screen>;
  if (q.isError) return <Screen title={t('members.title')} back="/settings/members"><Notice kind="danger">{t('errors.loadFailed')}</Notice></Screen>;

  const m = q.data;
  const self = m.id === user?.id;
  const owner = m.role === 'owner';
  const lockedAccess = owner || self;
  const canReset = permissions?.admin && !self && !(owner && !permissions.owner);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  async function submit(e) {
    e.preventDefault();
    setFields({});
    setNotice(null);
    const body = {};
    for (const k of ['name', 'phone', 'role', 'canSeeMoney', 'isActive']) if (f[k] !== m[k]) body[k] = f[k];
    if ((f.accessEndsOn || null) !== (m.accessEndsOn ?? null)) body.accessEndsOn = f.accessEndsOn || null;
    if (Object.keys(body).length === 0) return;
    try {
      const res = await save.run((idemKey) => api('PATCH', `/members/${id}`, { body, ifMatch: m.version, idemKey }));
      qc.setQueryData(['member', id], res.data);
      qc.invalidateQueries({ queryKey: ['members'] });
      loaded.current = false;
      if (body.isActive === false) setNotice(t('members.deactivated'));
    } catch (err) {
      if (err instanceof ConflictError) {
        setNotice(err.message);
        qc.setQueryData(['member', id], { ...m, ...err.current });
        loaded.current = false;
      } else if (err instanceof ForbiddenError) setNotice(err.message);
      else setFields(errorsFrom(err));
    }
  }

  async function doReset() {
    setConfirmReset(false);
    try {
      const body = resetMode === 'set' ? { mode: 'set', password: resetPassword } : { mode: resetMode };
      const res = await reset.run((idemKey) => api('POST', `/members/${id}/password-reset`, { body, idemKey }));
      setSecret({ password: res.data.passwordOnce, link: res.data.setupLink });
      setResetPassword('');
    } catch (err) {
      setFields(errorsFrom(err));
    }
  }

  return (
    <Screen title={m.name} back="/settings/members">
      {notice && <Notice kind="warning">{notice}</Notice>}
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
