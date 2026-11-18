/**
 * HOMELIVE-295: the two words of the home screen's refresh button when the live data is not current: the tooltip says when the data was last
 * read and that it is not current; the button itself carries only a tiny dot (clean operator screens: no line, no banner). Hebrew first;
 * English, Arabic and Russian follow the document language. The Arabic and Russian columns are an INITIAL translation and need a native review.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  updated: 'עודכן',
  stale: 'הנתונים אינם מעודכנים',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/home-live').en>('en', 'i18n/home-live', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/home-live').ar>('ar', 'i18n/home-live', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/home-live').ru>('ru', 'i18n/home-live', 'ru');

type HlLang = 'he' | 'en' | 'ar' | 'ru';

function hlLang(): HlLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<HlLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const HL_DEV_MARKED: readonly HlLang[] = ['ar', 'ru'];

export function hl(key: Key, lang: HlLang = hlLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const HL_KEYS = Object.keys(he) as Key[];
export const HL_TABLES = TABLES;

registerCatalogue('i18n/home-live', { he, en, ar, ru }, HL_DEV_MARKED);
