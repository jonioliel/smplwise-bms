import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CHOICES, CHOICE_HE, DIAL_HE } from '../src/api/plan-view';
import type { Translator } from '../src/i18n/msg';
import { tr as apiTr } from '../src/i18n/msg/api-plan-view';
import { tr as mapTr } from '../src/i18n/msg/map';
import { tr as cardTr } from '../src/i18n/msg/plan-view-card';
import { tr as wizardTr } from '../src/i18n/msg/plan-wizard';
import { tr as systemATr } from '../src/i18n/msg/system-a';
import { tr as systemBTr } from '../src/i18n/msg/system-b';
import { HINT_HE, KIOSK_HE, MAP3D_ROWS } from '../src/screens/plan-view-dials';
import { hasHebrew, hebrewOutsideTr, trCalls, trModule } from './helpers/i18n-source-scan';

// CR-UI-POLISH-2443: the "3D map" settings card of owner round 32 (screens/system-plan-view.ts, screens/plan-view-dials.ts and
// the names in api/plan-view.ts) was written after the translation rows and stayed Hebrew in the English interface. Its texts now
// go through tr() of two source-text tables. Node-only:
//   1. lint - no Hebrew string or template text is left outside tr() in the three files (comments are not read);
//   2. completeness - every tr() text has its English with the same {placeholders}, and the tables hold nothing else;
//   3. Hebrew - what the Hebrew interface shows is the text exactly as written (the Hebrew is the key);
//   4. English - the tables answer, and the words shared with the neighbouring tables read the same.
//   npx playwright test -c playwright.unit.config.ts tests/unit-i18n-plan-view-2443.spec.ts

const read = (rel: string): string => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

/** Each file with the one table its `tr` comes from. */
const FILES: { rel: string; module: string; tr: Translator }[] = [
  { rel: 'api/plan-view.ts', module: 'msg/api-plan-view', tr: apiTr },
  { rel: 'screens/plan-view-dials.ts', module: 'msg/plan-view-card', tr: cardTr },
  { rel: 'screens/system-plan-view.ts', module: 'msg/plan-view-card', tr: cardTr },
];
const TABLES: { module: string; tr: Translator }[] = [
  { module: 'msg/api-plan-view', tr: apiTr },
  { module: 'msg/plan-view-card', tr: cardTr },
];

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}
const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('lint: no Hebrew literal outside tr() in the three files of the card', () => {
  const left: string[] = [];
  for (const { rel } of FILES) for (const lit of hebrewOutsideTr(rel, read(rel))) left.push(`${rel}:${lit.line}: ${lit.text.slice(0, 70)}`);
  expect(left).toEqual([]);
});

test('each file reads its texts from its own table, and only with plain literals', () => {
  for (const { rel, module } of FILES) {
    const source = read(rel);
    expect(trModule(source), rel).toBe(module);
    expect(trCalls(rel, source).notLiteral, rel).toEqual([]);
  }
});

test('completeness: every tr() text has its English with the same placeholders; no table entry is unused', () => {
  for (const { module, tr } of TABLES) {
    const used = new Set<string>();
    for (const f of FILES) if (f.module === module) for (const k of trCalls(f.rel, read(f.rel)).keys) used.add(k);
    expect(used.size, module).toBeGreaterThan(50);
    expect([...used].filter((k) => !(k in tr.en)), `${module}: no English`).toEqual([]);
    expect(Object.keys(tr.en).filter((k) => !used.has(k)), `${module}: unused`).toEqual([]);
    for (const [he, en] of Object.entries(tr.en)) {
      expect(hasHebrew(he), `${module}: the key is the Hebrew text: ${he}`).toBe(true);
      expect(hasHebrew(en), `${module}: English without Hebrew letters: ${he}`).toBe(false);
      expect(en.trim().length, he).toBeGreaterThan(0);
      expect(placeholders(en), he).toBe(placeholders(he));
    }
  }
});

test('Hebrew: every name, choice, hint and row of the card is the text as written', () => {
  // the tables of the two modules were read while they initialised - with no document, that is the Hebrew interface
  const shown = [...Object.values(DIAL_HE), ...Object.values(CHOICE_HE)];
  expect(shown.filter((t) => !(t in apiTr.en))).toEqual([]);
  const card = [...Object.values(HINT_HE), ...Object.values(KIOSK_HE), ...MAP3D_ROWS.flatMap((r) => [r.he, r.hint, ...r.options.map((o) => o[1])])];
  expect(card.filter((t) => !(t in cardTr.en))).toEqual([]);
  expect(card.length).toBe(24 + 5 + 8 * 2 + 21);
  // every choice of every dial has a name (the kiosk seconds are named by KIOSK_HE)
  for (const [dial, values] of Object.entries(CHOICES)) {
    for (const v of values) expect(dial === 'kiosk_idle_s' ? KIOSK_HE[Number(v)] : CHOICE_HE[String(v)], `${dial}:${v}`).toBeTruthy();
  }
  withLang('he', () => {
    for (const { tr } of TABLES) for (const he of Object.keys(tr.en)) expect(tr(he)).toBe(he);
    expect(cardTr('{n} מ׳', { n: (1.65).toFixed(2) })).toBe('1.65 מ׳');
    expect(`${cardTr('לפי ההתקנה: {value}', { value: apiTr('סכמטי') })} · ${cardTr('גובה העין בסיור בגובה עין')}`).toBe('לפי ההתקנה: סכמטי · גובה העין בסיור בגובה עין');
  });
  expect(DIAL_HE.wall_cut).toBe('גובה הקירות');
  expect(CHOICE_HE.marble).toBe('שיש קלקטה מלוטש');
  expect(HINT_HE.eye_m).toBe('גובה העין בסיור בגובה עין');
  expect(KIOSK_HE[120]).toBe('2 דקות');
  expect(MAP3D_ROWS[0].options[0]).toEqual(['room', 'תווית לכל חדר, התקנים בהתקרבות']);
});

test('English: the tables answer, with the glossary terms', () => {
  withLang('en', () => {
    expect(cardTr('מפה תלת־ממדית')).toBe('3D map');
    expect(cardTr('{n} מ׳', { n: '1.65' })).toBe('1.65 m');
    expect(cardTr('לפי ההתקנה: {value}', { value: apiTr('ריאליסטי קל') })).toBe('As the installation: Realistic lite');
    // glossary: סיור (3D map) = walk, תמונה מוכנה = prepared picture, מסך קיר = wall screen
    expect(apiTr('מבט בעכבר בסיור')).toBe('Mouse look in the walk');
    expect(apiTr('מעבר לתמונה מוכנה במסך קיר')).toBe('Switch to a prepared picture on a wall screen');
    expect(cardTr('סיור בגובה עין')).toBe('Eye-level walk');
    expect(cardTr('תווית "הכול סגור"')).toBe('An "All closed" label');
  });
});

test('the words shared with the neighbouring tables carry the same English', () => {
  // one Hebrew, another meaning there: a switch state here ("On"), a status there ("Active"); a choice label here, part of a sentence there
  const OTHER_MEANING: Record<string, string> = { 'פעיל': 'msg/system-a says Active (a status); the card pairs it with כבוי as a switch', 'ידני': 'msg/system-b writes it in lower case inside a sentence' };
  const neighbours: Record<string, Readonly<Record<string, string>>> = { 'msg/map': mapTr.en, 'msg/plan-wizard': wizardTr.en, 'msg/system-a': systemATr.en, 'msg/system-b': systemBTr.en };
  const differs: string[] = [];
  const seen = new Set<string>();
  for (const { module, tr } of TABLES) {
    for (const [he, en] of Object.entries(tr.en)) {
      for (const [name, table] of Object.entries(neighbours)) {
        if (!(he in table) || table[he] === en) continue;
        if (he in OTHER_MEANING) seen.add(he);
        else differs.push(`${module} / ${name}: ${he} -> "${en}" / "${table[he]}"`);
      }
    }
  }
  expect(differs).toEqual([]);
  expect([...seen].sort()).toEqual(Object.keys(OTHER_MEANING).sort());
});
