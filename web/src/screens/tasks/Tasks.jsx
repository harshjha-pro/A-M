// Tasks — empty Release 1 page (Session 1). Filled in by its own build session.
import { ListChecks } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Tasks() {
  return (
    <Screen title={t('tasks.title')}>
      <EmptyState Icon={ListChecks} text={t('tasks.empty')} />
    </Screen>
  );
}
