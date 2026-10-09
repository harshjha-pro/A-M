// Money in paise (integer), shown the Indian way (FEATURES A9, CONTEXT §8).
// Never floats: all maths is on integers.

const grouping = new Intl.NumberFormat('en-IN');

/** 1804 → "1,804"; 100000 → "1,00,000" */
export function formatCount(n) {
  return grouping.format(n);
}

/** 12500000 → "₹1,25,000"; 125050 → "₹1,250.50" (paise only when non-zero) */
export function formatInr(paise) {
  if (!Number.isInteger(paise)) throw new TypeError('paise must be an integer');
  const sign = paise < 0 ? '−' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const tail = rest === 0 ? '' : '.' + String(rest).padStart(2, '0');
  return `${sign}₹${grouping.format(rupees)}${tail}`;
}

/** Cards: ≥ 1 lakh → "₹1.25 L", ≥ 1 crore → "₹2.4 Cr", else full. */
export function formatInrCompact(paise) {
  if (!Number.isInteger(paise)) throw new TypeError('paise must be an integer');
  const abs = Math.abs(paise);
  const sign = paise < 0 ? '−' : '';
  const CRORE = 100 * 1e7;
  const LAKH = 100 * 1e5;
  if (abs >= CRORE) return `${sign}₹${trimDecimals(abs, CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}₹${trimDecimals(abs, LAKH)} L`;
  return formatInr(paise);
}

// Two decimals, rounded down, trailing zeros dropped: 12500000/1e7 → "1.25"
function trimDecimals(value, unit) {
  const hundredths = Math.floor((value * 100) / unit);
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

const MULTIPLIERS = [
  [/^(crores?|cr)$/, 1e7],
  [/^(lakhs?|lacs?|l)$/, 1e5],
  [/^k$/, 1e3],
  [/^$/, 1],
];

export const MAX_PAISE = 1000000000; // ₹1 crore per payment (1,000,000,000 paise: the database limit)

/**
 * What people type → paise, or null if it isn't an amount.
 * "50000" → 5000000 · "1,25,000" → 12500000 · "1.25 lakh" → 12500000 · "2 Cr" · "15k" · "1250.50"
 */
export function parseInrInput(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim().toLowerCase().replace(/^₹\s*/, '').replace(/,/g, '');
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?\s*([a-z]*)$/);
  if (!m) return null;
  const rule = MULTIPLIERS.find(([re]) => re.test(m[3]));
  if (!rule) return null;
  const hundredths = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  const paise = hundredths * rule[1]; // 1/100 rupee = 1 paisa
  if (!Number.isSafeInteger(paise)) return null;
  return paise;
}
