// Activity feed (FEATURES A5): every change in plain sentences. Admins only.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../components/Screen.jsx';
import HistoryList from '../../components/HistoryList.jsx';
import { api } from '../../api/client.js';
import { t } from '../../i18n/strings.en.js';

export default function Activity() {
  const [user, setUser] = useState('');
  const members = useQuery({ queryKey: ['members'], queryFn: () => api('GET', '/members').then((r) => r.data) });
  return (
    <Screen title={t('activity.title')} back="/settings">
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t('activity.person')}</span>
        <select value={user} onChange={(e) => setUser(e.target.value)} className="tap rounded-sm border-[1.5px] border-border-strong bg-surface px-3 text-base text-text">
          <option value="">{t('activity.everyone')}</option>
          {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <HistoryList path="/activity" query={user ? { user } : {}} emptyText={t('activity.empty')} />
    </Screen>
  );
}
