// Guests — empty Release 1 page (Session 1). Filled in by its own build session.
import { Users } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Guests() {
  return (
    <Screen title={t('guests.title')}>
      <EmptyState Icon={Users} text={t('guests.empty')} />
    </Screen>
  );
}
