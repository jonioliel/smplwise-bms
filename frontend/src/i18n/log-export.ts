/**
 * CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033 acceptance 2): the words of the redacted log export card in הגדרות › בריאות ועבודות.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew). The file is about this
 * system only, so no platform is named. Terms: docs/i18n/GLOSSARY_EN.md.
 */
import { docLang, fill, registerCatalogue, type Vars } from './core';
import { packTable } from './lang-packs';

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

const en: Record<LogExportKey, string> = packTable<typeof import('./lang/en/i18n/log-export').en>('en', 'i18n/log-export', 'en');

registerCatalogue('i18n/log-export', { he, en });

/** The log export card's text in the document language (a missing English falls back to the Hebrew), `{name}` filled. */
export const lxt = (key: LogExportKey, vars?: Vars | null): string => fill((docLang(['en']) === 'en' ? en[key] : undefined) ?? he[key], vars);
