// Calendar — empty Release 1 page (Session 1). Filled in by its own build session.
import { CalendarDays } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Calendar() {
  return (
    <Screen title={t('calendar.title')}>
      <EmptyState Icon={CalendarDays} text={t('calendar.empty')} />
    </Screen>
  );
}
