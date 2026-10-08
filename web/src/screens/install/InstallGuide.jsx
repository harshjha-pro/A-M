// InstallGuide — empty Release 1 page (Session 1). Filled in by its own build session.
import { Smartphone } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function InstallGuide() {
  return (
    <Screen title={t('install.title')} back="/more">
      <EmptyState Icon={Smartphone} text={t('install.empty')} />
    </Screen>
  );
}
