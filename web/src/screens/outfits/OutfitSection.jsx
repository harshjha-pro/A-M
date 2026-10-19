// Outfit cards on a workspace page (1.0.18): one card per outfit (cover picture, timeline
// progress) and + Add. Bride / Groom outfit sections; 1.0.19: Family outfits (four groups)
// and the decor items in Theme & decoration use the same cards.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Shirt, Flower2, Sparkles, Users } from 'lucide-react';
import Button from '../../components/Button.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { NameSheet } from './OutfitDetail.jsx';
import { t } from '../../i18n/strings.en.js';

const DEFAULT_STEPS = {
  bride: '0 of 5',
  groom: '0 of 2',
  close_female: '0 of 4',
  close_male: '0 of 4',
  extended_female: '0 of 6',
  extended_male: '0 of 6',
  decor: '0 of 4',
};

function getPersonIcon(person) {
  if (person === 'bride') {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FBEAEB] text-[#861C32]" aria-hidden="true">
        <Sparkles size={20} />
      </span>
    );
  }
  if (person === 'groom') {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-[#1D4ED8]" aria-hidden="true">
        <Shirt size={20} />
      </span>
    );
  }
  if (person === 'close_female' || person === 'extended_female') {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FAF5FF] text-[#7E22CE]" aria-hidden="true">
        <Users size={20} />
      </span>
    );
  }
  if (person === 'close_male' || person === 'extended_male') {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ECFDF5] text-[#047857]" aria-hidden="true">
        <Users size={20} />
      </span>
    );
  }
  if (person === 'decor') {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FEF3C7] text-[#B45309]" aria-hidden="true">
        <Flower2 size={20} />
      </span>
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-primary" aria-hidden="true">
      <Shirt size={20} />
    </span>
  );
}

/** Cards for one person (or 'decor') with + Add; `heading` is the group's title (h2 or h3). */
export function OutfitCards({ ws, person, heading, level = 2, headingId, addLabel = t('outfit.add'), nameLabel = t('outfit.nameLabel'), none = t('outfit.none') }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const outfits = (ws.outfits ?? []).filter((o) => o.person === person);
  const H = level === 2 ? 'h2' : 'h3';
  const Icon = person === 'decor' ? Flower2 : Shirt;

  const doneCount = outfits.reduce((acc, o) => acc + o.steps.filter((s) => s.done).length, 0);
  const totalCount = outfits.reduce((acc, o) => acc + o.steps.length, 0);
  const stepSubtitle = totalCount > 0 ? `${doneCount} of ${totalCount}` : (DEFAULT_STEPS[person] || '0 of 4');

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {getPersonIcon(person)}
          <div className="flex min-w-0 flex-1 flex-col">
            <H id={headingId} className="truncate font-bold text-gray-900 text-base">
              {heading}
            </H>
            <span className="text-xs text-text-muted">
              {stepSubtitle}
            </span>
          </div>
        </div>

        {person !== 'decor' && (
          <Button
            variant="secondary"
            needsInternet
            onClick={() => setAdding(true)}
            aria-label={level === 3 ? `${addLabel}: ${heading}` : undefined}
            className="rounded-full bg-[#FBEAEB] border border-[#F5C2C7] text-[#861C32] px-3.5 py-1.5 text-xs font-semibold shadow-xs hover:bg-[#F5D5D8] transition active:scale-95 shrink-0"
          >
            <Plus aria-hidden="true" size={15} />
            {addLabel}
          </Button>
        )}
      </div>

      {person === 'decor' && (
        <Button
          variant="secondary"
          needsInternet
          onClick={() => setAdding(true)}
          aria-label={level === 3 ? `${addLabel}: ${heading}` : undefined}
          className="w-full rounded-full bg-[#FBEAEB] border border-[#F5C2C7] text-[#861C32] py-2.5 text-sm font-semibold shadow-xs hover:bg-[#F5D5D8] transition active:scale-95 flex items-center justify-center gap-1.5 mt-1"
        >
          <Plus aria-hidden="true" size={17} />
          {addLabel}
        </Button>
      )}

      {outfits.length === 0 && <p className="text-xs text-text-muted pl-1">{none}</p>}

      {outfits.length > 0 && (
        <ul className="flex flex-col gap-2 mt-1">
          {outfits.map((o) => {
            const done = o.steps.filter((s) => s.done).length;
            const last = [...o.steps].reverse().find((s) => s.done);
            return (
              <li key={o.id}>
                <Link
                  to={`/outfits/${o.id}`}
                  className="flex items-center gap-3 rounded-xl border border-black/5 bg-surface-2/40 hover:bg-surface-2/70 p-2.5 transition-all shadow-xs"
                >
                  {o.coverUrl ? (
                    <img src={o.coverUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary" aria-hidden="true">
                      <Icon size={24} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold text-sm text-gray-900">{o.title}</span>
                    <span className="text-xs text-text-muted truncate">
                      {last ? last.name : t('outfit.notDone')} · {t('outfit.stepsDone', { done, total: o.steps.length })}
                      {o.vendor ? ` · ${o.vendor.name}` : ''}
                    </span>
                    <span className="flex gap-1" aria-hidden="true">
                      {o.steps.map((s) => (
                        <span key={s.id} className={`h-1.5 flex-1 rounded-full ${s.done ? 'bg-success' : 'bg-border'}`} />
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <NameSheet
          title={addLabel}
          label={nameLabel}
          onClose={() => setAdding(false)}
          onSave={async (name) => {
            const res = await withRelogin(() =>
              api('POST', '/outfits', { body: { workspaceId: ws.id, person, title: name }, idemKey: newIdemKey() })
            );
            qc.invalidateQueries({ queryKey: ['workspace'] });
            navigate(`/outfits/${res.data.id}`);
          }}
        />
      )}
    </div>
  );
}

export default function OutfitSection({ ws, sectionKey, person, title }) {
  return (
    <section id={sectionKey} aria-labelledby={`ws-${sectionKey}`} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border border-black/5">
      <OutfitCards ws={ws} person={person} heading={title} headingId={`ws-${sectionKey}`} />
    </section>
  );
}

const FAMILY = ['close_female', 'close_male', 'extended_female', 'extended_male'];

/** Family outfits (1.0.19): close / extended family, female / male — each group with its own outfits. */
export function FamilySection({ ws, title }) {
  return (
    <section id="family_outfit" aria-labelledby="ws-family_outfit" className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-black/5">
      <h2 id="ws-family_outfit" className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="flex flex-col divide-y divide-gray-100">
        {FAMILY.map((p) => (
          <div key={p} className="py-3 first:pt-0 last:pb-0">
            <OutfitCards ws={ws} person={p} heading={t(`outfit.persons.${p}`)} level={3} nameLabel={t('outfit.familyName')} />
          </div>
        ))}
      </div>
    </section>
  );
}
