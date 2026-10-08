// Members (FEATURES B1): WhatsApp-style rows. Admins add and open members;
// family and viewers see names and phones only (the server sends nothing more).
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { Notice } from '../../components/Field.jsx';
import { api } from '../../api/client.js';
import { useSession } from '../../api/session.js';
import { formatPhone } from '../../format/phone.js';
import { formatDateTime } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function initials(name) {
  const parts = String(name).replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Members() {
  const { permissions, user } = useSession();
  const admin = Boolean(permissions?.admin);
  const q = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data) });

  return (
    <Screen title={t('members.title')} back="/settings">
      {admin && (
        <Link to="/settings/members/new" className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary">
          <UserPlus aria-hidden="true" size={22} /> {t('members.add')}
        </Link>
      )}
      {q.isPending && <p aria-busy="true">…</p>}
      {q.isError && <Notice kind="danger">{t('errors.loadFailed')}</Notice>}
      {q.data && q.data.length <= 1 && <EmptyState Icon={Users} text={t('members.empty')} />}
      {q.data && (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {q.data.map((m) => {
            const inner = (
              <>
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{initials(m.name)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-bold">{m.name}{m.left ? ` ${t('members.left')}` : ''}{m.id === user?.id ? ' ✓' : ''}</span>
                  <span className="text-sm text-text-muted">
                    {t(`members.roles.${m.role}`)} · {formatPhone(m.phone)}
                    {admin && (m.lastSeenAt ? ` · ${t('members.lastSeen', { when: formatDateTime(m.lastSeenAt) })}` : ` · ${t('members.never')}`)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={m.id} className="border-b border-border last:border-b-0">
                {admin || m.id === user?.id
                  ? <Link to={m.id === user?.id && !admin ? '/settings/account' : `/settings/members/${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">{inner}</Link>
                  : <div className="flex min-h-16 items-center gap-3 px-4 py-2">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
