// More (DESIGN §4.2): Money*, Documents, Settings, Install Guide.
// * Money will only show for people who may see it (Session 2 adds roles).
import { Link } from 'react-router-dom';
import { IndianRupee, FileText, Settings, Smartphone, ChevronRight } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import { t } from '../../i18n/strings.en.js';

const ROWS = [
  { to: '/money', label: 'more.money', Icon: IndianRupee },
  { to: '/documents', label: 'more.documents', Icon: FileText },
  { to: '/settings', label: 'more.settings', Icon: Settings },
  { to: '/install', label: 'more.install', Icon: Smartphone },
];

export default function More() {
  return (
    <Screen title={t('more.title')}>
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">
        {ROWS.map(({ to, label, Icon }) => (
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
