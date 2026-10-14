// Add or edit a workspace (1.0.17): name and the calendar event it is for (optional).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { showToast } from '../../undo/undoStore.js';
import { t } from '../../i18n/strings.en.js';

export default function WorkspaceSheet({ workspace = null, onClose, onSaved }) {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api('GET', '/events').then((r) => r.data), staleTime: 60_000 });
  const [name, setName] = useState(workspace?.name ?? '');
  const [eventId, setEventId] = useState(workspace?.event?.id ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { setErrors({ name: t('errors.required') }); return; }
    setBusy(true);
    try {
      const body = {};
      if (!workspace || name.trim() !== workspace.name) body.name = name.trim();
      if (!workspace || (eventId || null) !== (workspace.event?.id ?? null)) body.eventId = eventId || null;
      const res = workspace
        ? (Object.keys(body).length ? await withRelogin(() => api('PATCH', `/workspaces/${workspace.id}`, { body, ifMatch: workspace.version, idemKey: newIdemKey() })) : { data: workspace })
        : await withRelogin(() => api('POST', '/workspaces', { body, idemKey: newIdemKey() }));
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.invalidateQueries({ queryKey: ['workspace'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields); else showToast(e.message || t('errors.server'));
    } finally { setBusy(false); }
  }

  return (
    <Sheet title={workspace ? t('workspace.edit') : t('workspace.add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label={t('workspace.name')} value={name} onChange={setName} error={errors.name} maxLength={80} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('workspace.event')}</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
            <option value="">{t('workspace.noEvent')}</option>
            {(events.data ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          {errors.eventId && <span className="text-sm text-danger">{errors.eventId}</span>}
        </label>
        <Button needsInternet onClick={save} loading={busy}>{t('workspace.save')}</Button>
      </div>
    </Sheet>
  );
}
