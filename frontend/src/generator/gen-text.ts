import { he, uiLang } from '../i18n/he';
import { en } from '../i18n/en';
import { docLang } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

/**
 * GEN-UNITS-FIELD-2520: the generator settings texts of the ACTIVE language, shared by the settings screen (gen-settings, GEN-UNITS-FIELD-2490)
 * and the alert routing screen (gen-routing). English where the English catalogue has the key, else the Hebrew; a Hebrew page reads the Hebrew
 * catalogue object itself (its output is unchanged). Read at render time, never captured when a module is evaluated.
 * GEN-UNITS-ARRU-2530: an Arabic or Russian page reads the Hebrew with this module's own Arabic / Russian words merged over it - the unit words
 * inside the field frames and the labels of those fields (rated power, alert thresholds, retention windows). The main catalogue has no Arabic or
 * Russian column, so every other word of these screens stays Hebrew there, as on every other screen. An initial translation, dev-marked.
 */
type GenText = typeof he.generator;

const mergeText = <T extends object>(base: T, over?: object): T => {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over ?? {})) {
    const b = out[k];
    out[k] = typeof v === 'string' ? v : v && typeof v === 'object' && b && typeof b === 'object' ? mergeText(b as object, v as object) : b;
  }
  return out as T;
};
/** REVIEW-2490-FIXES-2500: the English table is built on an English read, from the English words in at that moment - not once when this
 * module is evaluated (a page that booted in Hebrew has no English pack yet; the in-place switch installs it later). Built again only when the
 * pack's table is another object (a pack installed anew). */
let englishFrom: object | undefined;
let english: GenText = he.generator;
const englishText = (): GenText => {
  const over = en.generator;
  if (over !== englishFrom) {
    englishFrom = over;
    english = mergeText(he.generator, over);
  }
  return english;
};

// initial translation - needs a native review (dev-marked)
const ar = packTable<typeof import('../i18n/lang/ar/generator/gen-text').ar>('ar', 'generator/gen-text', 'ar');

// initial translation - needs a native review (dev-marked)
const ru = packTable<typeof import('../i18n/lang/ru/generator/gen-text').ru>('ru', 'generator/gen-text', 'ru');

/** The Arabic / Russian words of this module, by language (live pack tables: the same object, filled in place when the pack arrives). */
export const GEN_TEXT_PACKS = { ar, ru } as const;
type PackLang = keyof typeof GEN_TEXT_PACKS;
/** Built on a read, from the words in at that moment; built again only when the pack's `settings` table is another object. */
const packFrom: Partial<Record<PackLang, object>> = {};
const packText: Partial<Record<PackLang, GenText>> = {};
const otherText = (l: PackLang): GenText => {
  const over = GEN_TEXT_PACKS[l].settings as object | undefined;
  if (!over) return he.generator; // the pack is not in yet: the Hebrew, as before
  if (packFrom[l] !== over || !packText[l]) {
    packFrom[l] = over;
    packText[l] = mergeText(he.generator, { settings: over });
  }
  return packText[l]!;
};
const active = (): GenText => {
  if (uiLang() === 'en') return englishText();
  const l = docLang(['ar', 'ru'] as const);
  return l === 'he' ? he.generator : otherText(l);
};

/** `he.generator` of the active language (each top-level section resolved on read). */
export const GEN: GenText = new Proxy(he.generator, { get: (_t, k) => active()[k as keyof GenText] });
/** `he.generator.settings` of the active language (each key resolved on read). */
export const GEN_SETTINGS: GenText['settings'] = new Proxy(he.generator.settings, { get: (_t, k) => active().settings[k as keyof GenText['settings']] });

/** GEN-SENSOR-NAMES-EN-2520: a word the server sends in Hebrew with an English twin (an alert type's `title_en`, the "requires sensor"
 * `needs_en`, a sensor role's `label_en`): the English on an English page when the server sent one, else the server's Hebrew word (a Hebrew
 * page - its output is unchanged - or an older server without the English field). */
export const genServerWord = <T extends string | null | undefined>(heWord: T, enWord?: string | null): T | string =>
  uiLang() === 'en' && enWord ? enWord : heWord;
