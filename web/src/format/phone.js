// Phone numbers (FEATURES A9): stored E.164 (+919829012345), shown grouped.

const INVALID = { ok: false, error: 'Enter a 10-digit mobile number.' };

/**
 * Normalise what people type.
 * → { ok: true, e164, kind: 'mobile' | 'landline' | 'international', warning? } or { ok: false, error }
 */
export function normalizePhone(input) {
  if (typeof input !== 'string') return INVALID;
  const cleaned = input.trim().replace(/[\s\-().]/g, '');
  if (cleaned === '') return INVALID;

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (!/^\d+$/.test(digits)) return INVALID;
    if (digits.startsWith('91')) return indian(digits.slice(2));
    if (digits.length >= 8 && digits.length <= 15 && digits[0] !== '0') {
      return { ok: true, e164: `+${digits}`, kind: 'international' };
    }
    return INVALID;
  }
  if (!/^\d+$/.test(cleaned)) return INVALID;
  let d = cleaned;
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return indian(d);
}

function indian(d) {
  if (!/^\d{10}$/.test(d)) return INVALID;
  if (/^[6-9]/.test(d)) return { ok: true, e164: `+91${d}`, kind: 'mobile' };
  return { ok: true, e164: `+91${d}`, kind: 'landline', warning: "Landline — WhatsApp won't work" };
}

/** "+919829012345" → "+91 98290 12345"; other countries stay as stored. */
export function formatPhone(e164) {
  if (typeof e164 !== 'string') return '';
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** wa.me links use digits only (CONTEXT §8). */
export function waDigits(e164) {
  return String(e164 || '').replace(/\D/g, '');
}

/** "+91 98290 12345" and "9829012345" are the same number (AC-IND-03). */
export function samePhone(a, b) {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  return x.ok && y.ok && x.e164 === y.e164;
}
