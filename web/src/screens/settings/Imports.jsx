// Settings → Imports (FEATURES A8; Ayush and Mahi): past imports with their counts and
// "Undo this import" (no 10-minute limit; families changed since are kept).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { showToast } from '../../undo/undoStore.js';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

const fileLabel = (imp) => imp.fileName || (imp.source === 'paste' ? t('import.paste') : imp.source === 'vcf' ? 'Contacts' : 'List');

export default function Imports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['imports'], queryFn: () => api('GET', '/imports').then((r) => r.data) });
  const [asking, setAsking] = useState(null);

  async function undo(imp) {
    setAsking(null);
    try {
      const res = await withRelogin(() => api('POST', `/imports/${imp.id}/undo`, { body: {}, idemKey: newIdemKey() }));
      showToast(res.data.message);
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['households'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch (e) {
      showToast(e.message || t('errors.server'));
    }
  }

  return (
    <Screen title={t('imports.title')} back="/settings">
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{q.error.message || t('errors.loadFailed')}</Notice>}
      {q.isSuccess && q.data.length === 0 && <EmptyState Icon={Upload} text={t('imports.empty')} />}
      {q.data?.length > 0 && (
        <ul className="flex flex-col gap-3">
          {q.data.map((imp) => (
            <li key={imp.id} className="flex flex-col gap-2 rounded-md bg-surface p-4 shadow-card">
              <p className="text-lg font-bold break-words">{fileLabel(imp)}</p>
              <p>{t('imports.line', { created: imp.createdCount, updated: imp.updatedCount, skipped: imp.skippedCount + imp.errorCount })}</p>
              <p className="text-sm text-text-muted">{t('imports.by', { name: imp.createdBy?.name ?? '', when: formatDateTime(imp.createdAt) })}</p>
              {imp.undoneAt
                ? <p className="font-bold text-text-muted">{t('imports.undone', { when: formatDateTime(imp.undoneAt) })}</p>
                : <Button variant="secondary" onClick={() => setAsking(imp)}>{t('imports.undo')}</Button>}
            </li>
          ))}
        </ul>
      )}
      {asking && <ConfirmDialog title={t('imports.confirm')} body={t('imports.confirmBody')} confirmLabel={t('imports.undo')} danger onConfirm={() => undo(asking)} onCancel={() => setAsking(null)} />}
    </Screen>
  );
}
