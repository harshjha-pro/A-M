// Documents — empty Release 1 page (Session 1). Filled in by its own build session.
import { FileText } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { t } from '../../i18n/strings.en.js';

export default function Documents() {
  return (
    <Screen title={t('documents.title')} back="/more">
      <EmptyState Icon={FileText} text={t('documents.empty')} />
    </Screen>
  );
}
