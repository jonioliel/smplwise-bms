/**
 * GENWIDGET 2.9.3: the words of the generator HOME widget. Hebrew first; English, Arabic and Russian columns follow the document language
 * (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked).
 * `{n}` placeholders are filled by `gwt(key, { n })`. Operator words only: the home platform is never named.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'גנרטור',
  stateStandby: 'בהמתנה',
  stateRunning: 'פועל',
  stateStarting: 'מתניע',
  stateCooling: 'בקירור',
  stateAlarm: 'התראה',
  stateFault: 'תקלה',
  stateUnknown: 'לא ידוע',
  supplyMains: 'על רשת החשמל',
  supplyGenerator: 'על גנרטור',
  supplyNone: 'אין חשמל רשת',
  supplyUnknown: 'מצב אספקה לא ידוע',
  summary: '{n} גנרטורים',
  summaryRunning: '{n} פועלים',
  summaryFault: '{n} בתקלה',
  fuel: 'דלק {n}%',
  load: 'עומס {n}%',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/generator-widget').en>('en', 'i18n/generator-widget', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/generator-widget').ar>('ar', 'i18n/generator-widget', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/generator-widget').ru>('ru', 'i18n/generator-widget', 'ru');

export type GwtKey = Key;
export type GwtLang = 'he' | 'en' | 'ar' | 'ru';

export function gwtLang(): GwtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<GwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const GWT_DEV_MARKED: readonly GwtLang[] = ['ar', 'ru'];

export function gwt(key: Key, vars?: Record<string, string | number>, lang: GwtLang = gwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const GWT_KEYS = Object.keys(he) as Key[];
export const GWT_TABLES = TABLES;

registerCatalogue('i18n/generator-widget', { he, en, ar, ru }, GWT_DEV_MARKED);
