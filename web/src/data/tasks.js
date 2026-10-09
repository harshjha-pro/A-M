// Task helpers shared by the list, detail and form (FEATURES B3).
import { formatDateOnly, formatHhmm } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

export const VIEWS = ['mine', 'all', 'today', 'week', 'overdue', 'no_date', 'closed'];

/** "Sat, 10 Oct 2026, 6:00 PM IST" or "No date". */
export function dueText(task) {
  if (!task.dueDate) return t('tasks.noDate');
  return task.dueTime ? `${formatDateOnly(task.dueDate)}, ${formatHhmm(task.dueTime)} IST` : formatDateOnly(task.dueDate);
}

/** wa.me link for "Task to assignee" (FEATURES A7). */
export function waLink(phone, task) {
  const text = task.dueDate
    ? t('tasks.waText', { task: task.title, date: dueText(task) })
    : t('tasks.waNoDate', { task: task.title });
  return `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export const isClosed = (task) => task.status === 'done' || task.status === 'cancelled';
