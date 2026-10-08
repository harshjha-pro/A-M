// Settings — empty Release 1 page (Session 1). Filled in by its own build session.
import { Settings as SettingsIcon } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Settings() {
  return (
    <Screen title={t('settings.title')} back="/more">
      <EmptyState Icon={SettingsIcon} text={t('settings.empty')} />
    </Screen>
  );
}
