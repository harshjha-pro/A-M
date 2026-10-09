// Guest helpers shared by the list, family page, form and reminder stepper (FEATURES B5, A7).
import { formatDate } from '../format/ist.js';
import { normalizePhone, waDigits } from '../format/phone.js';
import { t } from '../i18n/strings.en.js';

export const SIDES = ['bride', 'groom', 'both'];
export const FOODS = ['veg', 'jain', 'mixed'];
export const RSVPS = ['not_asked', 'waiting', 'coming', 'not_coming'];
export const FILTER_KEYS = ['side', 'event', 'rsvp', 'group', 'area', 'food', 'vip', 'noPhone', 'possibleDuplicates'];

/** "3 people" / "1 person" */
export const peopleText = (n) => (n === 1 ? t('guests.person') : t('guests.people', { n }));

/** A mobile number WhatsApp can open (landlines can't). */
export function mobileOf(family) {
  for (const p of [family.phone, family.altPhone]) {
    const n = p ? normalizePhone(p) : null;
    if (n?.ok && n.kind !== 'landline') return n.e164;
  }
  return null;
}

/** "Ramesh Sharma & family" → "Ramesh Sharma" for "Namaste … ji". */
export function greetName(name) {
  return String(name || '').replace(/\s*(&|and)\s*family$/i, '').replace(/\s+(family|parivar|ji)$/i, '').trim() || name;
}

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode: not remembered */ } }

/** English or Hinglish, picked once and remembered (A7). */
export const getLang = () => (safeGet('am:wa-lang') === 'hi' ? 'hi' : 'en');
export const setLang = (lang) => safeSet('am:wa-lang', lang === 'hi' ? 'hi' : 'en');

/**
 * RSVP reminder (A7): "Namaste {name} ji, we'd love you to join Ayush & Mahi's {events} on {dates} at {venue}. …"
 * @param events the family's invited events (full event objects) in calendar order
 */
export function reminderText(family, events, sender, lang = getLang()) {
  const names = events.map((e) => e.name);
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${lang === 'hi' ? 'aur' : 'and'} ${names[names.length - 1]}`;
  const dates = [...new Set(events.filter((e) => e.startAt).map((e) => formatDate(e.startAt)))];
  const venues = [...new Set(events.map((e) => e.venueName).filter(Boolean))];
  return t(`guests.waText.${lang}`, {
    name: greetName(family.name),
    events: list,
    dates: dates.length ? dates.join(', ') : t('guests.datesTbd'),
    venue: venues.length ? venues.join(', ') : t('guests.venueTbd'),
    sender: sender || '',
  });
}

export const waUrl = (phone, text) => `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;

/** Filters are remembered per user (B5). */
export function loadFilters(userId) {
  try { return JSON.parse(safeGet(`am:guest-filters:${userId}`) || '{}') || {}; } catch { return {}; }
}
export function saveFilters(userId, filters) {
  safeSet(`am:guest-filters:${userId}`, JSON.stringify(filters));
}

/** Sticky side and area for the next family added (B5 defaults). */
export function loadSticky() {
  try { return JSON.parse(safeGet('am:guest-sticky') || '{}') || {}; } catch { return {}; }
}
export function saveSticky(v) { safeSet('am:guest-sticky', JSON.stringify({ side: v.side, area: v.area })); }

/** API query from the filter state (camelCase; the client converts keys). */
export function listQuery(filters, q) {
  const out = { q };
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v === true) out[k] = 'true';
    else if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); }
    else if (v) out[k] = v;
  }
  if (!out.event) delete out.rsvp;
  return out;
}
