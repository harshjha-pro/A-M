// Money — empty Release 1 page (Session 1). Filled in by its own build session.
import { IndianRupee } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Money() {
  return (
    <Screen title={t('money.title')} back="/more">
      <EmptyState Icon={IndianRupee} text={t('money.empty')} />
    </Screen>
  );
}
