/**
 * ONVIF-UI-2500: the words of "חיפוש מצלמות ברשת" (camera discovery - scan, identify, choose and add). Hebrew first; the English
 * column follows the document language (a missing key falls back to the Hebrew; a unit test holds the parity and the placeholders).
 * This is a settings screen, so the technical name ONVIF may appear (design section 0); no permission name, error code, user name,
 * password or address with credentials is ever on the face.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  // the entry on the "cameras without a recorder" card
  findButton: 'חיפוש מצלמות ברשת',
  findOff: 'חיפוש מצלמות ברשת כבוי בהגדרות. הוספה ידנית עדיין זמינה.',
  // the wizard
  title: 'חיפוש מצלמות ברשת',
  sub: 'רק קריאה: שום דבר לא נשמר ולא נשלח למצלמה עד שלוחצים "הוספה".',
  stepScan: 'חיפוש',
  stepIdentify: 'זיהוי',
  stepAdd: 'בחירה והוספה',
  close: 'סגירה',
  back: 'חזרה',
  // step 1 - scan
  rangeLabel: 'טווח כתובות',
  rangeHelp: 'הוצע לפי הרשת של השרת. אפשר לחפש רק ברשת של האתר עצמו.',
  rangeCap: 'עד {max} כתובות בכל חיפוש, כדי שהחיפוש יהיה קצר ולא יעמיס על הרשת.',
  rangeCount: 'בטווח הזה {n} כתובות.',
  rangeTooLarge: 'הטווח כולל {n} כתובות - יותר מ־{max}. צמצמו אותו.',
  rangeBad: 'כתבו טווח בצורה כתובת/אורך, למשל {example}.',
  start: 'התחלת חיפוש',
  doesTitle: 'מה החיפוש עושה ומה לא',
  doesRead: 'קורא שם יצרן, דגם וכתובות וידאו',
  doesChange: 'משנה הגדרות במצלמה או במקליט',
  doesGuess: 'מנחש סיסמאות',
  doesGuessNote: 'רק הסיסמה שתקלידו, ניסיון אחד לכל מצלמה, כדי לא לנעול אותה',
  doesStore: 'שומר סיסמה',
  doesStoreNote: 'רק אחרי "הוספה", מוצפנת כמו סיסמת המקליט',
  yes: 'כן',
  never: 'לעולם לא',
  onlyOnAdd: 'רק בהוספה',
  searching: 'מחפש ב־{range}',
  stop: 'עצירה',
  stopping: 'עוצר…',
  progressLabel: 'התקדמות החיפוש',
  checked: 'נבדקו {checked} מתוך {total}',
  foundCount: 'נמצאו {n}',
  foundSoFar: 'נמצאו עד עכשיו',
  moreFound: 'ועוד {n}',
  noneYet: 'עוד לא נמצא דבר.',
  stopped: 'החיפוש נעצר. אפשר להתחיל חיפוש חדש.',
  resumed: 'חיפוש שהתחלתם קודם עדיין פועל - מוצגות התוצאות שלו.',
  noneTitle: 'לא נמצאו מצלמות ב־{range}',
  noneOther: 'המצלמות ברשת אחרת - נסו טווח אחר.',
  nonePoe: 'המצלמות מחוברות ליציאות PoE של המקליט, ברשת פנימית שהשרת לא רואה. הן כבר מגיעות דרך המקליט.',
  noneOnvif: 'ONVIF כבוי במצלמות - מפעילים אותו בהגדרות הרשת של המצלמה.',
  otherRange: 'חיפוש בטווח אחר',
  addManual: 'הוספה ידנית',
  failed: 'החיפוש נכשל. נסו שוב.',
  // step 2 - identify
  foundLine: 'נמצאו {n} התקנים ב־{range}',
  credTitle: 'משתמש וסיסמה של המצלמות',
  credLead: 'ניסיון אחד לכל מצלמה מסומנת. אם הסיסמה שגויה במצלמה מסוימת, לא ננסה שוב אוטומטית.',
  user: 'משתמש',
  password: 'סיסמה',
  sameForAll: 'אותו משתמש וסיסמה לכל המסומנות',
  sameForAllNote: 'הסיסמה נשלחת לכל מצלמה מסומנת כתמצית, לא כטקסט גלוי. מומלץ משתמש צפייה בלבד.',
  identify: 'זיהוי {n} מסומנות',
  identifyOne: 'זיהוי המצלמה המסומנת',
  identifying: 'מזהה…',
  needSame: 'כדי לזהות כמה מצלמות בבת אחת סמנו "אותו משתמש וסיסמה".',
  nothingToIdentify: 'אין מצלמה מסומנת שממתינה לזיהוי.',
  devicesTitle: 'התקנים שנמצאו',
  selectAll: 'סימון הכול',
  selectNone: 'ניקוי הסימון',
  selectRow: 'בחירת {addr}',
  cannotSelect: 'לא ניתן לבחור {addr}',
  kindCamera: 'מצלמה',
  kindRecorder: 'מקליט',
  kindUnknown: 'התקן לא מזוהה',
  markBehind: 'כבר דרך המקליט',
  markBehindNote: 'המצלמה כבר מגיעה דרך המקליט, ולכן אי אפשר להוסיף אותה.',
  markStandalone: 'כבר במערכת',
  markOwnRecorder: 'המקליט של המערכת',
  markLooksRecorder: 'נראה כמו מקליט',
  recorderNote: 'מקליט מוסיפים באשף המקליטים.',
  addAsRecorder: 'הוספה כמקליט',
  addRecorderTitle: 'הוספת מקליט',
  recorderAdded: 'המקליט נוסף. הוא יפעל אחרי הפעלה מחדש של השרת.',
  noService: 'נמצא, אין גישה לשירות ONVIF',
  authNotTried: 'ממתין לזיהוי',
  authOk: 'זוהה · {n} זרמים',
  authWrong: 'סיסמה שגויה',
  authWrongNote: 'לא ננסה שוב עד שתשנו את הסיסמה למצלמה הזו.',
  authLocked: 'נעצר כדי לא לנעול את המצלמה',
  authLockedNote: 'היו כמה ניסיונות שגויים. אפשר לנסות שוב בעוד 15 דקות.',
  authDigest: 'המצלמה מבקשת שיטת כניסה שאינה נתמכת',
  authBusy: 'המצלמה עסוקה בבדיקה אחרת. נסו שוב בעוד רגע.',
  authNoAnswer: 'המצלמה לא ענתה',
  authNotOnvif: 'נמצא, אבל לא מוסר כתובת וידאו',
  authSkipped: 'לא נשלחה סיסמה',
  noStream: 'זוהה, בלי כתובת וידאו',
  noStreamNote: 'המצלמה לא מוסרת זרם שאפשר להשתמש בו. אפשר להוסיף אותה ידנית.',
  rowPassword: 'סיסמה למצלמה {addr}',
  rowPasswordPh: 'סיסמה למצלמה הזו',
  rowTry: 'ניסיון',
  clockOff: 'שעון המצלמה שונה ב־{min} דק׳',
  mainSub: 'ראשי {main} · משני {sub}',
  mainOnly: 'זרם אחד {main}',
  summaryIdentify: '{ok} זוהו ומוכנות · {waiting} ממתינות · {bad} לא זוהו',
  pickHint: 'סמנו מצלמות והקלידו סיסמה כדי לזהות אותן.',
  next: 'המשך עם {n} מצלמות',
  nextNone: 'המשך',
  // step 3 - choose and add
  addLead: 'בדקו תמונה, שם ואזור. הזרמים נבחרו אוטומטית - אפשר לשנות.',
  name: 'שם',
  area: 'אזור',
  noArea: 'בלי אזור',
  mainStream: 'זרם ראשי',
  subStream: 'זרם משני',
  sameAsMain: 'כמו הראשי',
  preview: 'תצוגה מקדימה',
  previewing: 'טוען…',
  previewAlt: 'תצוגה מקדימה של {name}',
  previewFailed: 'אין תמונה',
  h265Note: 'H.265 לא מוצג בכל דפדפן - הלייב יוצג דרך הזרם המשני.',
  addFoot: 'יתווספו {n} מצלמות ללא מקליט. הסיסמה תישמר מוצפנת.',
  addN: 'הוספת {n} מצלמות',
  adding: 'מוסיף…',
  nameRequired: 'יש להזין שם לכל מצלמה.',
  doneTitle: 'נוספו {n} מצלמות',
  doneNote: 'הן מופיעות ברשימת המצלמות ובלייב. בדיקת תקינות ראשונה בעוד כמה דקות.',
  partialTitle: 'נוספו {added} מתוך {total}',
  noneAdded: 'לא נוספה אף מצלמה',
  rowAdded: 'נוספה',
  rowFailed: 'לא נוספה',
  finish: 'סיום',
  // refusals (by the server's code; never the code itself)
  errRangeInvalid: 'טווח הכתובות אינו תקין.',
  errRangeTooLarge: 'הטווח גדול מדי: אפשר לחפש עד {max} כתובות בכל פעם.',
  errRangeRefused: 'אפשר לחפש רק ברשת של האתר עצמו.',
  errSiteUnknown: 'לא ניתן לזהות את רשת האתר, ולכן אי אפשר לחפש מצלמות.',
  errRunning: 'חיפוש מצלמות כבר פועל. המתינו לסיומו או עצרו אותו.',
  errRate: 'יותר מדי ניסיונות ברצף. נסו שוב בעוד {s} שניות.',
  errRateSoon: 'יותר מדי ניסיונות ברצף. נסו שוב מאוחר יותר.',
  errGone: 'החיפוש הסתיים או אינו קיים. התחילו חיפוש חדש.',
  errOff: 'חיפוש מצלמות ברשת כבוי בהגדרות.',
  errForbidden: 'אין לך הרשאה לחפש מצלמות.',
  errMedia: 'שירות הווידאו לא הוגדר, ולכן אי אפשר להציג תמונה או להוסיף מצלמות.',
  errCreds: 'יש להזין שם משתמש וסיסמה.',
  errSameForAll: 'כדי לנסות כמה מצלמות בבת אחת יש לסמן "אותו משתמש וסיסמה".',
  errDeviceUnknown: 'אחד המכשירים שנבחרו אינו ברשימת החיפוש.',
  errGeneric: 'הפעולה נכשלה. נסו שוב.',
  failBehind: 'המצלמה כבר מגיעה דרך המקליט.',
  failRecorder: 'המכשיר הזה הוא מקליט: אפשר להוסיף אותו כמקליט.',
  failAlready: 'המצלמה כבר במערכת.',
  failNotIdentified: 'יש לזהות את המצלמה לפני ההוספה.',
  failNoStream: 'המצלמה לא מסרה כתובת וידאו; אפשר להוסיף אותה ידנית.',
  failProfile: 'הזרם שנבחר אינו של המצלמה הזו.',
  failDuplicate: 'המצלמה נבחרה פעמיים.',
  failLimit: 'הגעתם למספר המרבי של מצלמות ללא מקליט.',
  failNotAllowed: 'כתובת הווידאו של המצלמה אינה מותרת.',
  failArea: 'האזור שנבחר אינו קיים.',
  failName: 'יש להזין שם למצלמה.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/camera-discovery').en>('en', 'i18n/camera-discovery', 'en');

export type CdKey = Key;
type CdLang = 'he' | 'en';

function cdLang(): CdLang {
  return docLang(['en']);
}

const TABLES: Record<CdLang, Record<Key, string>> = { he, en };

export function cdt(key: Key, vars?: Record<string, string | number>, lang: CdLang = cdLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const CD_KEYS = Object.keys(he) as Key[];
export const CD_TABLES = TABLES;

registerCatalogue('i18n/camera-discovery', { he, en });
