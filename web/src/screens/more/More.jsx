// More (DESIGN §4.2): Money (only for people who may see money), Documents, Settings, Install Guide.
import { Link } from 'react-router-dom';
import { IndianRupee, FileText, Settings, Smartphone, ChevronRight } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { t } from '../../i18n/strings.en.js';
import { useSession } from '../../api/session.js';

const ROWS = [
  { to: '/money', label: 'more.money', Icon: IndianRupee, money: true },
  { to: '/documents', label: 'more.documents', Icon: FileText },
  { to: '/settings', label: 'more.settings', Icon: Settings },
  { to: '/install', label: 'more.install', Icon: Smartphone },
];

export default function More() {
  const { permissions } = useSession();
  const rows = ROWS.filter((r) => !r.money || permissions?.money);
  return (
    <Screen title={t('more.title')}>
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">
        {rows.map(({ to, label, Icon }) => (
          <li key={to} className="border-b border-border last:border-b-0">
            <Link to={to} className="flex min-h-16 items-center gap-4 px-4 text-lg">
              <Icon aria-hidden="true" size={24} strokeWidth={2} className="text-primary" />
              <span className="flex-1">{t(label)}</span>
              <ChevronRight aria-hidden="true" size={24} className="text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
