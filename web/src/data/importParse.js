// Guest import readers (FEATURES A8). Everything is read on the phone; the server
// gets plain rows. Excel uses read-excel-file (loaded only on the import screen).

/** Header words → row field (English, Hindi in Roman letters, the template's own headers). */
const HEADERS = {
  name: ['family name', 'name', 'naam', 'family', 'parivar', 'guest', 'guest name'],
  phone: ['phone', 'mobile', 'number', 'mobile number', 'phone number', 'mob', 'contact', 'whatsapp'],
  alt_phone: ['other phone', 'alt phone', 'phone 2', 'mobile 2', 'second phone', 'alternate phone'],
  side: ['side', 'paksh'],
  group_name: ['group', 'group name', 'samooh'],
  relation: ['relation', 'rishta', 'relationship'],
  area: ['area', 'mohalla', 'colony', 'locality'],
  city: ['city', 'shehar', 'sheher', 'town', 'gaon'],
  address: ['address', 'pata'],
  adults: ['adults', 'bade', 'adult'],
  children: ['children', 'bacche', 'bachche', 'kids', 'child'],
  food: ['food', 'khana', 'meal'],
  jain_count: ['jain people', 'jain count', 'jain'],
  is_vip: ['important', 'vip'],
  notes: ['notes', 'note', 'remarks', 'comments'],
};
export const FIELDS = Object.keys(HEADERS);
const YES = ['yes', 'y', 'haan', 'ha', 'han', 'true', '1', '✓', 'x'];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[*:]/g, '').replace(/\s+/g, ' ').trim();

/** Column index → field name or `event:<id>`; unknown columns are null. */
export function mapHeaders(header, events = []) {
  const used = new Set();
  return header.map((h) => {
    const w = norm(h);
    if (!w) return null;
    const ev = events.find((e) => norm(e.name) === w);
    if (ev) return `event:${ev.id}`;
    for (const [field, words] of Object.entries(HEADERS)) {
      if (!used.has(field) && words.includes(w)) { used.add(field); return field; }
    }
    return null;
  });
}

/** The header row: the first of the first 10 rows that names a Name column. */
export function findHeader(data, events = []) {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (mapHeaders(data[i] ?? [], events).includes('name')) return i;
  }
  return -1;
}

function cellText(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v); // a phone stored as a number stays digits (AC-IMP-09)
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** A table (array of rows) + the column mapping → ImportRow objects. Empty rows are left out. */
export function rowsFromTable(data, mapping, headerIndex) {
  const out = [];
  for (let i = headerIndex + 1; i < data.length; i++) {
    const cells = data[i] ?? [];
    const row = { row_no: i + 1, event_ids: [] };
    let any = false;
    mapping.forEach((m, c) => {
      const v = cellText(cells[c]);
      if (!m || v === null) return;
      any = true;
      if (m.startsWith('event:')) { if (YES.includes(norm(v))) row.event_ids.push(m.slice(6)); return; }
      if (m === 'adults' || m === 'children' || m === 'jain_count') row[m] = /^\d+$/.test(v) ? Number(v) : v;
      else if (m === 'is_vip') row[m] = YES.includes(norm(v));
      else row[m] = v;
    });
    if (any) out.push(row);
  }
  return out;
}

/** RFC 4180 CSV (quotes, commas and new lines inside quotes; a BOM is dropped). */
export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' && !s.includes(',')) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const PHONE_IN_LINE = /(\+?91[\s-]?)?(?<!\d)([6-9]\d{4}[\s-]?\d{5})(?!\d)/;

/** Pasted text: one family per line; a 10-digit mobile anywhere is the phone, the rest is the name (AC-IMP-02). */
export function parsePaste(text) {
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const m = line.match(PHONE_IN_LINE);
    const phone = m ? m[2].replace(/\D/g, '') : null;
    const name = (m ? line.replace(m[0], ' ') : line).replace(/[,\t;|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { row_no: i + 1, name: name || null, phone, event_ids: [] };
  });
}

/** .vcf contacts (iPhone and Android share these): FN (or N) + the first mobile TEL (AC-IMP-06). */
export function parseVcf(text) {
  const unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card, i) => {
    const lines = card.split(/\r?\n/);
    const get = (key) => lines.filter((l) => new RegExp(`^(item\\d+\\.)?${key}[;:]`, 'i').test(l));
    const value = (l) => l.slice(l.indexOf(':') + 1).trim();
    const decode = (v) => v.replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\n/gi, ' ');
    let name = get('FN').map(value).map(decode)[0];
    if (!name) {
      const n = get('N').map(value)[0];
      if (n) { const [last, first] = n.split(';'); name = decode([first, last].filter(Boolean).join(' ')); }
    }
    const tels = get('TEL');
    const mobile = tels.find((l) => /CELL|MOBILE|IPHONE/i.test(l)) ?? tels[0];
    const other = tels.find((l) => l !== mobile);
    return { row_no: i + 1, name: name?.trim() || null, phone: mobile ? value(mobile) : null, alt_phone: other ? value(other) : null, event_ids: [] };
  }).filter((r) => r.name || r.phone);
}

/** Excel: the "Guests" sheet if present, otherwise the first sheet → table rows. */
export async function readXlsx(input) {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(input);
  const s = sheets.find((x) => norm(x.sheet) === 'guests') ?? sheets[0];
  return s ? s.data : [];
}
