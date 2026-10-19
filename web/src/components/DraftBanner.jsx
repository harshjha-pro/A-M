// "You have unsaved changes from 10:42. [Use them] [Discard]" (FEATURES A3).
import { PencilLine } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export default function DraftBanner({ time, onUse, onDiscard }) {
  return (
    <div role="status" className="flex flex-col gap-3.5 rounded-2xl bg-[#FFF6EE] border border-[#FED7AA] p-4 shadow-2xs">
      <p className="flex items-center gap-2 text-stone-800 text-sm font-semibold">
        <PencilLine aria-hidden="true" size={18} className="text-[#EA580C] shrink-0" />
        <span>{t('draft.banner', { time })}</span>
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="tap flex-1 rounded-full bg-[#861C32] hover:bg-[#6e1628] py-2.5 px-5 font-bold text-sm text-white shadow-xs active:scale-95 transition-all text-center"
          onClick={onUse}
        >
          {t('draft.use')}
        </button>
        <button
          type="button"
          className="tap flex-1 rounded-full border border-stone-200 bg-white hover:bg-stone-50 py-2.5 px-5 font-bold text-sm text-stone-700 shadow-2xs active:scale-95 transition-all text-center"
          onClick={onDiscard}
        >
          {t('draft.discard')}
        </button>
      </div>
    </div>
  );
}
