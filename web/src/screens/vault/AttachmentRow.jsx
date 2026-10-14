// One attachment in a list (Vault, workspace sections): picture or icon, ID, title,
// ⭐ and where it is used. Tapping opens it in the Vault.
import { Link } from 'react-router-dom';
import { FileText, Film, Link2, StickyNote, Star, Image as ImageIcon } from 'lucide-react';
import { t } from '../../i18n/strings.en.js';

const ICON = { photo: ImageIcon, video: Film, document: FileText, link: Link2, text: StickyNote };

export function AttachmentThumb({ a, size = 'h-14 w-14' }) {
  const Icon = ICON[a.kind] ?? FileText;
  const isImg = (a.kind === 'photo' || a.file?.mimeType?.startsWith('image/')) && a.fileUrl;
  return isImg
    ? <img src={a.fileUrl} alt="" loading="lazy" decoding="async" className={`${size} shrink-0 rounded-sm bg-surface-2 object-cover`} />
    : <span className={`${size} grid shrink-0 place-items-center rounded-sm bg-surface-2 text-primary`} aria-hidden="true"><Icon size={24} /></span>;
}

export default function AttachmentRow({ a, showPaths = true }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link to={`/vault/${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">
        <AttachmentThumb a={a} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1 text-sm text-text-muted">
            <span className="font-mono">{a.code}</span> · {t(`vault.kinds.${a.kind}`)}
            {a.isFavourite && <Star aria-label={t('vault.favourite')} size={14} className="fill-current text-warning" />}
          </span>
          <span className="truncate font-bold">{a.title}</span>
          {showPaths && (
            <span className="truncate text-sm text-text-muted">{(a.usedIn ?? []).length ? a.usedIn.map((u) => u.path).join(' · ') : t('vault.notLinked')}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
