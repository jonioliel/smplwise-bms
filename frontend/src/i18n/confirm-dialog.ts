// CR-CONFIRM-DIALOG-2438: the words of the shared confirmation dialog (components/confirm-dialog.ts), which replaced the browser's
// native confirm() box. The question itself comes from the caller, in the caller's own table.

import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  heading: 'נדרש אישור',
  ok: 'אישור',
  cancel: 'ביטול',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/confirm-dialog').en>('en', 'i18n/confirm-dialog', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/confirm-dialog').ar>('ar', 'i18n/confirm-dialog', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/confirm-dialog').ru>('ru', 'i18n/confirm-dialog', 'ru');

type CdLang = 'he' | 'en' | 'ar' | 'ru';

function cdLang(): CdLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<CdLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const CD_DEV_MARKED: readonly CdLang[] = ['ar', 'ru'];

export function cdt(key: Key, lang: CdLang = cdLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const CD_KEYS = Object.keys(he) as Key[];
export const CD_TABLES = TABLES;

registerCatalogue('i18n/confirm-dialog', { he, en, ar, ru }, CD_DEV_MARKED);
