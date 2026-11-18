/**
 * usr2-passkeys-only-mode: the words of the optional per-user "passkeys only" sign-in mode (החשבון שלי › מפתחות גישה, and Settings ›
 * משתמשים והרשאות › משתמשי Arx). Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to
 * the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review (dev-marked, like the elevators).
 * Short labels only: operator screens carry no hint paragraphs; the server's refusal text (user_message) explains a refusal.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  onlyLabel: 'כניסה עם מפתח גישה בלבד',
  onlyOn: 'כניסה עם מפתח גישה בלבד: פעילה',
  onlyEnable: 'הפעלה',
  onlyDisable: 'כיבוי',
  onlyConfirmOn: 'הכניסה בסיסמה תיחסם. להמשיך?',
  onlyConfirmOff: 'להחזיר כניסה בסיסמה?',
} as const;

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/passkey-only').en>('en', 'i18n/passkey-only', 'en');

const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/passkey-only').ar>('ar', 'i18n/passkey-only', 'ar');

const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/passkey-only').ru>('ru', 'i18n/passkey-only', 'ru');

type PoLang = 'he' | 'en' | 'ar' | 'ru';

function poLang(): PoLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<PoLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const PO_DEV_MARKED: readonly PoLang[] = ['ar', 'ru'];

export function po(key: Key, lang: PoLang = poLang()): string {
  return TABLES[lang][key] ?? he[key];
}

export const PO_KEYS = Object.keys(he) as Key[];
export const PO_TABLES = TABLES;

registerCatalogue('i18n/passkey-only', { he, en, ar, ru }, PO_DEV_MARKED);
