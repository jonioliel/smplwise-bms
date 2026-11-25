import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { registeredCatalogues } from '../src/i18n/core';
import { tr } from '../src/i18n/msg/home';
import { hasHebrew, hebrewOutsideTr, trCalls, trModule } from './helpers/i18n-source-scan';

// CR-I18N-HOME-2441 (MASTER_PLAN row CR-I18N-HOME, code review 08:F11): the home interface's texts.
// Lint: a Hebrew string or template text in src/home/* is the first argument of `tr(...)`, whose English lives in
// src/i18n/msg/home.ts; a new Hebrew literal anywhere else fails here (comments are not read). What stays Hebrew on purpose is
// listed below with its reason, and a listed text that no longer exists fails too, so the list only shrinks.
// Completeness: every `tr()` text has its English, the table holds nothing else, both sides name the same `{placeholders}`, and
// the Hebrew interface shows the text exactly as written (the Hebrew is the key, so a Hebrew screen cannot move).

const DIR = new URL('../src/home/', import.meta.url);
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts')).sort();
const read = (f: string): string => readFileSync(new URL(f, DIR), 'utf8');

/** Style sheets: their only Hebrew is inside CSS comments (the compiler sees one template text per sheet). */
const CSS_FILES = new Set(['home-p3-styles.ts', 'home-styles-extra.ts']);

/** Single literals that stay Hebrew: file -> the texts (each as many times as it is written). */
const HEBREW_LITERALS: Record<string, { why: string; texts: string[] }> = {
  // I18N-REST-2520 (owner rule 22.11): the booking and service-request default titles read through tr() now (made in the creator's language)
};

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

function used(): { keys: Map<string, string>; notLiteral: string[]; wrongModule: string[] } {
  const out = { keys: new Map<string, string>(), notLiteral: [] as string[], wrongModule: [] as string[] };
  for (const f of FILES) {
    const source = read(f);
    const calls = trCalls(f, source);
    if (!calls.keys.length && !calls.notLiteral.length) continue;
    if (trModule(source) !== 'msg/home') out.wrongModule.push(`${f}: tr comes from ${trModule(source) ?? 'somewhere else'}`);
    for (const k of calls.keys) if (!out.keys.has(k)) out.keys.set(k, f);
    out.notLiteral.push(...calls.notLiteral.map((x) => `${f}:${x}`));
  }
  return out;
}

test('home: no Hebrew literal outside tr() and the catalogue file', () => {
  const extra: string[] = [];
  const stale: string[] = [];
  for (const f of FILES) {
    const left = [...(HEBREW_LITERALS[f]?.texts ?? [])];
    for (const lit of hebrewOutsideTr(f, read(f))) {
      if (CSS_FILES.has(f)) continue;
      const i = left.indexOf(lit.text);
      if (i >= 0) left.splice(i, 1);
      else extra.push(`${f}:${lit.line}: ${lit.text.slice(0, 70)}`);
    }
    stale.push(...left.map((t) => `${f}: ${t}`));
  }
  expect(extra, 'a Hebrew text of the home interface goes through tr() (src/i18n/msg/home.ts holds its English)').toEqual([]);
  expect(stale, 'a listed exception that no longer exists: remove it from HEBREW_LITERALS').toEqual([]);
});

test('home: the style sheets carry Hebrew only inside CSS comments', () => {
  for (const f of CSS_FILES) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(hasHebrew(css), f).toBe(false);
  }
});

test('home: every tr() text has its English, and the table holds no text the screens do not use', () => {
  const src = used();
  expect(src.wrongModule).toEqual([]);
  expect(src.notLiteral, 'the first argument of tr() is a plain literal; values go through {name}').toEqual([]);
  expect(src.keys.size).toBeGreaterThan(1000);
  const missing = [...src.keys].filter(([k]) => !(k in tr.en)).map(([k, f]) => `${f}: ${k}`);
  expect(missing, 'texts without English in src/i18n/msg/home.ts').toEqual([]);
  const unused = Object.keys(tr.en).filter((k) => !src.keys.has(k));
  expect(unused, 'table entries no screen uses').toEqual([]);
});

test('home: the English is English, keeps the placeholders and the spaces at the ends of a sentence part', () => {
  const bad: string[] = [];
  for (const [he, en] of Object.entries(tr.en)) {
    if (hasHebrew(en)) bad.push(`Hebrew in the English of: ${he}`);
    if (placeholders(he) !== placeholders(en)) bad.push(`placeholders differ: ${he} -> ${en}`);
    if (/^\s/.test(he) !== /^\s/.test(en)) bad.push(`leading space differs: "${he}" -> "${en}"`);
  }
  expect(bad).toEqual([]);
});

test('home: Hebrew shows the text as written, English shows the table, a value fills its {name}', () => {
  for (const he of Object.keys(tr.en)) expect(withLang('he', () => tr(he))).toBe(he);
  expect(tr('כל האורות כבויים')).toBe('כל האורות כבויים'); // outside a browser: Hebrew
  expect(withLang('en', () => tr('כל האורות כבויים'))).toBe('All the lights are off');
  expect(withLang('he', () => tr('{n} אורות דולקים', { n: 3 }))).toBe('3 אורות דולקים');
  expect(withLang('en', () => tr('{n} אורות דולקים', { n: 3 }))).toBe('3 lights are on');
  expect(withLang('en-GB', () => tr('לפני {min} דקות', { min: 5 }))).toBe('5 minutes ago');
  expect(withLang('en', () => tr('טקסט שאין לו תרגום'))).toBe('טקסט שאין לו תרגום'); // a text the table lacks stays Hebrew
});

test('home: the table is registered for the missing-keys report', () => {
  const entry = registeredCatalogues().find((c) => c.name === 'msg/home');
  expect(entry).toBeTruthy();
  expect(Object.keys(entry!.tables.en ?? {}).length).toBe(Object.keys(tr.en).length);
});
