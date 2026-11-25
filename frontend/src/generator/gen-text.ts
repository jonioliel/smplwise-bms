import { he, uiLang } from '../i18n/he';
import { en } from '../i18n/en';

/**
 * GEN-UNITS-FIELD-2520: the generator settings texts of the ACTIVE language, shared by the settings screen (gen-settings, GEN-UNITS-FIELD-2490)
 * and the alert routing screen (gen-routing). English where the English catalogue has the key, else the Hebrew; a Hebrew page reads the Hebrew
 * catalogue object itself (its output is unchanged). Read at render time, never captured when a module is evaluated.
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
const active = (): GenText => (uiLang() === 'en' ? englishText() : he.generator);

/** `he.generator` of the active language (each top-level section resolved on read). */
export const GEN: GenText = new Proxy(he.generator, { get: (_t, k) => active()[k as keyof GenText] });
/** `he.generator.settings` of the active language (each key resolved on read). */
export const GEN_SETTINGS: GenText['settings'] = new Proxy(he.generator.settings, { get: (_t, k) => active().settings[k as keyof GenText['settings']] });
