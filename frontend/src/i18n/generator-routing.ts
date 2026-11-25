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
  // GEN-UNITS-FIELD-2520: the minutes sit inside the field's frame (sw-field unit); the label names the value, not its unit
  criticalDelay: 'זמן עד הסלמה של התראה קריטית',
  unitMin: 'דקות',
  escalateAfter: 'זמן עד הסלמה',
  escalateUntil: 'עד הסלמה',
  // GEN-UNITS-FIELD-2520: words the server sends in Hebrew only (the alert groups, the template placeholders), keyed here so another page
  // language reads them in its own words; a Hebrew page keeps the server's word (grtServer)
  group_engine: 'מנוע',
  group_fuel: 'דלק',
  group_electrical: 'חשמל הגנרטור',
  group_mains: 'רשת ומתג העברה',
  group_maintenance: 'תחזוקה ומבחנים',
  group_comm: 'תקשורת ומצב בקר',
  ph_name: 'שם הגנרטור',
  ph_detail: 'פירוט הערך (למשל מפלס דלק 18%)',
  ph_type: 'סוג ההתראה',
  ph_severity: 'חומרה',
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

/** GEN-UNITS-FIELD-2520: a word the server sends in Hebrew only (an alert group's title, a template placeholder's description) in the page
 * language: the catalogue's word for `key` in English / Arabic / Russian; a Hebrew page - or a key / language without one - keeps the server's word. */
export function grtServer(key: string, server: string, lang: GrtLang = grtLang()): string {
  if (lang === 'he' || !(key in he)) return server;
  return TABLES[lang][key as Key] ?? server;
}

export const GRT_KEYS = Object.keys(he) as Key[];
export const GRT_TABLES = TABLES;

registerCatalogue('i18n/generator-routing', { he, en, ar, ru }, GRT_DEV_MARKED);
