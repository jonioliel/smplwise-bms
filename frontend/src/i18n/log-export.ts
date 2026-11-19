/**
 * CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033 acceptance 2): the words of the redacted log export card in הגדרות › בריאות ועבודות.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew). The file is about this
 * system only, so no platform is named. Terms: docs/i18n/GLOSSARY_EN.md.
 */
import { docLang, fill, registerCatalogue, type Vars } from './core';

const he = {
  title: 'ייצוא יומן מצונזר',
  subtitle: 'קובץ לבדיקת תקלות: שורות היומן האחרונות עם מזהה הבקשה של כל שורה, בדיקות המערכת והמלצה לכל בעיה.',
  window: 'טווח זמן',
  level: 'רמת פירוט',
  // the window choices (minutes) and the same windows inside the confirmation sentence
  o15: '15 דקות',
  o60: 'שעה (ברירת מחדל)',
  o180: '3 שעות',
  o360: '6 שעות',
  o720: '12 שעות',
  o1440: '24 שעות',
  w15: 'ב־15 הדקות האחרונות',
  w60: 'בשעה האחרונה',
  w180: 'ב־3 השעות האחרונות',
  w360: 'ב־6 השעות האחרונות',
  w720: 'ב־12 השעות האחרונות',
  w1440: 'ב־24 השעות האחרונות',
  // the level choices and the same levels inside the confirmation sentence
  oINFO: 'מידע ומעלה (ברירת מחדל)',
  oWARNING: 'אזהרות ושגיאות',
  oERROR: 'שגיאות בלבד',
  pINFO: 'מידע, אזהרות ושגיאות',
  pWARNING: 'אזהרות ושגיאות',
  pERROR: 'שגיאות בלבד',
  hidden: 'מוסתרים: סיסמאות, אסימונים, פרטי כניסה בכתובות, כתובות רשת, מספרים סידוריים, טלפונים ודוא״ל. לא נכללים וידאו, תמונות או תוכניות.',
  export: 'ייצוא היומן',
  exporting: 'מייצא…',
  confirmTitle: 'לייצא את היומן?',
  confirmBody: 'הקובץ יכלול את שורות היומן שנכתבו {window} ({level}) ואת בדיקות המערכת, אחרי הסתרת סיסמאות, אסימונים, כתובות, מספרים סידוריים ופרטים אישיים. אין בו וידאו, תמונות או תוכניות. הייצוא נרשם ביומן הביקורת.',
  confirm: 'אישור והורדה',
  cancel: 'ביטול',
  done: 'הקובץ {name} הורד',
  cancelled: 'הייצוא בוטל; לא נוצר קובץ',
  forbidden: 'רק מי שמורשה לנהל את הגדרות המערכת יכול לייצא את היומן.',
  consent: 'השרת לא קיבל את האישור. נסו שוב ואשרו את הייצוא.',
  failed: 'הייצוא נכשל: {error}',
  retry: 'נסו שוב',
} as const;

export type LogExportKey = keyof typeof he;

const en: Record<LogExportKey, string> = {
  title: 'Redacted log export',
  subtitle: 'A file for troubleshooting: the latest log lines with the request id of each line, the system checks and a recommendation for each problem.',
  window: 'Time range',
  level: 'Detail level',
  o15: '15 minutes',
  o60: '1 hour (default)',
  o180: '3 hours',
  o360: '6 hours',
  o720: '12 hours',
  o1440: '24 hours',
  w15: 'in the last 15 minutes',
  w60: 'in the last hour',
  w180: 'in the last 3 hours',
  w360: 'in the last 6 hours',
  w720: 'in the last 12 hours',
  w1440: 'in the last 24 hours',
  oINFO: 'Information and above (default)',
  oWARNING: 'Warnings and errors',
  oERROR: 'Errors only',
  pINFO: 'information, warnings and errors',
  pWARNING: 'warnings and errors',
  pERROR: 'errors only',
  hidden: 'Hidden: passwords, tokens, sign-in details in addresses, network addresses, serial numbers, phone numbers and e-mail addresses. Video, pictures and plans are never included.',
  export: 'Export the log',
  exporting: 'Exporting…',
  confirmTitle: 'Export the log?',
  confirmBody: 'The file will hold the log lines written {window} ({level}) and the system checks, after hiding passwords, tokens, addresses, serial numbers and personal details. It holds no video, pictures or plans. The export is recorded in the audit log.',
  confirm: 'Confirm and download',
  cancel: 'Cancel',
  done: '{name} was downloaded',
  cancelled: 'The export was cancelled; no file was created',
  forbidden: 'Only someone allowed to manage the system settings can export the log.',
  consent: 'The server did not receive the confirmation. Try again and confirm the export.',
  failed: 'The export failed: {error}',
  retry: 'Try again',
};

registerCatalogue('i18n/log-export', { he, en });

/** The log export card's text in the document language (a missing English falls back to the Hebrew), `{name}` filled. */
export const lxt = (key: LogExportKey, vars?: Vars | null): string => fill((docLang(['en']) === 'en' ? en[key] : undefined) ?? he[key], vars);
