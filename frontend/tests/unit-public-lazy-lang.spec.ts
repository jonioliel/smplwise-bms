import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLAIM_TEXT, CLAIM_TEXT_KEYS, ct } from '../src/public-ticket/claim/claim-text';
import { QUOTE_TEXT, QUOTE_TEXT_KEYS, qt } from '../src/public-ticket/claim/quote-text';
import { ensureLang, forgetLangPacksForTests, holdForLang, langReady } from '../src/public-ticket/lang-packs';
import { CATALOGUES, LANG_SELF, LANGS, text, type Key } from '../src/public-ticket/strings';
import { loadPublicLangs } from './public-langs';

// LAZYLANG-295 (owner 2026-10-21): Arabic and Russian are lazy chunks of the vendor / ticket page; Hebrew and English stay
// synchronous. Node only:  npx playwright test -c playwright.unit.config.ts tests/unit-public-lazy-lang.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src/public-ticket');
const read = (f: string): string => readFileSync(path.join(SRC, f), 'utf8');
const HE_KEYS = Object.keys(CATALOGUES.he) as Key[];

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => forgetLangPacksForTests());
test.afterAll(loadPublicLangs); // the next spec of this worker finds the packs in

test('Hebrew and English are in the bundle and ready at once; Arabic and Russian are not, until asked for', () => {
  for (const l of ['he', 'en'] as const) {
    expect(langReady(l), l).toBe(true);
    expect(Object.keys(CATALOGUES[l]).sort(), l).toEqual([...HE_KEYS].sort());
    expect(CLAIM_TEXT[l], l).toBeDefined();
    expect(QUOTE_TEXT[l], l).toBeDefined();
  }
  for (const l of ['ar', 'ru'] as const) {
    expect(langReady(l), l).toBe(false);
    expect(CATALOGUES[l], l).toBeUndefined();
    expect(CLAIM_TEXT[l], l).toBeUndefined();
    expect(QUOTE_TEXT[l], l).toBeUndefined();
  }
});

test('until its words arrive a lazy language reads the text of the same direction - never an empty string or a key name', () => {
  for (const k of HE_KEYS) {
    expect(text('ar', k), `ar.${k}`).toBe(text('he', k)); // right to left, like Arabic
    expect(text('ru', k), `ru.${k}`).toBe(text('en', k)); // left to right, like Russian
  }
  for (const k of CLAIM_TEXT_KEYS) {
    expect(ct('ar', k), k).toBe(ct('he', k, undefined, { one: 'طلب خدمة', many: 'طلبات خدمة', gender: 'm' }));
    expect(ct('ru', k).trim(), k).not.toBe('');
  }
  for (const k of QUOTE_TEXT_KEYS) expect(qt('ru', k), k).not.toBe(k);
});

test('the page loader fetches a language once and then reads its own words; the picker names stay in the bundle', async () => {
  const [a, b] = await Promise.all([ensureLang('ar'), ensureLang('ar')]);
  expect([a, b]).toEqual([true, true]);
  expect(langReady('ar')).toBe(true);
  expect(langReady('ru')).toBe(false); // one language at a time
  expect(text('ar', 'langName')).toBe('العربية');
  expect(text('ar', 'retry')).not.toBe(text('he', 'retry'));
  expect(ct('ar', 'heading')).not.toBe(ct('he', 'heading'));
  expect(await ensureLang('ru')).toBe(true);
  for (const l of LANGS) {
    expect(LANG_SELF[l].langName, l).toBe(CATALOGUES[l]?.langName);
    expect(LANG_SELF[l].language, l).toBe(CATALOGUES[l]?.language);
  }
  expect(await ensureLang('he')).toBe(true);
});

/** A stand-in for the page root (the unit specs run without a DOM). */
function fakeRoot(first: object | null) {
  const root = { firstElementChild: first as object | null, replaceChildren(el: object) { root.firstElementChild = el; } };
  return root;
}

test('holdForLang: a lazy paint waits, an empty page gets the placeholder, and the repaint comes once the words are in', async () => {
  const repaints: string[] = [];
  const root = fakeRoot(null);
  const spinner = { spinner: true };
  const held = holdForLang('ru', root as unknown as HTMLElement, () => repaints.push('ru'), () => spinner as unknown as HTMLElement);
  expect(held).toBe(true);
  expect(root.firstElementChild).toBe(spinner);
  await ensureLang('ru');
  await Promise.resolve();
  expect(repaints).toEqual(['ru']);
  // ready languages paint at once
  expect(holdForLang('ru', root as unknown as HTMLElement, () => repaints.push('again'))).toBe(false);
  expect(holdForLang('he', root as unknown as HTMLElement, () => repaints.push('he'))).toBe(false);
  expect(repaints).toEqual(['ru']);
});

test('holdForLang: no repaint over a screen another page painted meanwhile; the screen on show is kept while waiting', async () => {
  const repaints: string[] = [];
  const shown = { screen: 'english' };
  const root = fakeRoot(shown);
  expect(holdForLang('ar', root as unknown as HTMLElement, () => repaints.push('ar'), () => ({}) as HTMLElement)).toBe(true);
  expect(root.firstElementChild).toBe(shown); // a language switch keeps the current screen, no placeholder over it
  root.replaceChildren({ screen: 'another page' });
  await ensureLang('ar');
  await Promise.resolve();
  expect(repaints).toEqual([]);
});

test('the packs are lazy chunks: nothing imports them statically, they import types only, and every page paint waits for them', () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(path.join(SRC, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (rel.endsWith('.ts')) files.push(rel);
    }
  };
  walk('');
  for (const f of files) {
    const src = read(f);
    expect(src, f).not.toMatch(/from\s+'[^']*lang\/lang-(ar|ru)'/); // only `import('./lang/lang-xx')` in lang-packs.ts
  }
  expect(read('lang-packs.ts')).toContain("ar: () => import('./lang/lang-ar')");
  expect(read('lang-packs.ts')).toContain("ru: () => import('./lang/lang-ru')");
  for (const f of ['lang/lang-ar.ts', 'lang/lang-ru.ts']) {
    for (const m of read(f).matchAll(/^import\s+(type\s+)?/gm)) expect(m[1], `${f}: ${m[0]}`).toBe('type ');
  }
  // the bundle's catalogues keep no Arabic / Russian catalogue of their own
  for (const f of ['strings.ts', 'claim/claim-text.ts', 'claim/quote-text.ts']) expect(read(f), f).not.toMatch(/^const (ar|ru)\b/m);
  // the three pages that paint the shared words hold their render for a lazy language
  for (const f of ['main.ts', 'rfq/rfq-page.ts', 'portal/portal-page.ts']) expect(read(f), f).toMatch(/private render\(\): void \{\n(?:.*\n){0,2}\s+if \(holdForLang\(this\.lang,/);
});
