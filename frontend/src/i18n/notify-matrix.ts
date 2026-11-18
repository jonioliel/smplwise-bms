/**
 * TKNOTIFMATRIX: the strings of the notification-matrix rows (Settings > the requests module > general, `<ticket-notify-matrix>`) and
 * of the digest's ticket list in the notification detail. Hebrew first; English, Arabic and Russian columns follow the document
 * language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an INITIAL translation and need a native
 * review. `{name}` placeholders are filled by `nmt(key, { name })`. The source labels mirror services/tickets/notify_sources.py.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  card: 'התראות לפי מחלקה ותקציר',
  matrixOn: 'התאמת התראות לפי מחלקה',
  matrixOnSub: 'כשכבוי כל האירועים מתריעים כרגיל',
  digestOn: 'תקציר יומי',
  digestOnSub: 'אירועים שסומנו "בתקציר" נאספים ונשלחים פעם ביום, הודעה אחת לכל מקבל בכל מחלקה',
  urgent: 'דחוף תמיד מיידי',
  urgentSub: 'עדיפות גבוהה או דחופה וחריגה מזמני הטיפול נשלחות מיד, גם אם סומנו בתקציר או כבוי',
  siteTime: 'שעת התקציר',
  siteTimeSub: 'ברירת המחדל לכל המחלקות',
  pending: '{n} אירועים ממתינים',
  save: 'שמירה',
  dept: 'מחלקה',
  allDepts: 'כל המחלקות',
  modeNow: 'מיידי',
  modeDigest: 'בתקציר',
  modeOff: 'כבוי',
  inherited: 'לפי כל המחלקות',
  events: 'אירועים',
  assigneeTag: 'למטפל',
  slaTag: 'חריגה',
  deptTime: 'שעת התקציר של המחלקה',
  deptTimeSub: 'ריק = {time} (ברירת המחדל)',
  clear: 'ניקוי',
  recipients: 'מקבלי התקציר',
  recipientsSub: 'כל מקבל רואה רק את מה שמותר לו לראות',
  recManagers: 'מנהלי המחלקה',
  recUsers: 'משתמשים נוספים',
  recRoles: 'תפקידים',
  addUser: 'הוספת משתמש',
  addRole: 'הוספת תפקיד',
  remove: 'הסרה של {name}',
  backToStar: 'חזרה להגדרת כל המחלקות',
  channels: 'ערוצים',
  channelsSub: 'ברירת המחדל: לפי מדיניות ההתראות של כל אירוע',
  chInapp: 'באפליקציה',
  chInappAlways: 'תמיד',
  ch_push: 'פוש',
  ch_email: 'דוא"ל',
  ch_whatsapp: 'וואטסאפ',
  chInherit: 'לפי המדיניות',
  chOn: 'פעיל',
  chOff: 'כבוי',
  sla: 'דחוף לפי מדיניות זמני טיפול',
  slaSub: 'לכל עדיפות במחלקה: האם אירוע דחוף עוקף את ההגדרות',
  slaInherit: 'ברירת מחדל',
  slaImmediate: 'תמיד מיידי',
  slaMatrix: 'לפי ההגדרות',
  loadError: 'לא ניתן לטעון את הגדרות ההתראות',
  digestList: 'הצגת הרשימה ({n})',
  digestHidden: 'ועוד {n} שאינם גלויים לך',
  digestNone: 'אין מה להציג',
  src_ticket_new_unassigned: 'חדש וממתין למטפל',
  src_ticket_assigned: 'הועבר לטיפולך',
  src_ticket_status_update: 'סטטוס עודכן',
  src_ticket_comment_added: 'נוספה הערה',
  src_ticket_reminder: 'תזכורת למטפל',
  src_ticket_stuck: 'חריגה מזמני הטיפול',
  src_ticket_returned: 'הוחזר למנהל',
  src_ticket_done: 'טיפול הסתיים - ממתין לסגירה',
  src_ticket_reply_unmatched: 'תשובה שלא שויכה',
  src_ticket_send_failed: 'הודעה למטפל לא נשלחה',
  src_ticket_contact_changed: 'פרטי איש קשר השתנו',
  src_ticket_cost_submitted: 'הוגשה דרישת תשלום',
  src_ticket_cost_missing: 'לא הוגשה דרישת תשלום',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/notify-matrix').en>('en', 'i18n/notify-matrix', 'en');

const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/notify-matrix').ar>('ar', 'i18n/notify-matrix', 'ar');

const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/notify-matrix').ru>('ru', 'i18n/notify-matrix', 'ru');

export type NmtKey = Key;
export type NmtLang = 'he' | 'en' | 'ar' | 'ru';

export function nmtLang(): NmtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<NmtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };

export function nmt(key: Key, vars?: Record<string, string | number>, lang: NmtLang = nmtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A ticket source's label in the reader's language (the server's Hebrew label is the fallback for a source added later). */
export function sourceLabel(key: string, fallback: string, lang: NmtLang = nmtLang()): string {
  const k = `src_${key.replace(/\./g, '_')}` as Key;
  return k in he ? (TABLES[lang][k] ?? he[k]) : fallback;
}

export const NMT_KEYS = Object.keys(he) as Key[];
export const NMT_TABLES = TABLES;

registerCatalogue('i18n/notify-matrix', { he, en, ar, ru });
