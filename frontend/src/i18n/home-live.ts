/**
 * HOMELIVE-295: the two words of the home screen's refresh button when the live data is not current: the tooltip says when the data was last
 * read and that it is not current; the button itself carries only a tiny dot (clean operator screens: no line, no banner). Hebrew first;
 * English, Arabic and Russian follow the document language. The Arabic and Russian columns are an INITIAL translation and need a native review.
 */
const he = {
  updated: 'עודכן',
  stale: 'הנתונים אינם מעודכנים',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  updated: 'Updated',
  stale: 'The data is not current',
};

const ar: Record<Key, string> = {
  updated: 'آخر تحديث',
  stale: 'البيانات غير محدّثة',
};

const ru: Record<Key, string> = {
  updated: 'Обновлено',
  stale: 'Данные не актуальны',
};

export type HlLang = 'he' | 'en' | 'ar' | 'ru';

export function hlLang(): HlLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<HlLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const HL_DEV_MARKED: readonly HlLang[] = ['ar', 'ru'];

export function hl(key: Key, lang: HlLang = hlLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const HL_KEYS = Object.keys(he) as Key[];
export const HL_TABLES = TABLES;
