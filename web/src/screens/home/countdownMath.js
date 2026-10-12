// Months : Days : Hours to a moment, counted on the Indian calendar (IST, no daylight saving).
const IST = 330 * 60 * 1000;
const DAY = 86400000;
const HOUR = 3600000;

function daysIn(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** The same wall-clock time `n` months later; the 31st becomes the last day of a short month. */
function addMonths(ms, n) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysIn(ty, tm));
  return Date.UTC(ty, tm, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

/** @returns {{months:number, days:number, hours:number} | null} null once the moment has come */
export function monthsDaysHours(nowMs, targetMs) {
  if (!(targetMs > nowMs)) return null;
  const a = nowMs + IST;
  const b = targetMs + IST;
  const da = new Date(a);
  const db = new Date(b);
  let months = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
  let base = addMonths(a, months);
  while (months > 0 && base > b) { months--; base = addMonths(a, months); }
  const rest = b - base;
  return { months, days: Math.floor(rest / DAY), hours: Math.floor((rest % DAY) / HOUR) };
}
