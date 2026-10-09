// "You have unsaved changes from 10:42. [Use them] [Discard]" (FEATURES A3).
import { PencilLine } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function DraftBanner({ time, onUse, onDiscard }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-md bg-warning-soft p-3">
      <p className="flex items-start gap-2">
        <PencilLine aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-warning" />
        <span>{t('draft.banner', { time })}</span>
      </p>
      <div className="flex gap-3">
        <button type="button" className="tap flex-1 rounded-md bg-primary px-4 font-bold text-on-primary" onClick={onUse}>{t('draft.use')}</button>
        <button type="button" className="tap flex-1 rounded-md border-[1.5px] border-border-strong bg-surface px-4" onClick={onDiscard}>{t('draft.discard')}</button>
      </div>
    </div>
  );
}
