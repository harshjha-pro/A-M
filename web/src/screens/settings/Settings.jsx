// Settings (FEATURES B10): wedding details, members, my account, install guide, about.
// Admins also get Safety, Activity, Deleted items and Imports (FEATURES A5, A8, B9, B10).
import { Link } from 'react-router-dom';
import { CalendarHeart, Users, UserRound, Smartphone, ChevronRight, ShieldCheck, Activity, Trash2, Upload, FileDown, TabletSmartphone } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { useSession } from '../../api/session.js';
import { t } from '../../i18n/strings.en.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export default function Settings() {
  const { user, permissions } = useSession();
  const rows = [
    { to: '/settings/wedding', label: 'settings.wedding', Icon: CalendarHeart },
    { to: '/settings/members', label: 'settings.members', Icon: Users },
    { to: '/settings/account', label: 'settings.account', Icon: UserRound },
    ...(permissions?.admin ? [
      { to: '/settings/safety', label: 'settings.safety', Icon: ShieldCheck },
      { to: '/settings/activity', label: 'settings.activity', Icon: Activity },
      { to: '/settings/deleted', label: 'settings.trash', Icon: Trash2 },
      { to: '/settings/imports', label: 'settings.imports', Icon: Upload },
      { to: '/settings/export', label: 'settings.export', Icon: FileDown },
    ] : []),
    { to: '/settings/phone', label: 'settings.phone', Icon: TabletSmartphone },
    { to: '/install', label: 'settings.install', Icon: Smartphone },
  ];
  return (
    <Screen title={t('settings.title')} back="/more">
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">
        {rows.map(({ to, label, Icon }) => (
          <li key={to} className="border-b border-border last:border-b-0">
            <Link to={to} className="flex min-h-16 items-center gap-4 px-4 text-lg">
              <Icon aria-hidden="true" size={24} className="text-primary" />
              <span className="flex-1">{t(label)}</span>
              <ChevronRight aria-hidden="true" size={24} className="text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-1 text-text-muted">
        <h2 className="font-bold text-text">{t('settings.about')}</h2>
        {user && <p>{t('settings.signedInAs', { name: user.name })}</p>}
        <p>{t('settings.version', { version: VERSION })}</p>
      </section>
    </Screen>
  );
}
