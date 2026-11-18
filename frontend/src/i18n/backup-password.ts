/**
 * BACKUP-HASH-ENC: the words of the backup password in Settings › אבחון › גיבוי ושחזור (create and restore). The local accounts'
 * passwords travel in a backup only encrypted with this password; without it they are left out. Hebrew first; English, Arabic and
 * Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an
 * INITIAL translation and need a native review (dev-marked). `{n}` placeholders are filled by `bpt(key, { n })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  createLabel: 'סיסמת גיבוי',
  createHint: 'מצפינה את סיסמאות החשבונות המקומיים בתוך הגיבוי. בלי סיסמה הן לא נכללות בגיבוי. שמרו אותה במקום בטוח: בלעדיה אי אפשר לשחזר אותן.',
  createPlaceholder: 'לפחות {n} תווים (אופציונלי)',
  minLabel: 'אורך מינימלי לסיסמת גיבוי',
  minHint: 'בין 8 ל־64 תווים. חל על גיבויים חדשים; גיבוי קיים נפתח בסיסמה שלו',
  minSaved: 'האורך המינימלי נשמר',
  minRange: 'ערך בין 8 ל־64',
  createdEncrypted: 'סיסמאות החשבונות המקומיים מוצפנות בגיבוי',
  createdOmitted: 'הגיבוי נוצר בלי סיסמאות החשבונות המקומיים',
  badgeEncrypted: 'מוצפן',
  badgeOmitted: 'בלי סיסמאות',
  badgeLegacy: 'גיבוי ישן',
  restoreLabel: 'סיסמת הגיבוי',
  restoreHint: 'הגיבוי מכיל {n} סיסמאות מוצפנות של חשבונות מקומיים',
  restoreSkip: 'שחזור בלי סיסמאות החשבונות המקומיים',
  restoreSkipHint: 'חשבון מקומי שאין לו סיסמה בהתקנה הזו יצטרך קישור איפוס ממנהל',
  restoreOmitted: 'הגיבוי נוצר בלי סיסמת גיבוי: סיסמאות החשבונות המקומיים לא נכללו בו',
  restoreLegacy: 'גיבוי מגרסה ישנה: סיסמאות החשבונות המקומיים שמורות בו בלי הצפנה. שמרו את הקובץ במקום מוגן או מחקו אותו אחרי השחזור.',
  resultNeedReset: '{n} חשבונות מקומיים צריכים קישור איפוס סיסמה',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/backup-password').en>('en', 'i18n/backup-password', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/backup-password').ar>('ar', 'i18n/backup-password', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/backup-password').ru>('ru', 'i18n/backup-password', 'ru');

type BptLang = 'he' | 'en' | 'ar' | 'ru';

function bptLang(): BptLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<BptLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const BPT_DEV_MARKED: readonly BptLang[] = ['ar', 'ru'];

export function bpt(key: Key, vars?: Record<string, string | number>, lang: BptLang = bptLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const BPT_KEYS = Object.keys(he) as Key[];
export const BPT_TABLES = TABLES;

registerCatalogue('i18n/backup-password', { he, en, ar, ru }, BPT_DEV_MARKED);
