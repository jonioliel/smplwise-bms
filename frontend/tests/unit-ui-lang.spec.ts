import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// I18N-EN-SWITCH-2438 (owner round 32, Q-SYS-7 b): the interface language - Hebrew by default, English by the user's own choice,
// stored on the server (`ui.lang`); the page starts in this browser's copy of it, the server's value wins with ONE reload, and a
// page whose copy cannot be kept never reloads in a loop. Direction follows the language.

type Root = { lang: string; dir: string };
type G = { document?: { documentElement: Root }; localStorage?: Storage; location?: unknown };
const g = globalThis as unknown as G;

class MemStorage {
  private m = new Map<string, string>();
  constructor(private broken = false) {}
  getItem(k: string) {
    if (this.broken) throw new Error('blocked');
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.broken) throw new Error('blocked');
    this.m.set(k, v);
  }
  removeItem(k: string) {
    if (this.broken) throw new Error('blocked');
    this.m.delete(k);
  }
}

function page(lang = 'he', storage: MemStorage | null = new MemStorage()) {
  g.document = { documentElement: { lang, dir: lang === 'he' ? 'rtl' : 'ltr' } };
  if (storage) g.localStorage = storage as unknown as Storage;
  else delete g.localStorage;
  return g.document.documentElement;
}

test.afterEach(() => {
  delete g.document;
  delete g.localStorage;
});

test('the preference value: he / en, anything else is Hebrew', async () => {
  const { uiLangFromPref, isUiLang, UI_LANGS } = await import('../src/i18n/ui-lang');
  expect(UI_LANGS).toEqual(['he', 'en']);
  expect(uiLangFromPref('en')).toBe('en');
  for (const v of [null, undefined, '', 'ar', 'ru', 'EN', 1]) expect(uiLangFromPref(v)).toBe('he');
  expect(isUiLang('ru')).toBe(false);
});

test('sync: the server value differs from the page -> mirror + one reload; same value -> nothing', async () => {
  const m = await import('../src/i18n/ui-lang');
  const root = page('he');
  m.bootUiLang();
  let reloads = 0;
  m.setReloadHookForTests(() => reloads++);
  expect(await m.syncUiLang(async () => ({ prefs: { 'ui.lang': 'en' } }))).toBe('en');
  expect(reloads).toBe(1);
  expect(g.localStorage!.getItem(m.UI_LANG_MIRROR)).toBe('en');
  expect(root.lang).toBe('he'); // the reload brings the language, not an in-place switch
  // the page that reloaded starts in English (the boot step applies the mirror)
  m.bootUiLang();
  expect(root.lang).toBe('en');
  expect(root.dir).toBe('ltr');
  reloads = 0;
  expect(await m.syncUiLang(async () => ({ prefs: { 'ui.lang': null } }))).toBe('he');
  expect(reloads).toBe(1);
  expect(g.localStorage!.getItem(m.UI_LANG_MIRROR)).toBeNull(); // Hebrew = no copy kept
});

test('sync: a later change of <html lang> by a test or a host page is not undone', async () => {
  const m = await import('../src/i18n/ui-lang');
  const root = page('he');
  m.bootUiLang();
  let reloads = 0;
  m.setReloadHookForTests(() => reloads++);
  root.lang = 'en'; // set after the page started in Hebrew (the evidence specs do this)
  expect(await m.syncUiLang(async () => ({ prefs: {} }))).toBe('he');
  expect(reloads).toBe(0);
  expect(root.lang).toBe('en');
});

test('sync: storage blocked -> the language is applied in place, never a reload loop', async () => {
  const m = await import('../src/i18n/ui-lang');
  const root = page('he', new MemStorage(true));
  m.bootUiLang();
  let reloads = 0;
  m.setReloadHookForTests(() => reloads++);
  expect(await m.syncUiLang(async () => ({ prefs: { 'ui.lang': 'en' } }))).toBe('en');
  expect(reloads).toBe(0);
  expect(root.lang).toBe('en');
  expect(root.dir).toBe('ltr');
});

test('sync: a failed read leaves the page as it is', async () => {
  const m = await import('../src/i18n/ui-lang');
  const root = page('he');
  m.bootUiLang();
  let reloads = 0;
  m.setReloadHookForTests(() => reloads++);
  expect(await m.syncUiLang(async () => Promise.reject(new Error('401')))).toBeNull();
  expect(reloads).toBe(0);
  expect(root.lang).toBe('he');
});

test('set: saves first (Hebrew as "not set"), then reloads; a refused save changes nothing', async () => {
  const m = await import('../src/i18n/ui-lang');
  page('he');
  m.bootUiLang();
  let reloads = 0;
  m.setReloadHookForTests(() => reloads++);
  const saved: unknown[] = [];
  await m.setUiLang('en', async (v) => saved.push(v));
  expect(saved).toEqual(['en']);
  expect(reloads).toBe(1);
  page('en');
  await m.setUiLang('he', async (v) => saved.push(v));
  expect(saved).toEqual(['en', null]);
  expect(reloads).toBe(2);
  page('he');
  await expect(m.setUiLang('en', async () => Promise.reject(new Error('422')))).rejects.toThrow('422');
  expect(reloads).toBe(2);
  expect(g.localStorage!.getItem(m.UI_LANG_MIRROR)).toBeNull();
});

test('source-text tables: Hebrew unchanged, English from the table, a missing text stays Hebrew, placeholders filled', async () => {
  const { msgCatalogue } = await import('../src/i18n/msg');
  const tr = msgCatalogue('msg/spec', { 'שפה': 'Language', 'עוד {n}': '{n} more' });
  page('he');
  expect(tr('שפה')).toBe('שפה');
  expect(tr('עוד {n}', { n: 3 })).toBe('עוד 3');
  page('en');
  expect(tr('שפה')).toBe('Language');
  expect(tr('עוד {n}', { n: 3 })).toBe('3 more');
  expect(tr('לא מתורגם')).toBe('לא מתורגם');
});

test('wiring: the boot module is the first import of main.ts and imports nothing; the menu offers he / en only', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  expect(main.split('\n')[0]).toContain("import './i18n/ui-lang-boot'");
  expect(main).toContain('void syncUiLang()');
  const boot = readFileSync(new URL('../src/i18n/ui-lang-boot.ts', import.meta.url), 'utf8');
  expect(boot).not.toMatch(/^import /m);
  const prefs = readFileSync(new URL('../src/shell/sw-lang-prefs.ts', import.meta.url), 'utf8');
  expect(prefs).toContain("UI_LANG_NAMES: Record<UiLang, string> = { he: 'עברית', en: 'English' }");
  const menu = readFileSync(new URL('../src/shell/sw-user-menu.ts', import.meta.url), 'utf8');
  expect(menu).toContain('<sw-lang-prefs></sw-lang-prefs>');
  expect(menu).toContain('data-my-lang');
});
