// Dates and times always in India time (Asia/Kolkata), whatever the phone's zone
// (CONTEXT §8, AC-IND-04). Shown as "Sun, 14 Feb 2027" and "6:00 PM".

const ZONE = 'Asia/Kolkata';

const dateParts = new Intl.DateTimeFormat('en-IN', {
  timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const timeParts = new Intl.DateTimeFormat('en-IN', {
  timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true,
});
const dateOnlyParts = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function pick(fmt, date) {
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Not a date: ${value}`);
  return d;
}

/** A moment (ISO "…Z" from the API) → "Sun, 14 Feb 2027" in IST */
export function formatDate(value) {
  const p = pick(dateParts, toDate(value));
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** A moment → "6:00 PM" in IST */
export function formatTime(value) {
  const p = pick(timeParts, toDate(value));
  return `${p.hour}:${p.minute} ${String(p.dayPeriod).toUpperCase()}`;
}

/** A moment → "Sun, 14 Feb 2027, 6:00 PM IST" */
export function formatDateTime(value) {
  return `${formatDate(value)}, ${formatTime(value)} IST`;
}

/** A calendar date with no zone ("2027-02-14", due dates) → "Sun, 14 Feb 2027". Never shifts a day. */
export function formatDateOnly(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd));
  if (!m) throw new RangeError(`Not a date: ${ymd}`);
  const p = pick(dateOnlyParts, new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)));
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** An IST wall-clock time ("18:00", due_time) → "6:00 PM" */
export function formatHhmm(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm));
  if (!m) throw new RangeError(`Not a time: ${hhmm}`);
  const h = +m[1];
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Today's date in India as "YYYY-MM-DD" (for due dates and "overdue"). */
export function todayIst(now = new Date()) {
  return isoDate.format(now);
}
