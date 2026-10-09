// Import readers (FEATURES A8): AC-IMP-02 pasted line, AC-IMP-06 contacts file,
// AC-IMP-07 the template maps with no manual step, AC-IMP-09 phones stored as numbers.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapHeaders, findHeader, rowsFromTable, parseCsv, parsePaste, parseVcf, readXlsx } from './importParse.js';

const EVENTS = ['Engagement', 'Haldi', 'Mehndi', 'Sangeet', 'Mayra', 'Wedding', 'Reception'].map((name, i) => ({ id: `E${i}`, name }));

describe('Excel template', () => {
  test('AC-IMP-07: the shipped template reads on the phone and every column maps by itself; the EXAMPLE row comes through for the server to skip', async () => {
    const buf = readFileSync(resolve(__dirname, '../../public/templates/AM_Guest_List_Template.xlsx'));
    const data = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const h = findHeader(data, EVENTS);
    expect(h).toBe(0);
    const mapping = mapHeaders(data[h], EVENTS);
    expect(mapping).toEqual(['name', 'phone', 'alt_phone', 'side', 'group_name', 'relation', 'area', 'city', 'address', 'adults', 'children',
      'food', 'jain_count', 'is_vip', 'event:E0', 'event:E1', 'event:E2', 'event:E3', 'event:E4', 'event:E5', 'event:E6', 'notes']);
    const rows = rowsFromTable(data, mapping, h);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ row_no: 2, name: 'EXAMPLE Ramesh Sharma & family', phone: '98290 12345', side: "Groom's side", adults: 3, children: 1,
      food: 'Mixed', jain_count: 2, is_vip: false, event_ids: ['E2', 'E5', 'E6'], notes: 'Arriving late' });
  });

  test('AC-IMP-09 and AC-IMP-08: a phone stored as a number stays every digit; Yes columns invite to exactly those events', () => {
    const data = [['Naam', 'Mobile', 'Mehndi', 'Reception', 'Bacche'], ['Ramesh Sharma', 9829012345, 'Yes', 'haan', 2], [], ['Gupta ji', null, 'No', '', null]];
    const map = mapHeaders(data[0], EVENTS);
    expect(map).toEqual(['name', 'phone', 'event:E2', 'event:E6', 'children']);
    expect(rowsFromTable(data, map, 0)).toEqual([
      { row_no: 2, name: 'Ramesh Sharma', phone: '9829012345', event_ids: ['E2', 'E6'], children: 2 },
      { row_no: 4, name: 'Gupta ji', event_ids: [] },
    ]);
  });
});

describe('CSV', () => {
  test('quotes, commas and line breaks inside quotes; a BOM; an empty line', () => {
    const csv = '﻿Name,Phone,Notes\r\n"Sharma, Ramesh",98290 12345,"Says ""hi""\nlate"\r\n\r\nGupta ji,9414011111,\r\n';
    expect(parseCsv(csv)).toEqual([['Name', 'Phone', 'Notes'], ['Sharma, Ramesh', '98290 12345', 'Says "hi"\nlate'], ['Gupta ji', '9414011111', '']]);
  });
  test('semicolon files (Excel in some languages) work too', () => {
    expect(parseCsv('Name;Phone\nA;9829012345')).toEqual([['Name', 'Phone'], ['A', '9829012345']]);
  });
});

describe('Pasted text', () => {
  test('AC-IMP-02: "Ramesh Sharma 98290 12345" → name and phone, in any order, any separator', () => {
    expect(parsePaste('Ramesh Sharma 98290 12345\n+91 94140-11111, Gupta ji\n\nVerma ji\tno phone')).toEqual([
      { row_no: 1, name: 'Ramesh Sharma', phone: '9829012345', event_ids: [] },
      { row_no: 2, name: 'Gupta ji', phone: '9414011111', event_ids: [] },
      { row_no: 3, name: 'Verma ji no phone', phone: null, event_ids: [] },
    ]);
  });
});

describe('Contacts file', () => {
  test('AC-IMP-06: iPhone and Android .vcf → names and mobiles, folded lines joined', () => {
    const vcf = [
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Sharma;Ramesh;;;', 'FN:Ramesh Sharma', 'item1.TEL;type=CELL;type=VOICE;type=pref:+91 98290 12345', 'TEL;type=HOME:0148 2222222', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:2.1', 'N:;Gupta ji;;;', 'TEL;CELL:9414011111', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Mama ji (Indo', ' re)', 'END:VCARD',
    ].join('\r\n');
    expect(parseVcf(vcf)).toEqual([
      { row_no: 1, name: 'Ramesh Sharma', phone: '+91 98290 12345', alt_phone: '0148 2222222', event_ids: [] },
      { row_no: 2, name: 'Gupta ji', phone: '9414011111', alt_phone: null, event_ids: [] },
      { row_no: 3, name: 'Mama ji (Indore)', phone: null, alt_phone: null, event_ids: [] },
    ]);
  });
});
