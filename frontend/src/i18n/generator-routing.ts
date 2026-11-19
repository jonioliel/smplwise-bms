/**
 * GENALERT-295: the words added to Settings > Infrastructure > Generator > alert routing - the default recipients per severity, the first-run
 * "nobody is set" state and the one-line notes next to the critical row. Hebrew first; English, Arabic and Russian columns follow the document
 * language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked).
 * `{n}` placeholders are filled by `grt(key, { n })`. Operator words only: the home platform is never named.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  emptyTitle: 'לא נבחרו נמענים להתראות הגנרטור',
  emptyCritical: 'רק התראה קריטית שלא אושרה מגיעה למנהלי המערכת, אחרי {n} דקות',
  defaultsTitle: 'ברירת מחדל לפי חומרה',
  defaultsSub: 'סוג התראה ללא נמענים משלו מקבל את בחירת החומרה שלו',
  criticalNote: 'התראה קריטית תמיד מסלימה למנהלי המערכת אחרי {n} דקות, גם כשההסלמה כבויה',
  criticalQuiet: 'התראה קריטית אינה נעצרת בשעות שקט',
  criticalDelay: 'דקות עד הסלמה של התראה קריטית',
  editDefault: 'ברירת מחדל: {name}',
  inheritedFrom: 'מהחומרה',
  colEscalate: 'הסלמה',
  always: 'תמיד',
  saved: 'נשמר',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/generator-routing').en>('en', 'i18n/generator-routing', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/generator-routing').ar>('ar', 'i18n/generator-routing', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/generator-routing').ru>('ru', 'i18n/generator-routing', 'ru');

type GrtLang = 'he' | 'en' | 'ar' | 'ru';

function grtLang(): GrtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<GrtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
const GRT_DEV_MARKED: readonly GrtLang[] = ['ar', 'ru'];

export function grt(key: Key, vars?: Record<string, string | number>, lang: GrtLang = grtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const GRT_KEYS = Object.keys(he) as Key[];
export const GRT_TABLES = TABLES;

registerCatalogue('i18n/generator-routing', { he, en, ar, ru }, GRT_DEV_MARKED);
