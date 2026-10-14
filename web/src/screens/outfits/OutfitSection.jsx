// Outfit cards on a workspace page (1.0.18): one card per outfit (cover picture, timeline
// progress) and + Add. Bride / Groom outfit sections; 1.0.19: Family outfits (four groups)
// and the decor items in Theme & decoration use the same cards.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Shirt, Flower2 } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { NameSheet } from './OutfitDetail.jsx';
import { t } from '../../i18n/strings.en.js';

/** Cards for one person (or 'decor') with + Add; `heading` is the group's title (h2 or h3). */
export function OutfitCards({ ws, person, heading, level = 2, headingId, addLabel = t('outfit.add'), nameLabel = t('outfit.nameLabel'), none = t('outfit.none') }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const outfits = (ws.outfits ?? []).filter((o) => o.person === person);
  const H = level === 2 ? 'h2' : 'h3';
  const Icon = person === 'decor' ? Flower2 : Shirt;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <H id={headingId} className={level === 2 ? 'text-lg font-bold' : 'font-bold'}>{heading}</H>
        <Button variant="secondary" needsInternet onClick={() => setAdding(true)} aria-label={level === 3 ? `${addLabel}: ${heading}` : undefined}><Plus aria-hidden="true" size={20} />{addLabel}</Button>
      </div>
      {outfits.length === 0 && <p className="text-text-muted">{none}</p>}
      {outfits.length > 0 && (
        <ul className="flex flex-col gap-2">
          {outfits.map((o) => {
            const done = o.steps.filter((s) => s.done).length;
            const last = [...o.steps].reverse().find((s) => s.done);
            return (
              <li key={o.id}>
                <Link to={`/outfits/${o.id}`} className="flex items-center gap-3 rounded-md border border-border p-2">
                  {o.coverUrl
                    ? <img src={o.coverUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-sm object-cover" />
                    : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-sm bg-surface-2 text-primary" aria-hidden="true"><Icon size={26} /></span>}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">{o.title}</span>
                    <span className="text-sm text-text-muted">{last ? last.name : t('outfit.notDone')} · {t('outfit.stepsDone', { done, total: o.steps.length })}{o.vendor ? ` · ${o.vendor.name}` : ''}</span>
                    <span className="flex gap-0.5" aria-hidden="true">{o.steps.map((s) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${s.done ? 'bg-success' : 'bg-border'}`} />)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {adding && <NameSheet title={addLabel} label={nameLabel} onClose={() => setAdding(false)}
        onSave={async (name) => {
          const res = await withRelogin(() => api('POST', '/outfits', { body: { workspaceId: ws.id, person, title: name }, idemKey: newIdemKey() }));
          qc.invalidateQueries({ queryKey: ['workspace'] });
          navigate(`/outfits/${res.data.id}`);
        }} />}
    </div>
  );
}

export default function OutfitSection({ ws, sectionKey, person, title }) {
  return (
    <section id={sectionKey} aria-labelledby={`ws-${sectionKey}`} className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card">
      <OutfitCards ws={ws} person={person} heading={title} headingId={`ws-${sectionKey}`} />
    </section>
  );
}

const FAMILY = ['close_female', 'close_male', 'extended_female', 'extended_male'];

/** Family outfits (1.0.19): close / extended family, female / male — each group with its own outfits. */
export function FamilySection({ ws, title }) {
  return (
    <section id="family_outfit" aria-labelledby="ws-family_outfit" className="flex flex-col gap-4 rounded-md bg-surface p-4 shadow-card">
      <h2 id="ws-family_outfit" className="text-lg font-bold">{title}</h2>
      {FAMILY.map((p) => (
        <div key={p} className="border-t border-border pt-3">
          <OutfitCards ws={ws} person={p} heading={t(`outfit.persons.${p}`)} level={3} nameLabel={t('outfit.familyName')} />
        </div>
      ))}
    </section>
  );
}
