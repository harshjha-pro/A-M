// One calendar line (FEATURES B4): each type has its own icon AND word, never colour alone.
import { Link } from 'react-router-dom';
import {
  PartyPopper,
  ListChecks,
  IndianRupee,
  TriangleAlert,
  ChevronRight,
  CalendarDays,
  Mail,
  Gift,
  Phone,
  Shirt,
  Camera,
  UtensilsCrossed,
  Music,
  Sparkles,
} from 'lucide-react';
import { timeLabel, formatDateOnly, formatTime, phoneIsInIndia } from '../../format/ist.js';
import { t } from '../../i18n/strings.en.js';

export function getItemIcon(item) {
  if (item.type === 'payment') return IndianRupee;
  if (item.type === 'event') return PartyPopper;

  const title = (item.title || '').toLowerCase();
  if (
    title.includes('call') ||
    title.includes('phone') ||
    title.includes('talk') ||
    title.includes('contact') ||
    title.includes('ring') ||
    title.includes('mama') ||
    title.includes('chacha') ||
    title.includes('bua') ||
    title.includes('fufa') ||
    title.includes('mausa')
  ) {
    return Phone;
  }
  if (
    title.includes('shagun') ||
    title.includes('envelope') ||
    title.includes('gift') ||
    title.includes('present') ||
    title.includes('mithai') ||
    title.includes('sweet') ||
    title.includes('box') ||
    title.includes('token')
  ) {
    return Gift;
  }
  if (
    title.includes('invit') ||
    title.includes('card') ||
    title.includes('mail') ||
    title.includes('send') ||
    title.includes('whatsapp') ||
    title.includes('msg') ||
    title.includes('message') ||
    title.includes('rsvp') ||
    title.includes('letter')
  ) {
    return Mail;
  }
  if (
    title.includes('sherwani') ||
    title.includes('fitting') ||
    title.includes('outfit') ||
    title.includes('dress') ||
    title.includes('cloth') ||
    title.includes('lehenga') ||
    title.includes('suit') ||
    title.includes('saree') ||
    title.includes('pagri') ||
    title.includes('safa')
  ) {
    return Shirt;
  }
  if (
    title.includes('photo') ||
    title.includes('camera') ||
    title.includes('video') ||
    title.includes('shoot') ||
    title.includes('film') ||
    title.includes('album')
  ) {
    return Camera;
  }
  if (
    title.includes('cater') ||
    title.includes('menu') ||
    title.includes('food') ||
    title.includes('dinner') ||
    title.includes('lunch') ||
    title.includes('breakfast') ||
    title.includes('tasting') ||
    title.includes('snack') ||
    title.includes('chaat')
  ) {
    return UtensilsCrossed;
  }
  if (
    title.includes('music') ||
    title.includes('dj') ||
    title.includes('sound') ||
    title.includes('dance') ||
    title.includes('song') ||
    title.includes('band') ||
    title.includes('dhol') ||
    title.includes('choreograph')
  ) {
    return Music;
  }
  if (
    title.includes('decor') ||
    title.includes('flower') ||
    title.includes('stage') ||
    title.includes('light') ||
    title.includes('jewel') ||
    title.includes('gold') ||
    title.includes('makeup') ||
    title.includes('mehendi') ||
    title.includes('mehndi') ||
    title.includes('parlor') ||
    title.includes('beauty')
  ) {
    return Sparkles;
  }
  return ListChecks;
}

export function itemArt(item) {
  if (item.coverUrl || item.imageUrl) return item.coverUrl || item.imageUrl;
  const title = (item.title || '').toLowerCase();
  if (title.includes('outfit') || title.includes('trial') || title.includes('sherwani') || title.includes('lehenga') || title.includes('dress') || title.includes('fitting')) {
    return '/art/outfit.webp';
  }
  if (title.includes('engage') || title.includes('ring') || title.includes('sagai')) return '/art/engagement.webp';
  if (title.includes('haldi') || title.includes('ban')) return '/art/haldi.webp';
  if (title.includes('mehndi') || title.includes('mehendi')) return '/art/mehndi.webp';
  if (title.includes('sangeet') || title.includes('music') || title.includes('dj') || title.includes('dance')) return '/art/sangeet.webp';
  if (title.includes('mayra') || title.includes('mamera') || title.includes('bhaat')) return '/art/mayra.webp';
  if (title.includes('roka') || title.includes('tilak')) return '/art/roka.webp';
  if (title.includes('reception')) return '/art/reception.webp';
  if (title.includes('wedding') || title.includes('phere') || title.includes('shaadi') || title.includes('varmala')) return '/art/wedding.webp';
  if (title.includes('venue') || title.includes('decor') || title.includes('stage') || title.includes('flower') || title.includes('meeting')) {
    return '/art/welcome-couple-clean.webp';
  }
  if (title.includes('cater') || title.includes('food') || title.includes('dinner') || title.includes('tasting')) return '/art/haldi.webp';
  if (title.includes('horse') || title.includes('ghodi') || title.includes('baraat')) return '/art/horse-groom.png';
  if (title.includes('invit') || title.includes('card')) return '/art/one-journey-script.png';
  return '/art/other.webp';
}

export function formatItemTime(item) {
  if (item.start_at && item.end_at && !item.all_day) {
    try {
      const s = formatTime(item.start_at);
      const e = formatTime(item.end_at);
      const tz = phoneIsInIndia() ? '' : ' IST';
      return `${s} – ${e}${tz}`;
    } catch {
      // fall through
    }
  }
  if (item.time) {
    return timeLabel(item.time);
  }
  if (item.type === 'event') {
    return t('calendar.allDay');
  }
  return '';
}

export function itemSubtitle(item) {
  if (item.venue_name || item.venueName) return item.venue_name || item.venueName;
  if (item.notes) return item.notes;
  const linked = item.linkedEvent || item.linked_event;
  if (linked?.name) return linked.name;
  if (item.dress_code || item.dressCode) return item.dress_code || item.dressCode;
  return null;
}

const KIND = {
  event: { to: (i) => `/calendar/events/${i.id}` },
  task: { to: (i) => `/tasks/${i.id}` },
  payment: { to: () => '/money' },
};

/* Month View: Day Card Row */
export function ItemRow({ item }) {
  const k = KIND[item.type] || KIND.task;
  const Icon = getItemIcon(item);
  const timeStr = item.time ? timeLabel(item.time) : item.type === 'event' ? t('calendar.allDay') : '';
  const linked = item.linkedEvent || item.linked_event;

  return (
    <li className="last:border-b-0">
      <Link
        to={k.to(item)}
        className="group flex min-h-16 items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-black/[0.02] transition-colors"
      >
        <span
          className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-full bg-[#E5EEF5] text-[#204970] shadow-xs"
          aria-hidden="true"
        >
          <Icon size={20} className="stroke-[1.8]" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-[15px] sm:text-base font-bold text-stone-900 group-hover:text-[#861C32] transition-colors">
            {item.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500 mt-0.5 leading-normal">
            <span className="font-semibold text-stone-600">
              {t(`calendar.type.${item.type}`)}
            </span>
            {timeStr && (
              <>
                <span className="text-stone-400 select-none">·</span>
                <span>{timeStr}</span>
              </>
            )}
            {item.overdue && (
              <>
                <span className="text-stone-400 select-none">·</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#C23B38]">
                  <TriangleAlert aria-hidden="true" size={13} className="stroke-[2.5]" />
                  <span>{t('tasks.overdue')}</span>
                </span>
              </>
            )}
            {linked && (
              <>
                <span className="text-stone-400 select-none">·</span>
                <span className="truncate max-w-[150px] text-stone-600">
                  {linked.name}{linked.deleted ? ' (deleted event)' : ''}
                </span>
              </>
            )}
            {item.workspace && (
              <>
                <span className="text-stone-400 select-none">·</span>
                <span className="rounded-full bg-[#861C32]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#861C32]">
                  {t('workspace.badge')}
                </span>
              </>
            )}
          </span>
        </span>

        <ChevronRight
          aria-hidden="true"
          size={18}
          className="text-stone-400 shrink-0 stroke-[2] group-hover:text-stone-600 group-hover:translate-x-0.5 transition-all"
        />
      </Link>
    </li>
  );
}

/* Month View: Day Card */
export function DayList({ day }) {
  return (
    <section
      className="flex flex-col overflow-hidden rounded-[1.75rem] bg-white/80 backdrop-blur-xl border border-stone-200/60 shadow-lg shadow-stone-900/5 transition-all"
      aria-label={formatDateOnly(day.date)}
    >
      <div className="bg-[#861C32] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-2.5 text-white shadow-xs">
        <CalendarDays size={20} className="text-white/95 shrink-0 stroke-[2]" aria-hidden="true" />
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-normal font-sans">
          {formatDateOnly(day.date)}
        </h2>
      </div>

      <ul className="bg-[#FAF7F2]/90 divide-y divide-stone-200/70">
        {day.items.map((i) => <ItemRow key={`${i.type}-${i.id}`} item={i} />)}
      </ul>
    </section>
  );
}

export function UndatedList({ events }) {
  if (!events?.length) return null;
  return (
    <section
      className="flex flex-col overflow-hidden rounded-[1.75rem] bg-white/80 backdrop-blur-xl border border-stone-200/60 shadow-lg shadow-stone-900/5 transition-all"
    >
      <div className="bg-[#861C32] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center gap-2.5 text-white shadow-xs">
        <CalendarDays size={20} className="text-white/95 shrink-0 stroke-[2]" aria-hidden="true" />
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-normal font-sans">
          {t('calendar.dateNotSet')}
        </h2>
      </div>

      <ul className="bg-[#FAF7F2]/90 divide-y divide-stone-200/70">
        {events.map((e) => (
          <ItemRow
            key={e.id}
            item={{
              type: 'event',
              id: e.id,
              title: e.name,
              time: null,
              overdue: false,
              linkedEvent: null,
              allDay: true,
              dateNotSet: true,
            }}
          />
        ))}
      </ul>
    </section>
  );
}

/* Agenda View: Timeline Card matching user reference */
export function AgendaCard({ item }) {
  const k = KIND[item.type] || KIND.task;
  const timeStr = formatItemTime(item);
  const sub = itemSubtitle(item);
  const imgUrl = itemArt(item);
  const linked = item.linkedEvent || item.linked_event;

  return (
    <Link
      to={k.to(item)}
      className="group flex items-center gap-3.5 sm:gap-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 p-3 sm:p-3.5 shadow-sm hover:shadow-md hover:border-[#861C32]/30 transition-all min-w-0"
    >
      {/* Thumbnail */}
      <img
        src={imgUrl}
        alt=""
        width={72}
        height={72}
        className="size-16 sm:size-20 rounded-xl sm:rounded-2xl object-cover shrink-0 shadow-2xs border border-stone-200/50"
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* Title */}
        <span className="truncate text-sm sm:text-base font-bold text-stone-900 group-hover:text-[#861C32] transition-colors leading-snug">
          {item.title}
        </span>

        {/* Time */}
        {timeStr && (
          <span className="text-xs sm:text-sm text-stone-600 font-medium mt-0.5">
            {timeStr}
          </span>
        )}

        {/* Subtitle / Venue / Note */}
        {sub && (
          <span className="text-xs text-stone-500 truncate mt-0.5">
            {sub}
          </span>
        )}

        {/* Badges & Type for test/accessibility */}
        <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-stone-500 mt-1">
          <span className="font-semibold text-stone-600">
            {t(`calendar.type.${item.type}`)}
          </span>
          {item.overdue && (
            <>
              <span className="text-stone-400 select-none">·</span>
              <span className="inline-flex items-center gap-1 font-bold text-[#C23B38]">
                <TriangleAlert aria-hidden="true" size={12} className="stroke-[2.5]" />
                <span>{t('tasks.overdue')}</span>
              </span>
            </>
          )}
          {linked && !sub?.includes(linked.name) && (
            <>
              <span className="text-stone-400 select-none">·</span>
              <span className="truncate max-w-[120px]">{linked.name}</span>
            </>
          )}
          {item.workspace && (
            <>
              <span className="text-stone-400 select-none">·</span>
              <span className="rounded-full bg-[#861C32]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#861C32]">
                {t('workspace.badge')}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/* Agenda View: Day Section on the Timeline */
export function AgendaDayList({ day }) {
  return (
    <section
      aria-label={formatDateOnly(day.date)}
      className="relative flex flex-col gap-2.5"
    >
      {/* Node and Date Header on the timeline stem */}
      <div className="flex items-center gap-3 relative z-10 -ml-[5px]">
        <span
          className="size-3 rounded-full bg-[#861C32] ring-4 ring-[#FAF4EC] shrink-0"
          aria-hidden="true"
        />
        <h2 className="text-xs sm:text-sm font-bold text-[#861C32] tracking-tight">
          {formatDateOnly(day.date)}
        </h2>
      </div>

      {/* Cards indented to the right of stem */}
      <div className="flex flex-col gap-3 pl-5 sm:pl-6">
        {day.items.map((i) => (
          <AgendaCard key={`${i.type}-${i.id}`} item={i} />
        ))}
      </div>
    </section>
  );
}

/* Agenda View: Undated Section */
export function AgendaUndatedList({ events }) {
  if (!events?.length) return null;
  return (
    <section className="relative flex flex-col gap-2.5">
      <div className="flex items-center gap-3 relative z-10 -ml-[5px]">
        <span
          className="size-3 rounded-full bg-stone-400 ring-4 ring-[#FAF4EC] shrink-0"
          aria-hidden="true"
        />
        <h2 className="text-xs sm:text-sm font-bold text-stone-600 tracking-tight">
          {t('calendar.dateNotSet')}
        </h2>
      </div>
      <div className="flex flex-col gap-3 pl-5 sm:pl-6">
        {events.map((e) => (
          <AgendaCard
            key={e.id}
            item={{
              type: 'event',
              id: e.id,
              title: e.name,
              time: null,
              overdue: false,
              linkedEvent: null,
              allDay: true,
              dateNotSet: true,
            }}
          />
        ))}
      </div>
    </section>
  );
}
