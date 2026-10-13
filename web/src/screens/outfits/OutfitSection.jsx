// Bride outfit / Groom outfit section on a workspace page (1.0.18): one card per outfit
// (cover picture, timeline progress) and + Add outfit.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Shirt } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { NameSheet } from './OutfitDetail.jsx';
import { t } from '../../i18n/strings.en.js';

export default function OutfitSection({ ws, sectionKey, person, title }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const outfits = (ws.outfits ?? []).filter((o) => o.person === person);
  return (
    <section id={sectionKey} aria-labelledby={`ws-${sectionKey}`} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`ws-${sectionKey}`} className="text-lg font-bold">{title}</h2>
        <Button variant="secondary" needsInternet onClick={() => setAdding(true)}><Plus aria-hidden="true" size={20} />{t('outfit.add')}</Button>
      </div>
      {outfits.length === 0 && <p className="text-text-muted">{t('outfit.none')}</p>}
      <ul className="flex flex-col gap-2">
        {outfits.map((o) => {
          const done = o.steps.filter((s) => s.done).length;
          const last = [...o.steps].reverse().find((s) => s.done);
          return (
            <li key={o.id}>
              <Link to={`/outfits/${o.id}`} className="flex items-center gap-3 rounded-md border border-border p-2">
                {o.coverUrl
                  ? <img src={o.coverUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-sm object-cover" />
                  : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-sm bg-surface-2 text-primary" aria-hidden="true"><Shirt size={26} /></span>}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-bold">{o.title}</span>
                  <span className="text-sm text-text-muted">{last ? last.name : t('outfit.notDone')} · {t('outfit.stepsDone', { done, total: o.steps.length })}</span>
                  <span className="flex gap-0.5" aria-hidden="true">{o.steps.map((s) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${s.done ? 'bg-success' : 'bg-border'}`} />)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {adding && <NameSheet title={t('outfit.add')} label={t('outfit.nameLabel')} onClose={() => setAdding(false)}
        onSave={async (name) => {
          const res = await withRelogin(() => api('POST', '/outfits', { body: { workspaceId: ws.id, person, title: name }, idemKey: newIdemKey() }));
          qc.invalidateQueries({ queryKey: ['workspace'] });
          navigate(`/outfits/${res.data.id}`);
        }} />}
    </section>
  );
}
