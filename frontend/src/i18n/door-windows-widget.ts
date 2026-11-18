/**
 * DOORWIN2-295: the words of the doors HOME widget (door windows and the emergency entry). Hebrew first; English, Arabic and Russian columns follow
 * the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native
 * review (dev-marked). `{n}`, `{name}`, `{t}` placeholders are filled by `dwwt(key, { ... })`. Operator words only: the home platform and the
 * intercom platform are never named, and no sentence explains anything (a clean operator card).
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'דלתות',
  emergency: 'חירום',
  emergencyAria: 'פתיחת לחצני החירום',
  incident: 'מצב חירום',
  drill: 'תרגיל חירום',
  unconfirmed: 'חזרה למצב רגיל לא אושרה: {n}',
  notStarted: 'חלון לא התחיל: {n}',
  foreign: 'תוכנית שהושהתה: {n}',
  openNow: 'פתוחות כעת: {n}',
  openUntil: '{name} · עד {t}',
  next: 'הבא: {name} · {t}',
  none: 'אין חלונות מתוכננים',
  rowUnconfirmed: '{name} · לא אושר',
  rowNotStarted: '{name} · לא התחיל',
  rowForeign: '{name} · הושהתה',
  rowActive: '{name} · עד {t}',
  rowNext: '{name} · {t}',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/door-windows-widget').en>('en', 'i18n/door-windows-widget', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/door-windows-widget').ar>('ar', 'i18n/door-windows-widget', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/door-windows-widget').ru>('ru', 'i18n/door-windows-widget', 'ru');

export type DwwtKey = Key;
type DwwtLang = 'he' | 'en' | 'ar' | 'ru';

function dwwtLang(): DwwtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<DwwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const DWWT_DEV_MARKED: readonly DwwtLang[] = ['ar', 'ru'];

export function dwwt(key: Key, vars: Record<string, string | number> = {}, lang: DwwtLang = dwwtLang()): string {
  const text = TABLES[lang][key] ?? he[key];
  return text.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

export const DWWT_KEYS = Object.keys(he) as Key[];
export const DWWT_TABLES = TABLES;

registerCatalogue('i18n/door-windows-widget', { he, en, ar, ru }, DWWT_DEV_MARKED);
