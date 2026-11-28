/**
 * WAPACE-295: the words of the WhatsApp policy card (recipient allow-list and self-messages test window) in Settings > messaging channel.
 * Hebrew first; English, Arabic and Russian follow the document language. Every key exists in all four tables (unit-messaging-policy.spec.ts
 * holds the parity); the Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked).
 * `{name}` placeholders are filled by `mw(key, { name })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
type Lang = 'he' | 'en' | 'ar' | 'ru';

const he = {
  title: 'מדיניות שליחה בוואטסאפ',
  allowTitle: 'רשימת מותרים: מטפלים וספקים',
  enforce: 'לשלוח רק לרשימה',
  enforceOff: 'כבוי: כל נמען יקבל הודעה',
  blocksAll: 'האכיפה פעילה והרשימה ריקה: שום הודעה לא תישלח',
  // FIX-FE2-2570 (review FE2-08): the confirmations before a change that stops delivery
  confirmBlockAllTitle: 'לעצור את כל ההודעות?',
  confirmBlockAll: 'האכיפה תופעל והרשימה תהיה ריקה: שום הודעת וואטסאפ לא תישלח עד שיתווסף נמען.',
  confirmRemoveTitle: 'להסיר את {name}?',
  confirmRemove: 'האכיפה פעילה: {name} לא יקבל יותר הודעות. כדי להחזיר צריך את המספר המלא.',
  confirmYes: 'כן, להמשיך',
  phone: 'מספר (עם קידומת מדינה)',
  label: 'שם',
  role: 'תפקיד',
  role_handler: 'מטפל',
  role_provider: 'ספק',
  role_other: 'אחר',
  add: 'הוספה',
  remove: 'הסרה',
  empty: 'הרשימה ריקה',
  page: 'עמוד {n} מתוך {m}',
  prev: 'הקודם',
  next: 'הבא',
  selfTitle: 'הודעות לעצמי לבדיקה',
  selfMinutes: 'דקות',
  selfStart: 'הפעלה',
  selfStop: 'כיבוי',
  selfActive: 'פעיל עד {time}',
  selfOff: 'כבוי',
  saved: 'נשמר',
  loadError: 'טעינת המדיניות נכשלה',
  retry: 'נסו שוב',
  err_phone: 'מספר לא תקין',
  err_label: 'יש להזין שם',
  err_minutes: 'ערך בין {lo} ל-{hi}',
  err_listed: 'המספר כבר ברשימה',
  readOnly: 'צפייה בלבד',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/messaging-policy').en>('en', 'i18n/messaging-policy', 'en');

const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/messaging-policy').ar>('ar', 'i18n/messaging-policy', 'ar');

const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/messaging-policy').ru>('ru', 'i18n/messaging-policy', 'ru');

export type MwKey = Key;
export const MW_TABLES: Record<Lang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
const MW_DEV_MARKED: readonly Lang[] = ['ar', 'ru'];
export const MW_KEYS = Object.keys(he) as Key[];

function mwLang(): Lang {
  return docLang(['en', 'ar', 'ru']);
}

export function mw(key: Key, vars?: Record<string, string | number>, lang: Lang = mwLang()): string {
  const raw = MW_TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/messaging-policy', { he, en, ar, ru }, MW_DEV_MARKED);
