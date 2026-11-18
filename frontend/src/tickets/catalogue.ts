/**
 * CR-TK-CATALOGUE-2440 (review 08:F07) - the one implementation of a tickets text catalogue.
 *
 * About twenty `*-text.ts` modules each carried the same twelve lines: the raw template of a key in a language (English falls back to
 * Hebrew), the text function (the template in the document's language, the module's names rendered - D33 - then the `{var}`s) and the
 * two key lists the completeness specs read. Each module keeps its two dictionaries and its exported names; the lines come from here.
 *
 * No dictionary lives in this module, and it must not import `./text` (the main catalogue is built with it): the language comes from
 * i18n/nav-labels, where it is defined.
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from '../i18n/nav-labels';

type CatalogueLang = 'he' | 'en';
export type TextVars = Record<string, string | number>;

/** Fill the `{var}`s of a text; a name that `vars` does not carry stays as written. */
export function fillVars(text: string, vars?: TextVars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** A raw template as the screens show it: the module's names rendered in `lang` (D33), then the `{var}`s - in that order, so a typed
 * value is never read as a naming token. */
export function renderText(raw: string, lang: CatalogueLang, vars?: TextVars): string {
  return fillVars(tn(raw, lang as TicketLang), vars);
}

export interface Catalogue<K extends string> {
  /** The raw template of a key in a language (the unit tests and the completeness specs read it); English falls back to Hebrew. */
  template: (key: K, lang?: CatalogueLang) => string;
  /** A text: the template in the document's language, the module's names rendered (D33), then the `{var}`s. */
  t: (key: K, vars?: TextVars) => string;
  /** Every key of the Hebrew dictionary, in its order. */
  KEYS: K[];
  /** Every key the English dictionary carries, in its order. */
  EN_KEYS: K[];
}

export function makeCatalogue<K extends string>(he: Readonly<Record<K, string>>, en: Readonly<Partial<Record<K, string>>>): Catalogue<K> {
  const template = (key: K, lang: CatalogueLang = ticketsLang()): string => (lang === 'en' ? en[key] : undefined) ?? he[key];
  const t = (key: K, vars?: TextVars): string => {
    const lang = ticketsLang();
    return renderText(template(key, lang), lang, vars);
  };
  return { template, t, KEYS: Object.keys(he) as K[], EN_KEYS: Object.keys(en) as K[] };
}
