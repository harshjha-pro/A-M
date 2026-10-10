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
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom)+var(--am-update-h,0px)+var(--am-install-h,0px))] right-[calc(1rem+env(safe-area-inset-right))] z-20 flex size-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-fab active:scale-95"
    >
      <Plus aria-hidden="true" size={30} strokeWidth={2.5} />
    </button>
  );
}
