import { ensureLang } from '../src/public-ticket/lang-packs';

/**
 * LAZYLANG-295: Arabic and Russian are lazy chunks of the vendor page (src/public-ticket/lang-packs.ts). Unit specs that read their
 * words load them first through the page's own loader (the real dynamic import), so the parity and wording checks still see all
 * four languages. A pack that does not load fails the spec - never a silent fallback to Hebrew / English.
 */
export async function loadPublicLangs(): Promise<void> {
  for (const lang of ['ar', 'ru'] as const) {
    if (!(await ensureLang(lang))) throw new Error(`the ${lang} language pack did not load`);
  }
}

/** The source text of the lazy packs (for the source-count guards that used to read the catalogue files alone). */
export const LANG_PACK_FILES = ['lang/lang-ar.ts', 'lang/lang-ru.ts'] as const;
