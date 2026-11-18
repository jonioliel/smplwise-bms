/**
 * UXREST2-295: the words of the WisKey frame's loading and timeout states (screens/wiskey-embed.ts). Hebrew first; English, Arabic
 * and Russian follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review (dev-marked).
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  loading: 'טוען את WisKey…',
  unreachableTitle: 'לא ניתן לטעון את WisKey',
  unreachableHint: 'WisKey לא ענה בזמן. אפשר לנסות שוב.',
  retry: 'נסה שוב',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wiskey-embed').en>('en', 'i18n/wiskey-embed', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/wiskey-embed').ar>('ar', 'i18n/wiskey-embed', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/wiskey-embed').ru>('ru', 'i18n/wiskey-embed', 'ru');

type WetLang = 'he' | 'en' | 'ar' | 'ru';

function wetLang(): WetLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<WetLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const WET_DEV_MARKED: readonly WetLang[] = ['ar', 'ru'];

export function wet(key: Key, lang: WetLang = wetLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const WET_KEYS = Object.keys(he) as Key[];
export const WET_TABLES = TABLES;

registerCatalogue('i18n/wiskey-embed', { he, en, ar, ru }, WET_DEV_MARKED);
