import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { createCatalogue, docLang, fill, registeredCatalogues } from '../src/i18n/core';
import { elt } from '../src/i18n/elevators';
import { t, tf, uiLang } from '../src/i18n/he';
import { dwt } from '../src/i18n/door-windows';

// CR-I18N-CORE (code review 07:F10): one language detector, one `{name}` filler and a registry of the tables, with the behaviour the
// 78 copies had - the language from `<html lang>` at call time, the language's text, else the Hebrew, else the key; an unknown
// placeholder stays as written.

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };

function withLang<T>(lang: string | undefined, fn: () => T): T {
  const prev = g.document;
  if (lang === undefined) delete g.document;
  else g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}

test('docLang: prefix match in any case, Hebrew otherwise and outside a browser', () => {
  expect(withLang('en-GB', () => docLang(['en', 'ar', 'ru']))).toBe('en');
  expect(withLang('EN', () => docLang(['en']))).toBe('en');
  expect(withLang('ru', () => docLang(['en', 'ar', 'ru']))).toBe('ru');
  expect(withLang('ru', () => docLang(['en']))).toBe('he'); // a module without Russian stays Hebrew
  expect(withLang('he', () => docLang(['en', 'ar', 'ru']))).toBe('he');
  expect(withLang('', () => docLang(['en']))).toBe('he');
  expect(withLang(undefined, () => docLang(['en']))).toBe('he');
});

test('fill: named placeholders, unknown names kept, no vars = the text itself', () => {
  expect(fill('{n} of {total}', { n: 3, total: 7 })).toBe('3 of 7');
  expect(fill('{n} of {total}', { n: 3 })).toBe('3 of {total}');
  expect(fill('{n}', undefined)).toBe('{n}');
  expect(fill('{n}', null)).toBe('{n}');
  expect(fill('{n}', { n: 0 })).toBe('0');
});

test('createCatalogue: the language, else Hebrew, else the key; tDynamic falls back', () => {
  const c = createCatalogue('test/core-spec', { a: 'א {n}', b: 'ב' } as Record<'a' | 'b', string>, { en: { a: 'A {n}' } });
  expect(withLang('en', () => c.t('a', { n: 1 }))).toBe('A 1');
  expect(withLang('en', () => c.t('b'))).toBe('ב');
  expect(withLang('he', () => c.t('a', { n: 2 }))).toBe('א 2');
  expect(c.t('a', null, 'en')).toBe('A {n}');
  expect(c.tDynamic('nope', 'b', null, 'en')).toBe('ב');
  expect(c.keys).toEqual(['a', 'b']);
  expect(registeredCatalogues().some((r) => r.name === 'test/core-spec')).toBe(true);
});

test('the refactored modules keep their behaviour', () => {
  expect(withLang('en', () => uiLang())).toBe('en');
  expect(withLang('he', () => uiLang())).toBe('he');
  expect(withLang('he', () => t('modes.live'))).toBe('שידור חי');
  expect(withLang('en', () => tf('deviceCard.since', { t: '10:00' }))).toBe('since 10:00');
  expect(elt('search', undefined, 'ru')).toBe('Поиск');
  expect(withLang('en', () => elt('search'))).not.toBe(elt('search', undefined, 'he'));
  expect(dwt('title' as never, undefined, 'he')).toBeTruthy();
});

test('no catalogue under src/i18n keeps its own copy of the detector or the filler', () => {
  const dir = new URL('../src/i18n/', import.meta.url);
  const own: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'core.ts' || f === 'ui-lang-boot.ts') continue; // the boot module sets <html lang> before core is loaded
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (/documentElement\.lang/.test(src)) own.push(`${f}: reads <html lang> itself`);
    if (/\.replace\(\/\\\{\(\\w\+\)\\\}\/g, \(m, k: string\) => \(k in \w+ \? String/.test(src)) own.push(`${f}: own {name} filler`);
  }
  expect(own).toEqual([]);
});

test('every catalogue module registers its tables (the missing-keys report reads the registry)', () => {
  const dir = new URL('../src/i18n/', import.meta.url);
  const notCatalogues = new Set(['core.ts', 'msg.ts', 'ui-lang.ts', 'ui-lang-boot.ts', 'bidi.ts', 'en.ts', 'frigate-en.ts', 'frigate-text.ts', 'entity-label.ts', 'event-codes.ts']);
  const missing = readdirSync(dir).filter((f) => f.endsWith('.ts') && !notCatalogues.has(f) && !/registerCatalogue\(/.test(readFileSync(new URL(f, dir), 'utf8')));
  expect(missing).toEqual([]);
});
