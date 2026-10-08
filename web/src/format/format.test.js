// Indian formats (TESTING §1.7) — run with the machine in America/New_York.
import { describe, test, expect } from 'vitest';
import { formatInr, formatInrCompact, parseInrInput, formatCount, MAX_PAISE } from './inr.js';
import { normalizePhone, formatPhone, waDigits, samePhone } from './phone.js';
import { formatDate, formatTime, formatDateTime, formatDateOnly, formatHhmm, todayIst } from './ist.js';

describe('test machine', () => {
  test('really runs outside India', () => {
    expect(process.env.TZ).toBe('America/New_York');
    expect(new Date('2027-02-14T12:30:00Z').getTimezoneOffset()).toBe(300); // EST, not IST (-330)
  });
});

describe('money', () => {
  test('Indian grouping, no paise unless non-zero', () => {
    expect(formatInr(12500000)).toBe('₹1,25,000');
    expect(formatInr(125050)).toBe('₹1,250.50');
    expect(formatInr(5)).toBe('₹0.05');
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(MAX_PAISE)).toBe('₹1,00,00,000');
    expect(formatInr(-5000000)).toBe('−₹50,000'); // "Over by" maths can go negative
    expect(formatCount(1804)).toBe('1,804');
    expect(formatCount(100000)).toBe('1,00,000');
  });

  test('compact on cards', () => {
    expect(formatInrCompact(12500000)).toBe('₹1.25 L');
    expect(formatInrCompact(2400000000)).toBe('₹2.4 Cr'); // 2.4 crore rupees
    expect(formatInrCompact(10000000)).toBe('₹1 L');
    expect(formatInrCompact(9999900)).toBe('₹99,999');
  });

  test('typing amounts (AC-IND-01)', () => {
    expect(parseInrInput('1.25 lakh')).toBe(12500000);
    expect(parseInrInput('1.25L')).toBe(12500000);
    expect(parseInrInput('1,25,000')).toBe(12500000);
    expect(parseInrInput('₹50000')).toBe(5000000);
    expect(parseInrInput('2 Cr')).toBe(2000000000);
    expect(parseInrInput('15k')).toBe(1500000);
    expect(parseInrInput('1250.50')).toBe(125050);
    expect(parseInrInput('3 lac')).toBe(30000000);
    expect(parseInrInput('-500')).toBeNull();
    expect(parseInrInput('1.255')).toBeNull();
    expect(parseInrInput('abc')).toBeNull();
    expect(parseInrInput('')).toBeNull();
    expect(Number.isInteger(parseInrInput('0.1 lakh'))).toBe(true); // never a float
  });
});

describe('phones', () => {
  test('normalise Indian mobiles (FEATURES A9)', () => {
    expect(normalizePhone('098290-12345')).toEqual({ ok: true, e164: '+919829012345', kind: 'mobile' });
    expect(normalizePhone('+91 98290 12345').e164).toBe('+919829012345');
    expect(normalizePhone('919829012345').e164).toBe('+919829012345');
    expect(normalizePhone('(98290) 12345').e164).toBe('+919829012345');
  });

  test('international, landline, invalid', () => {
    expect(normalizePhone('+971501234567')).toEqual({ ok: true, e164: '+971501234567', kind: 'international' });
    const land = normalizePhone('01482 230456');
    expect(land.kind).toBe('landline');
    expect(land.warning).toBe("Landline — WhatsApp won't work");
    expect(normalizePhone('12345')).toEqual({ ok: false, error: 'Enter a 10-digit mobile number.' }); // AC-IND-02
    expect(normalizePhone('abc').ok).toBe(false);
  });

  test('display, wa.me digits, same number (AC-IND-03)', () => {
    expect(formatPhone('+919829012345')).toBe('+91 98290 12345');
    expect(formatPhone('+971501234567')).toBe('+971501234567');
    expect(waDigits('+919829012345')).toBe('919829012345');
    expect(samePhone('+91 98290 12345', '9829012345')).toBe(true);
    expect(samePhone('9829012345', '9829012346')).toBe(false);
  });
});

describe('dates and times in IST (AC-IND-04)', () => {
  test('a moment shows in India time, not New York', () => {
    // 12:30 UTC = 6:00 PM IST
    expect(formatTime('2027-02-14T12:30:00Z')).toBe('6:00 PM');
    expect(formatDate('2027-02-14T12:30:00Z')).toBe('Sun, 14 Feb 2027');
    expect(formatDateTime('2027-02-14T12:30:00Z')).toBe('Sun, 14 Feb 2027, 6:00 PM IST');
  });

  test('late-night UTC is already the next day in India', () => {
    expect(formatDate('2027-02-13T19:00:00Z')).toBe('Sun, 14 Feb 2027'); // 00:30 IST
    expect(formatTime('2027-02-13T19:00:00Z')).toBe('12:30 AM');
    expect(todayIst(new Date('2026-10-08T19:00:00Z'))).toBe('2026-10-09');
  });

  test('due dates never shift a day', () => {
    expect(formatDateOnly('2027-02-14')).toBe('Sun, 14 Feb 2027');
    expect(formatDateOnly('2026-10-08')).toBe('Thu, 8 Oct 2026');
    expect(formatHhmm('18:00')).toBe('6:00 PM');
    expect(formatHhmm('00:05')).toBe('12:05 AM');
    expect(formatHhmm('12:00')).toBe('12:00 PM');
    expect(() => formatDateOnly('14/02/2027')).toThrow();
  });
});
