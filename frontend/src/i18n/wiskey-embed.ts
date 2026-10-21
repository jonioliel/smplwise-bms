/**
 * UXREST2-295: the words of the WisKey frame's loading and timeout states (screens/wiskey-embed.ts). Hebrew first; English, Arabic
 * and Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review (dev-marked).
 */
const he = {
  loading: 'טוען את WisKey…',
  unreachableTitle: 'לא ניתן לטעון את WisKey',
  unreachableHint: 'WisKey לא ענה בזמן. אפשר לנסות שוב.',
  retry: 'נסה שוב',
};
type Key = keyof typeof he;

const en: Record<Key, string> = {
  loading: 'Loading WisKey…',
  unreachableTitle: 'WisKey could not be loaded',
  unreachableHint: 'WisKey did not answer in time. You can try again.',
  retry: 'Try again',
};

const ar: Record<Key, string> = {
  loading: 'جارٍ تحميل WisKey…',
  unreachableTitle: 'تعذّر تحميل WisKey',
  unreachableHint: 'لم يستجب WisKey في الوقت المناسب. يمكنك المحاولة مرة أخرى.',
  retry: 'حاول مرة أخرى',
};

const ru: Record<Key, string> = {
  loading: 'Загрузка WisKey…',
  unreachableTitle: 'Не удалось загрузить WisKey',
  unreachableHint: 'WisKey не ответил вовремя. Попробуйте ещё раз.',
  retry: 'Повторить',
};

export type WetKey = Key;
export type WetLang = 'he' | 'en' | 'ar' | 'ru';

export function wetLang(): WetLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : l.startsWith('ar') ? 'ar' : l.startsWith('ru') ? 'ru' : 'he';
}

const TABLES: Record<WetLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const WET_DEV_MARKED: readonly WetLang[] = ['ar', 'ru'];

export function wet(key: Key, lang: WetLang = wetLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const WET_KEYS = Object.keys(he) as Key[];
export const WET_TABLES = TABLES;
