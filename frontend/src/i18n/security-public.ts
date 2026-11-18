/**
 * SECFIX2-295 (owner decisions 2026-10-21): the words of the "public interface" security settings page (#/system/security/public) and of
 * the undecided-technicians panel of the external-access screen. Hebrew first; English, Arabic and Russian follow the document language
 * (a missing key falls back to the Hebrew; a unit test holds the parity). The Arabic and Russian columns are an INITIAL translation and
 * need a native review (dev-marked). The home platform is never named.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  // the settings page
  tab: 'ממשק ציבורי',
  title: 'ממשק ציבורי',
  secPending: 'טכנאים שספקים הזינו',
  retention: 'מחיקה אוטומטית אחרי (ימים)',
  cap: 'מקסימום ממתינים לספק',
  zeroOff: '0 = כבוי',
  secPortal: 'פורטל ספקים',
  startWorker: 'עיבוד בקשות כניסה בתור נפרד',
  secAccess: 'בקרת כניסה',
  uniform404: 'תשובה אחידה לרשומת אדם פגומה',
  save: 'שמירה',
  saved: 'נשמר',
  saveFailed: 'השמירה נכשלה',
  invalidRetention: 'ערך בין 7 ל־365, או 0',
  invalidCap: 'ערך בין 0 ל־100',
  loadFailed: 'הטעינה נכשלה',
  retry: 'נסו שוב',
  // the pending panel
  pendTitle: 'טכנאים ממתינים לאישור',
  pendTicket: 'קריאה {n}',
  pendDays: 'ממתין {n} ימים',
  pendToday: 'ממתין מהיום',
  pendLeft: 'יימחק בעוד {n} ימים',
  pendLeftToday: 'יימחק היום',
  pendNoAuto: 'ללא מחיקה אוטומטית',
  approve: 'אישור',
  reject: 'דחייה ומחיקה',
  approveQ: 'לאשר את {name}?',
  approveText: 'הטכנאי יאושר. קוד כניסה יישלח רק אחרי אימות המספר שלו ואישור גישה.',
  rejectQ: 'לדחות ולמחוק את {name}?',
  rejectText: 'השם ומספר הטלפון יימחקו והבקשה שלו תסתיים.',
  approveDone: 'הטכנאי אושר',
  rejectDone: 'הטכנאי נדחה ונמחק',
  failed: 'הפעולה נכשלה',
  cancel: 'ביטול',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/security-public').en>('en', 'i18n/security-public', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/security-public').ar>('ar', 'i18n/security-public', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/security-public').ru>('ru', 'i18n/security-public', 'ru');

export type SpKey = Key;
export type SpLang = 'he' | 'en' | 'ar' | 'ru';

export function spLang(): SpLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<SpLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const SP_DEV_MARKED: readonly SpLang[] = ['ar', 'ru'];

export function spt(key: Key, vars?: Record<string, string | number>, lang: SpLang = spLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const SP_KEYS = Object.keys(he) as Key[];
export const SP_TABLES = TABLES;

registerCatalogue('i18n/security-public', { he, en, ar, ru }, SP_DEV_MARKED);
