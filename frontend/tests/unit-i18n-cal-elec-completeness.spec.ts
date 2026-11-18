import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { registeredCatalogues } from '../src/i18n/core';
import { tr as trCalendars } from '../src/i18n/msg/calendars';
import { tr as trElectricity } from '../src/i18n/msg/electricity';
import type { Translator } from '../src/i18n/msg';
import { hasHebrew, trCalls, trModule } from './helpers/i18n-source-scan';

// CR-I18N-CAL-ELEC-2441 (MASTER_PLAN rows CR-I18N-CALENDARS / CR-I18N-ELECTRICITY, code review 08:F11): completeness of the two
// source-text catalogues. Every text the area passes to `tr()` has its English in the area's table, the table holds nothing
// else, the English is English, both sides name the same `{placeholders}`, and the Hebrew interface shows the text exactly as
// written in the source (the Hebrew is the key, so Hebrew screens cannot move).

const AREAS: { area: string; module: string; tr: Translator }[] = [
  { area: 'calendars', module: 'msg/calendars', tr: trCalendars },
  { area: 'electricity', module: 'msg/electricity', tr: trElectricity },
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

interface AreaSource {
  /** text -> the first file that uses it */
  used: Map<string, string>;
  notLiteral: string[];
  wrongModule: string[];
}
function readArea(area: string, module: string): AreaSource {
  const dir = new URL(`../src/${area}/`, import.meta.url);
  const out: AreaSource = { used: new Map(), notLiteral: [], wrongModule: [] };
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts')).sort()) {
    const source = readFileSync(new URL(f, dir), 'utf8');
    const calls = trCalls(f, source);
    if (!calls.keys.length && !calls.notLiteral.length) continue;
    if (trModule(source) !== module) out.wrongModule.push(`${area}/${f}: tr comes from ${trModule(source) ?? 'somewhere else'}`);
    for (const k of calls.keys) if (!out.used.has(k)) out.used.set(k, `${area}/${f}`);
    out.notLiteral.push(...calls.notLiteral.map((x) => `${area}/${f}:${x}`));
  }
  return out;
}

for (const { area, module, tr } of AREAS) {
  test(`${area}: every tr() text has its English, and the table holds no text the area does not use`, () => {
    const src = readArea(area, module);
    expect(src.wrongModule).toEqual([]);
    expect(src.notLiteral, 'the first argument of tr() is a plain literal; values go through {name}').toEqual([]);
    expect(src.used.size).toBeGreaterThan(300);
    const missing = [...src.used].filter(([k]) => !(k in tr.en)).map(([k, f]) => `${f}: ${k}`);
    expect(missing, `add the English to src/i18n/${module}.ts`).toEqual([]);
    const unused = Object.keys(tr.en).filter((k) => !src.used.has(k));
    expect(unused, `not used by src/${area}/*: remove from src/i18n/${module}.ts`).toEqual([]);
  });

  test(`${area}: the English is English, with the same placeholders as the Hebrew`, () => {
    const hebrewLeft: string[] = [];
    const empty: string[] = [];
    const names: string[] = [];
    for (const [he, en] of Object.entries(tr.en)) {
      if (hasHebrew(en)) hebrewLeft.push(`${he} -> ${en}`);
      if (!en.trim()) empty.push(he);
      if (placeholders(he) !== placeholders(en)) names.push(`${he} -> ${en}`);
    }
    expect(hebrewLeft).toEqual([]);
    expect(empty).toEqual([]);
    expect(names).toEqual([]);
  });

  test(`${area}: Hebrew shows the source text as written; English shows the table; values are filled the same way`, () => {
    const keys = Object.keys(tr.en);
    const vars = { n: 3, name: 'א', date: '01.02.2026', period: 'מרץ', day: 1, weekday: 'שני', error: 'x', c: '#000000', max: 9, no: '7', list: 'a, b', range: 'r', band: 'b', season: 's', month: 'm', role: 'r' };
    const legacyFill = (raw: string): string => raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String((vars as Record<string, unknown>)[k]) : m));
    withLang('he', () => {
      for (const k of keys) {
        expect(tr(k)).toBe(k);
        expect(tr(k, vars)).toBe(legacyFill(k));
      }
    });
    withLang('en', () => {
      for (const k of keys) {
        expect(tr(k)).toBe(tr.en[k]);
        expect(tr(k, vars)).toBe(legacyFill(tr.en[k]));
      }
      expect(tr('טקסט שאין בטבלה')).toBe('טקסט שאין בטבלה'); // a text without English stays Hebrew, it never disappears
    });
  });

  test(`${area}: the table is registered for the missing-keys report`, () => {
    const cat = registeredCatalogues().find((c) => c.name === module);
    expect(cat, module).toBeTruthy();
    expect(Object.keys(cat!.tables.en ?? {})).toHaveLength(Object.keys(tr.en).length);
  });
}

test('the two tables carry no duplicate key in their source (a later line would silently win)', () => {
  for (const { module } of AREAS) {
    // CR-I18N-LAZY-LANG-2443: the texts are in the English pack (src/i18n/lang/en/i18n/<module>.ts), the module reads them from there
    const source = readFileSync(new URL(`../src/i18n/lang/en/i18n/${module}.ts`, import.meta.url), 'utf8');
    const seen = new Set<string>();
    const twice: string[] = [];
    for (const m of source.matchAll(/^\s*'((?:\\.|[^'\\])+)'\s*:/gm)) {
      if (seen.has(m[1])) twice.push(`${module}: ${m[1]}`);
      seen.add(m[1]);
    }
    expect(twice).toEqual([]);
    expect(seen.size).toBeGreaterThan(300);
  }
});
