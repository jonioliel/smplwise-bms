/**
 * ACCESSREQ-293: the words of the manual "request external access" form (owner-approved mockup
 * private/planning/mockup_access_request_2026-10-20). The product is "WisKey" in every text; operator texts never name the home
 * platform. Hebrew first; English, Arabic and Russian follow the document language. Every key exists in all four tables (a unit test
 * holds the parity); the Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked).
 * `{name}` placeholders are filled by `rt(key, { name })`.
 */
import { xtLang, type XtLang } from './access-external';
import { fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  newBtn: 'בקשת גישה',
  title: 'בקשת גישת חוץ',
  close: 'סגירה',
  cancel: 'ביטול',
  loading: 'טוען…',
  loadError: 'לא ניתן לטעון את הטופס',
  who: 'מי',
  fromDir: 'מספר אנשי הקשר',
  newPerson: 'אדם חדש',
  searchPerson: 'חיפוש לפי שם, חברה או טלפון',
  noMatch: 'לא נמצא',
  addNew: 'הוספת אדם חדש',
  dirUnavailable: 'אין לך גישה לספר אנשי הקשר. אפשר להוסיף אדם חדש.',
  change: 'החלפה',
  confirmed: 'אומת',
  notConfirmed: 'לא אומת',
  noNumber: 'אין מספר',
  sendCode: 'שליחת קוד אימות',
  codeSent: 'קוד אימות נשלח בוואטסאפ',
  liveAccess: 'גישה פעילה · ייחשב הרחבה',
  liveShort: 'גישה פעילה',
  dis_company: 'חברה',
  dis_user: 'משתמש Arx',
  dis_inactive: 'לא פעיל או ממתין לאישור',
  dis_employee: 'עובד ללא חשבון',
  fullName: 'שם מלא',
  company: 'חברה',
  whatsapp: 'וואטסאפ',
  msgLang: 'שפת ההודעות',
  onSave: 'קוד אימות יישלח בוואטסאפ עם השמירה',
  lang_he: 'עברית',
  lang_en: 'אנגלית',
  lang_ar: 'ערבית',
  lang_ru: 'רוסית',
  extIdentity: 'זהות מורחבת',
  locked: 'נעול',
  purpose: 'מטרה',
  optional: 'רשות',
  ticket: 'קריאה או הזמנת עבודה',
  none: 'ללא',
  purposeVisit: 'מטרת ההגעה',
  endsWithTicket: 'הגישה מסתיימת כשהקריאה נסגרת',
  doors: 'דלתות',
  searchDoor: 'חיפוש עמדה או דלת',
  doorN: 'דלת {n}',
  lockedStations: 'עמדות ללא הרשאה ({n})',
  noStations: 'אין עמדות שאפשר לבקש עבורן גישה.',
  offline: 'WisKey לא זמין · רשימת הדלתות נכונה ל־{t}',
  offlineNoCopy: 'WisKey לא זמין · אין רשימת דלתות',
  when: 'מתי',
  tz: 'אזור זמן: {tz}',
  from: 'מתאריך',
  until: 'עד תאריך (כולל)',
  daysOf: '{n} ימים · עד {max}',
  codeAt: 'קוד יישלח {t}',
  codeAtOnce: 'קוד יישלח מיד עם ההפעלה',
  weekdays: 'ימים בשבוע',
  specificDates: 'תאריכים מסוימים',
  pickRange: 'בחרו קודם טווח תאריכים',
  d0: 'א׳',
  d1: 'ב׳',
  d2: 'ג׳',
  d3: 'ד׳',
  d4: 'ה׳',
  d5: 'ו׳',
  d6: 'ש׳',
  winFrom: 'משעה',
  winUntil: 'עד שעה',
  remove: 'הסרה',
  addWin: 'חלון נוסף',
  cred: 'אמצעי כניסה',
  credPin: 'קוד אישי בוואטסאפ',
  credNone: 'ללא קוד',
  credCard: 'כרטיס',
  // EXTERNALBUILD-297: the code type
  codeType: 'סוג הקוד',
  codeWindow: 'לכל התקופה',
  codeOnce: 'לכניסה אחת',
  codeOnceNote: 'הקוד מבוטל אחרי הכניסה הראשונה. במאמץ מיטבי: בשניות שעד הביטול כניסה נוספת עדיין אפשרית.',
  notes: 'הערות',
  internal: 'פנימי',
  path: 'מסלול אישור',
  approveNow: 'אני מאשר עכשיו',
  approveNowSub: 'נשלח ל-WisKey מיד',
  sendApproval: 'שליחה לאישור',
  sendApprovalSub: 'המאשרים מקבלים התראה',
  apprCount: '{n} מאשרים לדלתות שנבחרו',
  apprNone: 'אין מאשר לכל הדלתות',
  apprFollow: 'המאשרים ייקבעו לפי הדלתות',
  autoApproval: 'אישור אוטומטי',
  autoNone: 'אין',
  blk_second: 'נדרש אדם נוסף לאישור',
  blk_offline: 'WisKey לא זמין',
  blk_doors: 'אין לך הרשאת אישור לכל הדלתות',
  blk_pin: 'אין לך הרשאה להפקת קוד',
  blk_numberNew: 'המספר עוד לא אומת',
  blk_number: 'המספר לא אומת',
  notice: 'הודעת פרטיות לטכנאי',
  noticeLang: '{lang} · {v}',
  preview: 'מה יישלח לטכנאי',
  previewBody: 'SmplWise Arx: קוד הכניסה האישי שלך הוא {pin}. דלתות: {doors}. בתוקף {dates}, {hours}. הקוד אישי - אל תעביר אותו לאיש. הכניסות נרשמות (שם, שעה ודלת) לצורכי אבטחה בלבד.',
  previewNote: 'הקוד נוצר רק במועד השליחה ונשלח ישירות לטכנאי. אף אחד ב־Arx לא רואה אותו.',
  err_person: 'יש לבחור אדם או להוסיף חדש.',
  err_npName: 'יש להזין שם מלא.',
  err_npPhone: 'מספר וואטסאפ לא תקין.',
  err_doorsNone: 'יש לבחור לפחות דלת אחת.',
  err_doorsMany: 'אפשר עד {max} דלתות. הסירו {n}.',
  err_datesPick: 'יש לבחור תאריכים.',
  err_datesOrder: 'תאריך הסיום לפני תאריך ההתחלה.',
  err_datesPast: 'החלון כבר הסתיים.',
  err_datesLong: 'עד {max} ימים.',
  err_days: 'יש לבחור לפחות יום אחד.',
  err_datesNone: 'יש לבחור לפחות תאריך אחד.',
  err_winsOrder: 'שעת הסיום לפני שעת ההתחלה.',
  err_winsOverlap: 'שני חלונות חופפים.',
  err_told: 'יש לאשר שהטכנאי קיבל את ההודעה.',
  err_pathNone: 'אין מאשר שמחזיק הרשאה בכל הדלתות שנבחרו.',
  err_purpose: 'עד 200 תווים, בשורה אחת.',
  fieldsToFix: '{n} שדות לתיקון',
  ok_send: 'שליחה לאישור',
  ok_self: 'אישור ושליחה ל-WisKey',
  done_send: 'הבקשה נשלחה למאשרים',
  done_self: 'אושר ונשלח ל-WisKey · עדיין לא פעיל',
  done_merged: 'הגישה הקיימת צומצמה',
  done_selfFailed: 'הבקשה נשמרה ונשלחה למאשרים. האישור לא בוצע: {why}',
  noperm_title: 'אין לך הרשאה לבקש גישת חוץ',
  noperm_text: 'נדרשת הרשאת ניהול קריאות עם ספקים חיצוניים, או הרשאת מתן גישת חוץ בעמדה אחת לפחות.',
  // SHAREDUI-295
  retry: 'נסה שוב',
  checkAgain: 'בדיקה שוב',
};

export type RtKey = keyof typeof he;

const en: Record<RtKey, string> = packTable<typeof import('./lang/en/i18n/access-request').en>('en', 'i18n/access-request', 'en');

const ar: Record<RtKey, string> = packTable<typeof import('./lang/ar/i18n/access-request').ar>('ar', 'i18n/access-request', 'ar');

const ru: Record<RtKey, string> = packTable<typeof import('./lang/ru/i18n/access-request').ru>('ru', 'i18n/access-request', 'ru');

const TABLES: Record<XtLang, Record<RtKey, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const RT_DEV_MARKED: readonly XtLang[] = ['ar', 'ru'];
export const RT_KEYS = Object.keys(he) as RtKey[];
export const RT_TABLES = TABLES;

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function rt(key: RtKey, vars?: Record<string, string | number>, lang: XtLang = xtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/access-request', { he, en, ar, ru }, RT_DEV_MARKED);
