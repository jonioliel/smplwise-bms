/**
 * VENDORQ2-295: the strings of Settings > the module > message channel > "Reports to vendors" (`<tickets-reports-settings>`): the switch
 * for a module's reports to external contacts through the message queue, the e-mail channel and the documents sent by a temporary link
 * (CR-VENDORQ-294). A settings page may name WhatsApp and e-mail; the home platform is never named. Hebrew first; English, Arabic and
 * Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL
 * translation and need a native review. No explanatory paragraphs (clean operator screens): labels and units only.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'דוחות לספקים',
  toContacts: 'שליחת דוחות לאנשי קשר חיצוניים',
  email: 'שליחה גם במייל',
  documents: 'מסמך בקישור זמני',
  hours: 'תוקף הקישור',
  hoursUnit: 'שעות',
  opens: 'הורדות לקישור',
  opensUnit: 'פעמים',
  save: 'שמירה',
  saved: 'נשמר',
  failed: 'השמירה נכשלה',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/vendor-reports').en>('en', 'i18n/vendor-reports', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/vendor-reports').ar>('ar', 'i18n/vendor-reports', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/vendor-reports').ru>('ru', 'i18n/vendor-reports', 'ru');

export type VrtKey = Key;
export type VrtLang = 'he' | 'en' | 'ar' | 'ru';

export function vrtLang(): VrtLang {
  return docLang(['en', 'ar', 'ru']);
}

export const VRT_TABLES: Record<VrtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
export const VRT_KEYS = Object.keys(he) as Key[];

export function vrt(key: Key, lang: VrtLang = vrtLang()): string {
  return VRT_TABLES[lang][key] ?? he[key] ?? key;
}

registerCatalogue('i18n/vendor-reports', { he, en, ar, ru });
