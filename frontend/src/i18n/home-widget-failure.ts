/**
 * UXREST2-295: the words of a home widget whose own read failed (screens/home-widgets.ts): the widget's slot says so with a retry, the
 * other widgets keep drawing. Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to the
 * Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked).
 */
const he = {
  failed: 'לא ניתן לטעון את הנתונים',
  retry: 'נסו שוב',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  failed: 'The data could not be loaded',
  retry: 'Try again',
};

const ar: Record<Key, string> = {
  failed: 'تعذّر تحميل البيانات',
  retry: 'حاول مرة أخرى',
};

const ru: Record<Key, string> = {
  failed: 'Не удалось загрузить данные',
  retry: 'Повторить',
};

export type HwfKey = Key;
export type HwfLang = 'he' | 'en' | 'ar' | 'ru';

export function hwfLang(): HwfLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<HwfLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const HWF_DEV_MARKED: readonly HwfLang[] = ['ar', 'ru'];

export function hwf(key: Key, lang: HwfLang = hwfLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const HWF_KEYS = Object.keys(he) as Key[];
export const HWF_TABLES = TABLES;
