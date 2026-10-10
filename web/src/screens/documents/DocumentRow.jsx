// One document in a list: lazy thumbnail for photos, a file icon for PDFs; title,
// type · links · date; a lock for private ones (FEATURES B7: thumbnails lazy-load).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Lock } from 'lucide-react';
import { isImageDoc } from '../../data/documents.js';
import { formatDate } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function Thumb({ doc, size = 56 }) {
  const [broken, setBroken] = useState(false); // a photo that won't load shows the file icon
  if (isImageDoc(doc) && !broken) {
    return <img src={doc.fileUrl} alt="" loading="lazy" decoding="async" width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} className="shrink-0 rounded-sm bg-bg object-cover" />;
  }
  return <span aria-hidden="true" style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary"><FileText size={28} /></span>;
}

export function docLine(d) {
  const linked = [d.vendor?.name, d.event?.name].filter(Boolean).join(' · ');
  return [t(`documents.types.${d.type}`), linked, formatDate(d.createdAt)].filter(Boolean).join(' · ');
}

export default function DocumentRow({ doc }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link to={`/documents/${doc.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">
        <Thumb doc={doc} />
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 break-words text-lg font-bold">
            {doc.isPrivate && <Lock aria-label={t('documents.privateShort')} size={16} className="shrink-0 text-text-muted" />}
            {doc.title}
          </span>
          <span className="text-sm text-text-muted">{docLine(doc)}</span>
        </span>
      </Link>
    </li>
  );
}
