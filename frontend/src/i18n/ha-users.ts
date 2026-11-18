/**
 * USR1: the strings of Settings › משתמשים והרשאות › משתמשי מערכת הבית (docs/design/USR1_HA_USERS_FROM_ARX.md). A settings screen,
 * yet the neutral wording "מערכת הבית" is used throughout (owner rule: no platform product name on screens). USR1-263: the optional
 * administrator token is saved in הגדרות › חיבורים › סודות (the secrets store), never in the add-on options. Hebrew first; English is used
 * when the document language is English (a missing key falls back to Hebrew). `{name}` placeholders are filled by `ht(key, vars)`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  tab: 'משתמשי מערכת הבית',
  title: 'משתמשי מערכת הבית',
  sub: 'יצירת משתמש רגיל במערכת הבית עם תפקיד ב־Arx. מכאן אפשר להשבית או למחוק רק משתמשים שנוצרו כאן.',
  keywords: 'משתמש חדש יצירה מחיקה השבתה סיסמה מערכת הבית',
  loading: 'טוען…',
  forbidden: 'ניהול משתמשי מערכת הבית שמור למנהלי המערכת.',
  retry: 'נסו שוב',

  accessTitle: 'הרשאה במערכת הבית',
  check: 'בדיקת הרשאה',
  checking: 'בודק…',
  checkedAt: 'נבדק {time}',
  acc_ok: 'למערכת יש הרשאה לנהל משתמשים במערכת הבית.',
  acc_unknown: 'עוד לא נבדק. לחצו "בדיקת הרשאה" לפני יצירת המשתמש הראשון.',
  acc_not_authorised: 'למערכת אין הרשאת מנהל במערכת הבית, ולכן אי אפשר ליצור או למחוק משתמשים מכאן.',
  acc_not_authorised_fix: 'מה עושים: במערכת הבית, בפרופיל של חשבון מנהל, יוצרים אסימון גישה לטווח ארוך (Long-Lived Access Token), ושומרים אותו בהגדרות ‹ חיבורים ‹ סודות בשורה "אסימון מנהל לניהול משתמשי מערכת הבית". אין צורך בהפעלה מחדש; אחר כך לוחצים שוב "בדיקת הרשאה". אפשר גם להמשיך לנהל משתמשים במסך המשתמשים של מערכת הבית.',
  acc_unavailable: 'מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.',
  acc_not_configured: 'החיבור למערכת הבית אינו מוגדר בהתקנה הזו.',
  acc_failed: 'הבדיקה נכשלה. נסו שוב.',
  via_supervisor: 'בזהות התוסף',
  via_token: 'באסימון המנהל שהוגדר',
  notHaAdmin: 'רק מנהל של מערכת הבית יכול ליצור, להשבית או למחוק משתמשים. אפשר לצפות ברשימה.',

  listTitle: 'משתמשים שנוצרו דרך Arx',
  empty: 'עוד לא נוצרו משתמשים מכאן.',
  emptyHint: 'משתמשים קיימים של מערכת הבית מופיעים בלשונית "משתמשים", ושם משייכים להם תפקידים.',
  add: 'משתמש חדש',
  count: '{n} מתוך {max}',
  colName: 'שם',
  colUser: 'שם משתמש',
  colRole: 'תפקיד ב־Arx',
  colState: 'מצב',
  st_active: 'פעיל',
  st_inactive: 'מושבת',
  st_needs_repair: 'דורש תיקון',
  repair_person_missing: 'נוצר בלי כרטיס אדם',
  repair_compensation_failed: 'היצירה נכשלה באמצע; יש למחוק',
  repair_binding_failed: 'שיוך התפקיד נכשל; יש למחוק',
  repair_cleanup_failed: 'הניקוי לא הושלם; יש למחוק שוב',
  repair_missing_in_ha: 'לא נמצא במערכת הבית; יש למחוק',
  you: 'אתם',
  deactivate: 'השבתה',
  activate: 'הפעלה',
  remove: 'מחיקה',

  createTitle: 'משתמש חדש במערכת הבית',
  createSub: 'המשתמש נוצר כמשתמש רגיל (לא מנהל) ומקבל את התפקיד שנבחר ב־Arx בלבד.',
  fName: 'שם מוצג',
  fUsername: 'שם משתמש לכניסה',
  fUsernameHint: 'אותיות לטיניות קטנות, ספרות, נקודה, מקף או קו תחתון; 3 עד 32 תווים.',
  fPassword: 'סיסמה',
  fPassword2: 'סיסמה שוב',
  fPasswordHint: 'לפחות {min} תווים, לא סיסמה נפוצה ולא רצף. הסיסמה לא נשמרת ב־Arx ולא תוצג שוב.',
  fRole: 'תפקיד ב־Arx',
  fScope: 'היקף',
  fPerson: 'ליצור גם כרטיס אדם במערכת הבית',
  create: 'יצירה',
  cancel: 'ביטול',
  created: 'המשתמש {name} נוצר.',
  createdNoPerson: 'המשתמש {name} נוצר, אך כרטיס האדם לא נוצר.',

  e_name: 'נדרש שם מוצג.',
  e_username: 'שם המשתמש אינו בפורמט הנדרש.',
  e_mismatch: 'הסיסמאות אינן זהות.',
  e_role: 'יש לבחור תפקיד.',
  pw_too_short: 'הסיסמה קצרה מדי.',
  pw_too_long: 'הסיסמה ארוכה מדי.',
  pw_repetitive: 'הסיסמה חוזרת על אותם תווים.',
  pw_common: 'הסיסמה נפוצה מדי.',
  pw_sequence: 'הסיסמה היא רצף מקלדת או ספרות.',
  pw_contains_username: 'הסיסמה מכילה את שם המשתמש.',
  pw_contains_name: 'הסיסמה מכילה את השם המוצג.',

  deactivateTitle: 'השבתת {name}',
  deactivateBody: 'המשתמש לא יוכל להיכנס למערכת הבית ול־Arx עד שיופעל שוב. אפשר להפעיל אותו מחדש בכל עת.',
  activateTitle: 'הפעלת {name}',
  activateBody: 'המשתמש יוכל להיכנס שוב, עם התפקיד שלו ב־Arx.',
  confirm: 'אישור',
  deactivated: 'המשתמש הושבת.',
  activated: 'המשתמש הופעל.',

  removeTitle: 'מחיקת {name}',
  removeBody: 'המשתמש יימחק ממערכת הבית, כל התפקידים שלו ב־Arx יבוטלו והכניסות הפתוחות שלו ייסגרו. אי אפשר לבטל את המחיקה. השבתה היא האפשרות הבטוחה יותר.',
  removeType: 'להקליד את שם המשתמש {username} כדי לאשר',
  removeConfirm: 'מחיקה לצמיתות',
  removed: 'המשתמש נמחק.',
} as const;

const en: Partial<Record<keyof typeof he, string>> = packTable<typeof import('./lang/en/i18n/ha-users').en>('en', 'i18n/ha-users', 'en');

export type HaUsersTextKey = keyof typeof he;

function lang(): 'he' | 'en' {
  return docLang(['en']);
}

export function ht(key: HaUsersTextKey, vars?: Record<string, string | number>): string {
  const raw = (lang() === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return fill(raw, vars);
}

export const HA_USERS_TEXT_KEYS = Object.keys(he) as HaUsersTextKey[];

registerCatalogue('i18n/ha-users', { he, en });
