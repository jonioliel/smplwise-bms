/**
 * SWITCHUI-295: the words of Settings > Security > "קריאות בקרת כניסה" (#/system/security/wiskey) - the four switches that let Arx ask
 * the access-control system for a read. Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back
 * to the Hebrew; a unit test holds the parity). The Arabic and Russian columns are an INITIAL translation and need a native review
 * (dev-marked). No internal key name and no home-platform name on the face; the key is shown only in the small details line.
 * WISKEY-RC7-ADOPT-2331 S1: the `install*` words - the owner's automatic-installation switch, a separate group on the same screen.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  tab: 'קריאות בקרת כניסה',
  title: 'קריאות בקרת כניסה',
  lead: 'מתגים שמאפשרים למערכת לבקש מידע ממערכת בקרת הכניסה. כל מתג כבוי כברירת מחדל.',
  on: 'פועל',
  off: 'כבוי',
  detailsKey: 'שם פנימי',
  accessTitle: 'מצב הגישה של אדם',
  accessText: 'בדיקה מול בקרת הכניסה אם הרשאה שבוטלה אכן הוסרה.',
  scheduleTitle: 'השוואת לוח זמנים',
  scheduleText: 'בדיקה אם לוח הזמנים אצל בקרת הכניסה זהה למה שאושר.',
  presenceTitle: 'נוכחות',
  presenceText: 'מידע לבירור בלבד; אינו משמש להוכחת הסרה.',
  plansTitle: 'תוכניות יכולות',
  plansText: 'קריאה של תוכניות בלבד; שום תוכנית אינה מבוצעת.',
  permitMissing: 'אי אפשר להפעיל עדיין: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו.',
  permitRefused: 'ההפעלה נדחתה: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו. המתג נשאר כבוי.',
  forbidden: 'רק מנהל מערכת יכול לשנות הגדרה זו.',
  invalid: 'הבקשה אינה תקינה.',
  failed: 'השמירה נכשלה',
  loadFailed: 'הטעינה נכשלה',
  retry: 'נסו שוב',
  turnOn: 'הפעלה',
  turnOff: 'כיבוי',
  cancel: 'ביטול',
  confirmOnQ: 'להפעיל את "{name}"?',
  confirmOnText: 'המערכת תתחיל לבקש מידע זה ממערכת בקרת הכניסה. אפשר לכבות שוב בכל רגע.',
  confirmOffQ: 'לכבות את "{name}"?',
  confirmOffText: 'המערכת תפסיק לבקש מידע זה. מה שאי אפשר לוודא ייחשב כלא ידוע.',
  doneOn: 'המתג הופעל',
  doneOff: 'המתג כובה',
  installGroup: 'התקנה אוטומטית',
  installTitle: 'התקנה אוטומטית של רכיב בקרת הכניסה',
  installText: 'כשמופעל, המערכת מתקינה ומעדכנת את רכיב בקרת הכניסה בעצמה, רק אחרי שכל הבדיקות עוברות. התקנה ידנית או זרה לעולם אינה נדרסת.',
  installPermitMissing: 'אי אפשר להפעיל עדיין: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה.',
  installPermitRefused: 'ההפעלה נדחתה: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה. המתג נשאר כבוי.',
  installConfirmOnText: 'המערכת תתקין ותעדכן את רכיב בקרת הכניסה בעצמה, רק כשכל הבדיקות עוברות. התקנה ידנית או זרה לא תידרס. אפשר לכבות בכל רגע.',
  installConfirmOffText: 'המערכת תפסיק להתקין ולעדכן את רכיב בקרת הכניסה. מה שכבר מותקן נשאר כפי שהוא.',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wiskey-switches').en>('en', 'i18n/wiskey-switches', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/wiskey-switches').ar>('ar', 'i18n/wiskey-switches', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/wiskey-switches').ru>('ru', 'i18n/wiskey-switches', 'ru');

export type WsKey = Key;
type WsLang = 'he' | 'en' | 'ar' | 'ru';

function wsLang(): WsLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<WsLang, Record<Key, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
const WS_DEV_MARKED: readonly WsLang[] = ['ar', 'ru'];

export function wst(key: Key, vars?: Record<string, string | number>, lang: WsLang = wsLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const WS_KEYS = Object.keys(he) as Key[];
export const WS_TABLES = TABLES;

registerCatalogue('i18n/wiskey-switches', { he, en, ar, ru }, WS_DEV_MARKED);
