/**
 * LAZYLANG-295 (owner 2026-10-21): Arabic and Russian are optional languages of the vendor / ticket page, so their words are
 * not in the page bundle. Each is one lazy chunk (`lang/lang-ar.ts`, `lang/lang-ru.ts`: the page strings, the claim words and the
 * quote words together) fetched only when a page speaks it. Hebrew and English stay synchronous and unchanged.
 *
 * A page that paints in a lazy language first asks `holdForLang`: while the chunk is on its way the current screen stays as it is
 * (or a neutral spinner on an empty page), and the page paints once the chunk is in - no flash of another language, no missing
 * key, the direction is the language's own from the first paint. A chunk that cannot be fetched settles as "failed": the page
 * then paints with the fallback text (Arabic -> Hebrew, Russian -> English: the same direction), never with empty keys.
 */

export type LazyLang = 'ar' | 'ru';

/** One language's lazy words; the shapes are checked in lang/lang-*.ts against the Hebrew catalogues (type-only imports). */
export interface LangPack {
  strings: Record<string, string>;
  claim: Record<string, string>;
  quote: Record<string, string>;
}

/** The text used until (or instead of, when it fails) a lazy language arrives: the same writing direction. */
export const FALLBACK_LANG: Readonly<Record<LazyLang, 'he' | 'en'>> = { ar: 'he', ru: 'en' };

const PACKS: Partial<Record<LazyLang, LangPack>> = {};
const FAILED = new Set<LazyLang>();
const PENDING = new Map<LazyLang, Promise<boolean>>();

const LOADERS: Readonly<Record<LazyLang, () => Promise<{ default: LangPack }>>> = {
  ar: () => import('./lang/lang-ar'),
  ru: () => import('./lang/lang-ru'),
};

export function isLazyLang(lang: unknown): lang is LazyLang {
  return lang === 'ar' || lang === 'ru';
}

/** The lazy words of a language, when they have arrived. */
export function langPack(lang: string): LangPack | undefined {
  return isLazyLang(lang) ? PACKS[lang] : undefined;
}

/** Registers a language's words (the loader does it; unit specs register the packs they import statically). */
export function registerLangPack(lang: LazyLang, pack: LangPack): void {
  PACKS[lang] = pack;
  FAILED.delete(lang);
}

/** Unit specs only: back to "nothing arrived yet" (the module state is shared by the specs of one worker). */
export function forgetLangPacksForTests(): void {
  for (const l of ['ar', 'ru'] as const) delete PACKS[l];
  FAILED.clear();
}

/** True when a page may paint in this language now: it is synchronous (he / en), its words are in, or fetching them failed. */
export function langReady(lang: string): boolean {
  return !isLazyLang(lang) || !!PACKS[lang] || FAILED.has(lang);
}

/** Fetches a lazy language once (a failed fetch may be retried by a later call). Resolves true when its words are in. */
export function ensureLang(lang: string): Promise<boolean> {
  if (!isLazyLang(lang)) return Promise.resolve(true);
  if (PACKS[lang]) return Promise.resolve(true);
  let p = PENDING.get(lang);
  if (!p) {
    p = LOADERS[lang]().then(
      (m) => {
        registerLangPack(lang, m.default);
        return true;
      },
      () => {
        FAILED.add(lang);
        return false;
      },
    ).finally(() => PENDING.delete(lang));
    PENDING.set(lang, p);
  }
  return p;
}

/**
 * Called first by a page's render: false = paint now. True = the language is on its way - the caller returns without painting;
 * `repaint` runs once it settles, unless something else painted the root meanwhile (another page took over, or this page painted
 * in a language that was ready). An empty root gets `placeholder` (a neutral spinner) so the page is never blank.
 */
export function holdForLang(lang: string, root: HTMLElement, repaint: () => void, placeholder?: () => HTMLElement): boolean {
  if (langReady(lang)) return false;
  if (!root.firstElementChild && placeholder) root.replaceChildren(placeholder());
  const shown = root.firstElementChild;
  void ensureLang(lang).then(() => {
    if (root.firstElementChild === shown) repaint();
  });
  return true;
}
