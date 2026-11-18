/**
 * CAMERA-STREAM-SOURCES-2410: the words of "מקור וידאו" (a camera's video source) and of "מצלמה ללא מקליט". Hebrew first; the English
 * column follows the document language (a missing key falls back to the Hebrew; a unit test holds the parity). No permission name,
 * error code, address or device path on the face.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  section: 'מקור וידאו',
  fromNvr: 'מהמקליט',
  manual: 'כתובת ידנית',
  fromNvrLead: 'הווידאו והתמונות מגיעים מהמקליט, כמו היום.',
  manualLead: 'הווידאו והתמונות מגיעים ישירות מהמצלמה, מהכתובות שלמטה.',
  current: 'המקור כעת: {mode}',
  change: 'שנה מקור…',
  dialogTitle: 'מקור וידאו',
  dialogSub: '{name}',
  mainUrl: 'כתובת RTSP — זרם ראשי',
  subUrl: 'כתובת RTSP — זרם משני',
  urlHint: 'אם ממלאים רק כתובת אחת, היא משמשת לשני הזרמים.',
  passwordKept: 'הסיסמה שמורה ומוצגת כ־***. כדי להחליף אותה, הקלידו כתובת מלאה.',
  test: 'בדיקת זרם',
  testing: 'בודק…',
  testOk: 'הזרם תקין · {res}{codec}',
  testEncourage: 'מומלץ לבדוק את הזרם לפני השמירה.',
  save: 'שמור',
  saving: 'שומר…',
  cancel: 'ביטול',
  saved: 'מקור הווידאו נשמר.',
  urlBad: 'הכתובת צריכה להתחיל ב־rtsp:// או ב־rtsps://',
  urlRequired: 'יש להזין לפחות כתובת אחת.',
  healthOk: 'המקור עובד',
  healthFailing: 'המקור הידני אינו עובד כרגע. המצלמה נשארת על המקור הזה; בדקו את הכתובת או את המצלמה.',
  healthUnknown: 'המקור עדיין לא נבדק',
  standaloneNote: 'מצלמה ללא מקליט: וידאו חי ותמונות בלבד.',
  noRecording: 'למצלמה ללא מקליט אין הקלטות, אירועי מקליט או הפעלה מחדש דרך מקליט.',
  noRecorder: 'ללא מקליט',
  addTitle: 'הוספת מצלמה ללא מקליט',
  addButton: 'הוסף מצלמה ללא מקליט',
  addLead: 'מצלמה שאינה מחוברת למקליט: וידאו חי ותמונות ישירות ממנה. אין הקלטות.',
  name: 'שם המצלמה',
  area: 'אזור',
  noArea: 'ללא אזור',
  add: 'הוסף',
  added: 'המצלמה נוספה.',
  listTitle: 'מצלמות ללא מקליט',
  listEmpty: 'אין מצלמות ללא מקליט.',
  remove: 'הסר',
  removeConfirm: 'להסיר את "{name}"? המצלמה תוסר מכל המסכים. לא נשמרות ממנה הקלטות.',
  removed: 'המצלמה הוסרה.',
  edit: 'מקור',
  view: 'צפייה',
  offline: 'המקור הידני של המצלמה אינו עונה.',
  errStale: 'ההגדרות השתנו בינתיים. סגרו ופתחו שוב.',
  errPasswordReenter: 'הכתובת השתנתה: יש להקליד שוב את הסיסמה.',
  errNotAllowed: 'הכתובת הזו אינה מותרת כמקור וידאו.',
  errNotSupported: 'הכתובת אינה כתובת RTSP נתמכת (rtsp:// או rtsps://).',
  errMedia: 'שירות הווידאו לא הוגדר, ולכן אי אפשר לבדוק את הזרם.',
  errRate: 'יותר מדי בדיקות ברצף. נסו שוב בעוד דקה.',
  errForbidden: 'אין לך הרשאה לשנות מקורות וידאו.',
  errLimit: 'הגעתם למספר המרבי של מצלמות ללא מקליט.',
  errName: 'יש להזין שם למצלמה.',
  errGeneric: 'הפעולה נכשלה. נסו שוב.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/camera-sources').en>('en', 'i18n/camera-sources', 'en');

export type CsKey = Key;
export type CsLang = 'he' | 'en';

export function csLang(): CsLang {
  return docLang(['en']);
}

const TABLES: Record<CsLang, Record<Key, string>> = { he, en };

export function cst(key: Key, vars?: Record<string, string | number>, lang: CsLang = csLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const CS_KEYS = Object.keys(he) as Key[];
export const CS_TABLES = TABLES;

registerCatalogue('i18n/camera-sources', { he, en });
