// Log in — placeholder until Session 2 (phone + password, API.md §3.3).
import { Link } from 'react-router-dom';
import { t } from '../../i18n/strings.en.js';

export default function Login() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-safe py-safe">
      <h1 className="text-2xl font-bold">{t('login.title')}</h1>
      <p>{t('login.empty')}</p>
      <Link to="/" className="tap inline-flex items-center text-primary underline">{t('notFound.home')}</Link>
    </main>
  );
}
