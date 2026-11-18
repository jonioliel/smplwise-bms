/**
 * NOTIFWA: the strings of the WhatsApp section of Settings › התראות (`<notify-whatsapp-section>`). A Settings page may name WhatsApp; the home
 * platform is never named (UI_COPY_RULES). Hebrew first; English, Arabic and Russian columns are used by the document language (a missing key
 * falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native review. `{name}` placeholders are
 * filled by `nwt(key, { name })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  keyUnreadable: 'מפתח ההודעות של המערכת לא נקרא - אי אפשר לאמת הסכמות, ולכן לא נשלחות התראות בוואטסאפ',
  normalized: 'ערך שמור לא היה בטווח ותוקן - שמרו כדי לאשר',
  budget: 'חלק מתקציב החשבון',
  budgetHint: 'השאר נשמר להודעות ניהול השירות ולקודי אימות',
  budgetCritical: 'חלק לקריטי',
  budgetCriticalHint: 'קריטי והסלמה רשאים להשתמש עד כאן',
  detail: 'פירוט בהודעה',
  detailHint: 'תוכן ההתראה עצמו לא נשלח לוואטסאפ',
  detail_generic: 'כללי',
  detail_type_place: 'סוג ומקום',
  mine_title: 'וואטסאפ שלי',
  mine_sub: 'התראות לוואטסאפ האישי שלך, רק אם אישרת את המספר בעצמך',
  mine_number: 'המספר',
  mine_src_directory: 'מרשימת אנשי הקשר',
  mine_src_profile: 'מהפרופיל',
  mine_status: 'מצב',
  mine_on: 'מקבל התראות',
  mine_off: 'לא מקבל התראות',
  mine_changed: 'המספר השתנה - אשר מחדש כדי לקבל התראות',
  mine_declined: 'ברשימת אנשי הקשר וואטסאפ אינו הערוץ המועדף',
  mine_none: 'אין לך מספר וואטסאפ ברשימת אנשי הקשר',
  mine_confirm: 'אישור המספר וקבלת התראות',
  mine_stop: 'הפסקת התראות בוואטסאפ',
  on: 'פעיל',
  off: 'כבוי',
  attention: 'דורש טיפול',
  title: 'וואטסאפ',
  sub: 'התראות לטלפון האישי של המשתמש, מהחשבון שנבחר בערוץ ההודעות',
  enabled: 'שליחת התראות בוואטסאפ',
  enabledHint: 'כבוי = שום התראה לא נשלחת בוואטסאפ, גם אם סומנה במדיניות',
  account: 'חשבון שולח',
  accountNone: 'לא נבחר חשבון',
  accountPick: 'בחירת חשבון',
  st_connected: 'מחובר',
  st_disconnected: 'מנותק',
  st_unknown: 'לא ידוע',
  st_missing: 'לא נמצא',
  reach: 'משתמשים עם מספר',
  reachHint: 'מספר מרשימת אנשי הקשר, כשוואטסאפ הוא הערוץ המועדף',
  cap: 'לכל משתמש בשעה',
  capHint: 'התראה קריטית והסלמה אינן נספרות',
  dedupe: 'בלי כפילות במשך',
  minutes: 'דק׳',
  test: 'שליחת בדיקה',
  testing: 'שולח…',
  testHint: 'נשלחת רק למספר שלך ({masked})',
  testNoNumber: 'אין לך מספר וואטסאפ ברשימת אנשי הקשר',
  testOk: 'הודעת הבדיקה נשלחה',
  testFail: 'הבדיקה נכשלה',
  warnOffAccount: 'אין חשבון שולח - ההתראות לא יישלחו',
  saved: 'נשמר',
  loading: 'טוען…',
  error: 'לא ניתן לטעון את הגדרות הוואטסאפ',
  retry: 'נסה שוב',
  less: 'פחות',
  more: 'יותר',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/notify-whatsapp').en>('en', 'i18n/notify-whatsapp', 'en');

// initial translation - needs a native review
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/notify-whatsapp').ar>('ar', 'i18n/notify-whatsapp', 'ar');

// initial translation - needs a native review
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/notify-whatsapp').ru>('ru', 'i18n/notify-whatsapp', 'ru');

type NwtLang = 'he' | 'en' | 'ar' | 'ru';

export function nwtLang(): NwtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<NwtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };

export function nwt(key: Key, vars?: Record<string, string | number>, lang: NwtLang = nwtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const NWT_KEYS = Object.keys(he) as Key[];
export const NWT_TABLES = TABLES;

registerCatalogue('i18n/notify-whatsapp', { he, en, ar, ru });
