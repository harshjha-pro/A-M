// "Documents" on a payment, vendor or event page (FEATURES B7 Links): what is linked,
// and an Add button that opens the upload sheet with that link filled in.
import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Plus } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { useSession } from '../../api/session.js';
import { useLinkedDocuments } from '../../data/documents.js';
import DocumentRow from './DocumentRow.jsx';
import UploadSheet from './UploadSheet.jsx';
import { t } from '../../i18n/strings.en.js';

/**
 * @param {{ link: { payment?: string, vendor?: string, event?: string }, linkLabel: string,
 *           defaultType?: string, title?: string, addLabel?: string }} props
 */
export default function DocumentsSection({ link, linkLabel, defaultType = 'other', title, addLabel }) {
  const { permissions } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const docs = useLinkedDocuments(link);
  const uploadLink = { paymentId: link.payment, vendorId: link.vendor, eventId: link.event };
  const Icon = defaultType === 'receipt' ? Camera : Plus;
  return (
    <section className="flex flex-col gap-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-bold">{title ?? t('documents.title')}</h2>
      {docs.data?.length > 0
        ? <ul className="overflow-hidden rounded-md bg-surface shadow-card">{docs.data.map((d) => <DocumentRow key={d.id} doc={d} />)}</ul>
        : docs.isSuccess && <p className="text-text-muted">{t('documents.noneLinked')}</p>}
      {permissions?.edit && (
        <Button variant="secondary" onClick={() => setOpen(true)}><Icon aria-hidden="true" size={20} />{addLabel ?? t('documents.add')}</Button>
      )}
      {open && (
        <UploadSheet link={uploadLink} linkLabel={linkLabel} defaultType={defaultType} onClose={() => setOpen(false)}
          onUploaded={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
      )}
    </section>
  );
}
