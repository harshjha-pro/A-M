// Bottom nav (DESIGN §4.2): Home · Calendar · Tasks · Guests · More.
// Labels always visible; active item = soft pill + bold + aria-current
// (never colour alone). Tapping the active item scrolls to the top.
import { NavLink, useLocation } from 'react-router-dom';
import { House, CalendarDays, ListChecks, Users, Menu } from 'lucide-react';
import { t } from '../i18n/strings.en.js';

export const NAV_ITEMS = [
  { to: '/', label: 'nav.home', Icon: House, end: true },
  { to: '/calendar', label: 'nav.calendar', Icon: CalendarDays },
  { to: '/tasks', label: 'nav.tasks', Icon: ListChecks },
  { to: '/guests', label: 'nav.guests', Icon: Users },
  { to: '/more', label: 'nav.more', Icon: Menu },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={(e) => {
                const active = end ? pathname === to : pathname.startsWith(to);
                if (active) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
              }}
              className="tap flex h-16 flex-col items-center justify-center gap-0.5 text-sm text-text-muted"
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-primary-soft text-primary' : ''}`}>
                    <Icon aria-hidden="true" size={26} strokeWidth={2} />
                  </span>
                  <span className={isActive ? 'font-bold text-text' : ''}>{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
