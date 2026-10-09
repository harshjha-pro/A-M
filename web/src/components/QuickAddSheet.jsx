// Quick Add (FEATURES A1, DESIGN §4.3): the + on Home opens a sheet with the kinds
// this person may add. Session 5 has Task; guests, payments and documents join later.
import { useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { t } from '../i18n/strings.en.js';

export default function QuickAddSheet({ onClose }) {
  const navigate = useNavigate();
  return (
    <Sheet title={t('quickAdd.title')} onClose={onClose}>
      <ul className="flex flex-col gap-2">
        <li>
          <button type="button" onClick={() => navigate('/tasks/new')} className="tap flex w-full items-center gap-3 rounded-md border-[1.5px] border-border px-4 text-lg">
            <ListChecks aria-hidden="true" size={24} className="text-primary" /> {t('quickAdd.task')}
          </button>
        </li>
      </ul>
      <p className="mt-4 text-sm text-text-muted">{t('quickAdd.soon')}</p>
    </Sheet>
  );
}
