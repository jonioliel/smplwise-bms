/**
 * CR-I18N-LAZY-LANG-2443 (code review 07:F11, owner O4 = a): the non-Hebrew text tables are language packs, fetched only when the
 * page is in that language. Hebrew (the default and every catalogue's fallback) stays in the modules and costs nothing.
 *
 * How a catalogue reads a pack: where a module had `const en = { ... }`, it now has `const en = packTable('en', '<module>', 'en')`
 * - a LIVE table: the same object for the life of the page, empty until the pack is installed, then filled in place. Everything
 * that kept a reference (the module's TABLES, `registerCatalogue`, an alias such as `PF_EN = en`) sees the words once they are in.
 * Entries that read something of the module stay in the module: `withEntries(packTable(...), { tab: NAV_XT.en.tab })`.
 * The texts themselves live under src/i18n/lang/<lang>/<module path>.ts; src/i18n/lang/<lang>.ts gathers them into one chunk per
 * language (scripts/i18n-split-langs.mjs moves inline tables and regenerates those files).
 *
 * When the words arrive - so nothing renders in the wrong language and no text flashes:
 *   - the page: this module waits (top-level await) for the pack of the language `<html lang>` carries when it is evaluated. The
 *     language is on `<html>` before (i18n/ui-lang-boot.ts is main.ts's first import), and every catalogue imports this module,
 *     so no catalogue - and nothing that renders a catalogue's text - is evaluated before its pack is installed. Hebrew waits for
 *     nothing. The language switch reloads the page (i18n/ui-lang.ts), so the same wait covers it; the in-place path (storage
 *     blocked) awaits `ensureLangPack` before it changes `<html lang>`.
 *   - a later change of `<html lang>` by someone else (an embedding page, a test): the pack is fetched and the rendered
 *     components are asked to render again once it is in.
 *   - Node (the unit specs, the missing-keys report): every pack is installed while this module is evaluated, so a catalogue's
 *     tables are complete as before.
 * A pack chunk imports nothing of the application (it must not: the application waits for it).
 */
import { docLangRaw } from './core';

/** The languages that have a pack. Hebrew has none: it is in the modules. */
type PackLang = 'en' | 'ar' | 'ru';
export const PACK_LANGS: readonly PackLang[] = ['en', 'ar', 'ru'];

/** A language pack: per module (its path under src/, without `.ts`), its tables by export name. */
export type LangPack = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const LOADERS: Record<PackLang, () => Promise<{ PACK: LangPack }>> = {
  en: () => import('./lang/en'),
  ar: () => import('./lang/ar'),
  ru: () => import('./lang/ru'),
};

const LIVE = new Map<string, Record<string, unknown>>();
const READY = new Set<PackLang>();
const PENDING = new Map<PackLang, Promise<boolean>>();
let loaders: Record<PackLang, () => Promise<{ PACK: LangPack }>> = LOADERS;

function live(lang: PackLang, module: string, name: string): Record<string, unknown> {
  const key = `${lang}|${module}|${name}`;
  let t = LIVE.get(key);
  if (!t) {
    t = {};
    LIVE.set(key, t);
  }
  return t;
}

/** The live table `name` of `module` in `lang` (typed as the pack file's literal: `packTable<typeof import('<pack file>').en>`). */
export function packTable<T extends object>(lang: PackLang, module: string, name: string): T {
  return live(lang, module, name) as T;
}

/**
 * Entries a module keeps itself in a live table, because they read something of the module (a shell label `tab: NAV_XT.en.tab`,
 * a formatter): `withEntries(packTable<...>(...), { tab: NAV_XT.en.tab })`. They are there before the pack arrives; the same
 * object is returned.
 */
export function withEntries<T extends object, X extends object>(table: T, entries: X): T & X {
  return Object.assign(table, entries);
}

/** Fills the live tables of `lang` from a pack (the loader does this; specs may install a pack of their own). */
export function installLangPack(lang: PackLang, pack: LangPack): void {
  for (const [module, tables] of Object.entries(pack)) {
    for (const [name, table] of Object.entries(tables)) {
      if (table && typeof table === 'object') Object.assign(live(lang, module, name), table);
    }
  }
  READY.add(lang);
}

/** True once the words of `lang` are in. */
export function langPackReady(lang: PackLang): boolean {
  return READY.has(lang);
}

/** The pack language `<html lang>` asks for (`en-GB` -> en), null for Hebrew or anything without a pack. */
export function packLangOf(raw: string): PackLang | null {
  const l = raw.toLowerCase();
  return PACK_LANGS.find((p) => l.startsWith(p)) ?? null;
}

/** Fetches and installs `lang` once (concurrent callers share the request). False when the chunk could not be fetched (retried next time). */
export function ensureLangPack(lang: PackLang): Promise<boolean> {
  if (READY.has(lang)) return Promise.resolve(true);
  let p = PENDING.get(lang);
  if (!p) {
    p = loaders[lang]().then(
      (m) => {
        installLangPack(lang, m.PACK);
        PENDING.delete(lang);
        return true;
      },
      () => {
        PENDING.delete(lang); // offline or a stale chunk name: the page stays in Hebrew words, the next call tries again
        return false;
      },
    );
    PENDING.set(lang, p);
  }
  return p;
}

/** Specs: replace the chunk loaders (null restores them) and forget which packs are in. The live tables keep their words. */
export function setLangPackLoadersForTests(next: Partial<Record<PackLang, () => Promise<{ PACK: LangPack }>>> | null): void {
  loaders = next ? { ...LOADERS, ...next } : LOADERS;
  READY.clear();
  PENDING.clear();
}

/** Asks every rendered Lit component (through open shadow roots) to render again. */
function refreshRendered(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const update = (el as { requestUpdate?: () => void }).requestUpdate;
    if (typeof update === 'function') update.call(el);
    if (el.shadowRoot) refreshRendered(el.shadowRoot);
  }
}

function watchDocLang(): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.documentElement) return;
  new MutationObserver(() => {
    const l = packLangOf(docLangRaw());
    if (l && !READY.has(l)) void ensureLangPack(l).then((ok) => ok && refreshRendered(document));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

const IN_NODE = typeof (globalThis as { process?: { versions?: { node?: unknown } } }).process?.versions?.node === 'string';
if (IN_NODE) {
  await Promise.all(PACK_LANGS.map(ensureLangPack));
} else {
  const boot = packLangOf(docLangRaw());
  if (boot) await ensureLangPack(boot);
  watchDocLang();
}
