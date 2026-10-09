// Move date (DESIGN §6.3): Tomorrow · Next Monday · Pick date. A later date counts
// as a postpone on the server (History: "Postponed from 12 Oct to 19 Oct").
import { useState } from 'react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import { addDays, nextMonday } from '../../components/DateField.jsx';
import { todayIst, formatDateOnly } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export default function PostponeSheet({ task, onPick, onClose, saving }) {
  const today = todayIst();
  const [picked, setPicked] = useState('');
  const from = task.dueDate && task.dueDate > today ? task.dueDate : today;
  const options = [
    { label: t('tasks.tomorrow'), v: addDays(today, 1) },
    { label: t('tasks.nextMonday'), v: nextMonday(today) },
  ];
  return (
    <Sheet title={t('tasks.moveDate')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <Button key={o.label} variant="secondary" disabled={saving} onClick={() => onPick(o.v)} className="justify-between">
            <span>{o.label}</span><span className="text-text-muted">{formatDateOnly(o.v)}</span>
          </Button>
        ))}
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t('tasks.pickDate')}</span>
          <input type="date" min={today} value={picked || from} onChange={(e) => setPicked(e.target.value)}
            className="tap w-full rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text" />
        </label>
        <Button disabled={saving || !picked} onClick={() => onPick(picked)}>{t('tasks.moveDate')}</Button>
      </div>
    </Sheet>
  );
}
