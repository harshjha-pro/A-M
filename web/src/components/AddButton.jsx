// + button (DESIGN §4.3): 64 px maroon circle, bottom-right above the nav. Hidden for Viewers.
import { Plus } from 'lucide-react';
import { useSession } from '../api/session.js';
import { t } from '../i18n/strings.en.js';

export default function AddButton({ onClick, label = t('tasks.add') }) {
  const { permissions } = useSession();
  if (!permissions?.edit) return null;
  return (
    <button
      type="button" onClick={onClick} aria-label={label}
      className="tap fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom)+var(--am-update-h,0px)+var(--am-install-h,0px))] right-[calc(1.25rem+env(safe-area-inset-right))] z-20 flex size-14 sm:size-16 items-center justify-center rounded-full bg-[#861C32] text-white shadow-xl shadow-[#861C32]/35 active:scale-95 hover:scale-105 transition-all"
    >
      <Plus aria-hidden="true" size={28} strokeWidth={2.5} />
    </button>
  );
}
