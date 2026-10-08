import { Link } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import { t } from '../i18n/strings.en.js';

export default function NotFound() {
  return (
    <Screen title={t('notFound.title')} back>
      <p className="text-lg">{t('notFound.body')}</p>
      <Link to="/" className="tap inline-flex items-center justify-center rounded-md bg-primary px-5 font-bold text-on-primary">
        {t('notFound.home')}
      </Link>
    </Screen>
  );
}
