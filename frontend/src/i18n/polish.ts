/**
 * POLISH-295 (owner approval 2026-10-25): the words of the polished home screen, the schedules and automations lists (rows, pages) and
 * their settings. Hebrew first; English, Arabic and Russian follow the document language. The Arabic and Russian columns are an INITIAL
 * translation and need a native review.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  prev: 'הקודם',
  next: 'הבא',
  pageOf: 'עמוד {n} מתוך {m}',
  pages: 'דפדוף',
  rows: 'שורות',
  review: 'לבדיקה',
  select: 'בחירה מרובה',
  selectDone: 'סיום בחירה',
  candles: 'כניסת שבת',
  havdalah: 'צאת שבת',
  alarm: 'אזעקה',
  listsHeading: 'תצוגת הרשימה',
  defaultView: 'תצוגת ברירת מחדל',
  perPageWide: 'פריטים בעמוד · מחשב',
  perPagePhone: 'פריטים בעמוד · טלפון',
  cardsPerPageWide: 'כרטיסים בעמוד · מחשב',
  cardsPerPagePhone: 'כרטיסים בעמוד · טלפון',
  infoHeading: 'שעון, מזג אוויר ושבת',
  infoBar: 'שורה דקה',
  infoCards: 'ווידג׳טים',
  saved: 'נשמר',
  readOnly: 'שינוי ההגדרות דורש הרשאת מנהל מערכת.',
  lastRun: 'ריצה אחרונה',
  nextRun: 'הרצה הבאה',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/polish').en>('en', 'i18n/polish', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/polish').ar>('ar', 'i18n/polish', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/polish').ru>('ru', 'i18n/polish', 'ru');

type PlLang = 'he' | 'en' | 'ar' | 'ru';

function plLang(): PlLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<PlLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const PL_DEV_MARKED: readonly PlLang[] = ['ar', 'ru'];

/** One phrase; `{n}`-style holes are filled from `vars`. */
export function pl(key: Key, vars: Record<string, string | number> = {}, lang: PlLang = plLang()): string {
  let s = TABLES[lang][key] ?? he[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const PL_KEYS = Object.keys(he) as Key[];
export const PL_TABLES = TABLES;

registerCatalogue('i18n/polish', { he, en, ar, ru }, PL_DEV_MARKED);
