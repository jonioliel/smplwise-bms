import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillVars, makeCatalogue, renderText } from '../src/tickets/catalogue';
import { tn } from '../src/tickets/naming';
import { BOARD_TEXT_EN_KEYS, BOARD_TEXT_KEYS, boardTemplate, bt } from '../src/tickets/board-text';
import { CONV_TEXT_EN_KEYS, CONV_TEXT_KEYS, convTemplate, cvt } from '../src/tickets/conversation-text';
import { COST_TEXT_EN_KEYS, COST_TEXT_KEYS, costTemplate, ct } from '../src/tickets/cost-text';
import { DELETE_TEXT_EN_KEYS, DELETE_TEXT_KEYS, deleteTemplate, dlt } from '../src/tickets/delete-text';
import { DEVICE_TEXT_EN_KEYS, DEVICE_TEXT_KEYS, deviceTemplate, dt } from '../src/tickets/device-text';
import { DRAWER_TEXT_EN_KEYS, DRAWER_TEXT_KEYS, drawerTemplate, dwt } from '../src/tickets/drawer-text';
import { LIST_TEXT_EN_KEYS, LIST_TEXT_KEYS, listTemplate, lt } from '../src/tickets/list-text';
import { MESSAGE_TEXT_EN_KEYS, MESSAGE_TEXT_KEYS, mtt } from '../src/tickets/messages-text';
import { OVERVIEW_TEXT_EN_KEYS, OVERVIEW_TEXT_KEYS, overviewTemplate, ot } from '../src/tickets/overview-text';
import { QUOTE_TEXT_EN_KEYS, QUOTE_TEXT_KEYS, quoteTemplate, qt } from '../src/tickets/quote-text';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_HE, RFQ_TEXT_KEYS, rfqTemplate, rt } from '../src/tickets/rfq-text';
import { TABLE_TEXT_EN_KEYS, TABLE_TEXT_KEYS, tableTemplate, tbt } from '../src/tickets/table-text';
import { TICKET_TEXT_EN_KEYS, TICKET_TEXT_KEYS, template, tt } from '../src/tickets/text';
import { WORK_CALENDAR_TEXT_EN_KEYS, WORK_CALENDAR_TEXT_KEYS, workCalendarTemplate, wct } from '../src/tickets/work-calendar-text';
import { CAL_TEXT_KEYS, calTemplate, calt } from '../src/tickets/calendar-text';
import { LOC_TEXT_HE, loct } from '../src/tickets/org-locations-text';
import { RULES_TEXT_HE, rlt } from '../src/tickets/rules-text';

// CR-TK-CATALOGUE-2440 (review 08:F07; docs/changes/CR-TK-CATALOGUE-2440.md): one implementation of the tickets text catalogues
// (tickets/catalogue.ts). Node only - no document, so the language is the product's Hebrew.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TICKETS = path.join(HERE, '..', 'src', 'tickets');
const VARS = { n: 3, name: 'דנה', count: 7, when: '10:00', x: 'y' };
/** The lines every module carried before this change, written out once more: the yardstick the factory is held to. */
const oldText = (raw: string, vars?: Record<string, string | number>): string => {
  const named = tn(raw, 'he');
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
};

test('fillVars fills the named variables and leaves an unknown one as written', () => {
  expect(fillVars('{a} of {b}', { a: 1, b: 'two' })).toBe('1 of two');
  expect(fillVars('{a} of {b}', { a: 1 })).toBe('1 of {b}');
  expect(fillVars('{a}', undefined)).toBe('{a}');
});

test('makeCatalogue: English falls back to Hebrew, the key lists keep each dictionary\'s order', () => {
  const he = { a: 'אחת {n}', b: 'שתיים', c: '{tickets} פתוחות' };
  const en: Partial<Record<keyof typeof he, string>> = { b: 'two', a: 'one {n}' };
  const cat = makeCatalogue<keyof typeof he>(he, en);
  expect(cat.KEYS).toEqual(['a', 'b', 'c']);
  expect(cat.EN_KEYS).toEqual(['b', 'a']);
  expect(cat.template('a', 'he')).toBe('אחת {n}');
  expect(cat.template('a', 'en')).toBe('one {n}');
  expect(cat.template('c', 'en')).toBe('{tickets} פתוחות'); // no English: the Hebrew template
  expect(cat.template('b')).toBe('שתיים'); // no document here: Hebrew
  expect(cat.t('a', { n: 4 })).toBe('אחת 4');
  expect(cat.t('c')).toBe(tn('{tickets} פתוחות', 'he'));
});

test('the names are rendered before the variables: a typed value is never read as a naming token', () => {
  expect(renderText('{name}: {tickets}', 'he', { name: '{tickets}' })).toBe(`{tickets}: ${tn('{tickets}', 'he')}`);
});

const REGULAR: [string, readonly string[], readonly string[], (k: never, lang?: 'he' | 'en') => string, (k: never, vars?: Record<string, string | number>) => string][] = [
  ['board', BOARD_TEXT_KEYS, BOARD_TEXT_EN_KEYS, boardTemplate, bt],
  ['conversation', CONV_TEXT_KEYS, CONV_TEXT_EN_KEYS, convTemplate, cvt],
  ['cost', COST_TEXT_KEYS, COST_TEXT_EN_KEYS, costTemplate, ct],
  ['delete', DELETE_TEXT_KEYS, DELETE_TEXT_EN_KEYS, deleteTemplate, dlt],
  ['device', DEVICE_TEXT_KEYS, DEVICE_TEXT_EN_KEYS, deviceTemplate, dt],
  ['drawer', DRAWER_TEXT_KEYS, DRAWER_TEXT_EN_KEYS, drawerTemplate, dwt],
  ['list', LIST_TEXT_KEYS, LIST_TEXT_EN_KEYS, listTemplate, lt],
  ['overview', OVERVIEW_TEXT_KEYS, OVERVIEW_TEXT_EN_KEYS, overviewTemplate, ot],
  ['quote', QUOTE_TEXT_KEYS, QUOTE_TEXT_EN_KEYS, quoteTemplate, qt],
  ['rfq', RFQ_TEXT_KEYS, RFQ_TEXT_EN_KEYS, rfqTemplate, rt],
  ['table', TABLE_TEXT_KEYS, TABLE_TEXT_EN_KEYS, tableTemplate, tbt],
  ['text', TICKET_TEXT_KEYS, TICKET_TEXT_EN_KEYS, template, tt],
  ['work-calendar', WORK_CALENDAR_TEXT_KEYS, WORK_CALENDAR_TEXT_EN_KEYS, workCalendarTemplate, wct],
];

for (const [name, keys, enKeys, tpl, text] of REGULAR) {
  test(`${name}: every key renders exactly as the lines it carried before did, with and without variables`, () => {
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of enKeys) expect(keys, k).toContain(k);
    for (const k of keys) {
      const he = tpl(k as never, 'he');
      const en = tpl(k as never, 'en');
      expect(typeof he, k).toBe('string');
      expect(typeof en, k).toBe('string');
      if (!enKeys.includes(k)) expect(en, k).toBe(he); // the fallback
      expect(tpl(k as never), k).toBe(he);
      expect(text(k as never), k).toBe(oldText(he));
      expect(text(k as never, VARS), k).toBe(oldText(he, VARS));
    }
  });
}

test('the catalogues that keep their own lines still read the same: messages, calendar, rules, locations, the unknown key of the main one', () => {
  expect(MESSAGE_TEXT_KEYS.length).toBeGreaterThan(0);
  for (const k of MESSAGE_TEXT_EN_KEYS) expect(MESSAGE_TEXT_KEYS).toContain(k);
  for (const k of MESSAGE_TEXT_KEYS) expect(typeof mtt(k, VARS), k).toBe('string');
  for (const k of CAL_TEXT_KEYS) {
    expect(calt(k), k).toBe(oldText(calTemplate(k, 'he')));
    expect(calt(k, VARS), k).toBe(oldText(calTemplate(k, 'he'), VARS));
  }
  // rules / locations: the variables first, the names only when a token is left (their own order, kept)
  for (const [k, raw] of Object.entries(RULES_TEXT_HE)) expect(rlt(k as keyof typeof RULES_TEXT_HE), k).toBe(/\{(the_tickets|the_ticket|tickets|ticket|module)\}|\{f:/.test(raw) ? tn(raw) : raw);
  for (const [k, raw] of Object.entries(LOC_TEXT_HE)) expect(loct(k as keyof typeof LOC_TEXT_HE), k).toBe(/\{(the_tickets|the_ticket|tickets|ticket|module)\}|\{f:/.test(raw) ? tn(raw) : raw);
  expect(tt('no_such_key_from_a_newer_server' as never)).toBe('no_such_key_from_a_newer_server');
  expect(Object.keys(RFQ_TEXT_HE)).toEqual(RFQ_TEXT_KEYS);
});

test('no text module of the tickets carries the copied lines any more, and no short name is exported twice', () => {
  const files = readdirSync(TICKETS).filter((f) => /(^text.*|-text)\.ts$/.test(f));
  expect(files.length).toBeGreaterThanOrEqual(25);
  const shortNames = new Map<string, string[]>();
  for (const f of files) {
    const src = readFileSync(path.join(TICKETS, f), 'utf8');
    // nav-text.ts is the shell's two words: its imports are pinned (unit-shell-lazy-2436), so it keeps its three lines
    if (f !== 'nav-text.ts') expect(src, f).not.toContain(".replace(/\\{(\\w+)\\}/g");
    for (const m of src.matchAll(/^export (?:function|const) ([a-z]{2,5})\b/gm)) shortNames.set(m[1], [...(shortNames.get(m[1]) ?? []), f]);
  }
  const twice = [...shortNames].filter(([, where]) => where.length > 1);
  expect(twice).toEqual([]);
  expect(shortNames.get('calt')).toEqual(['calendar-text.ts']);
  expect(shortNames.get('loct')).toEqual(['org-locations-text.ts']);
  expect(shortNames.get('ct')).toEqual(['cost-text.ts']);
  expect(shortNames.get('lt')).toEqual(['list-text.ts']);
});

test('the factory module holds no dictionary and stays clear of the main catalogue', () => {
  const src = readFileSync(path.join(TICKETS, 'catalogue.ts'), 'utf8');
  expect([...src.matchAll(/^import [^\n]* from '([^']+)';/gm)].map((m) => m[1]).sort()).toEqual(['../i18n/nav-labels', './naming']);
  expect(src).not.toMatch(/[\u0590-\u05FF]/); // not one Hebrew letter: the words stay in their modules
});
