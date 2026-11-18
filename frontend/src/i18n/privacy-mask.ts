/**
 * MASKUI-295: the words of the privacy-mask editor (Settings > Security > Privacy masks). Hebrew first; English, Arabic and Russian follow
 * the document language. Every key exists in all four tables (tests/unit-privacy-mask.spec.ts holds the parity). The Arabic and Russian
 * columns are an INITIAL translation that needs a native review (dev-marked). Operator texts never name the home platform.
 * `{n}` style placeholders are filled by `pm(key, { n })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  tab: 'מסכות פרטיות',
  crumbs: 'הגדרות | אבטחה',
  heading: 'מסכות פרטיות',
  cameras: 'מצלמות',
  camera_edited: 'נערכה',
  snapshot_alt: 'תמונה מהמצלמה {name}',
  no_picture: 'אין תמונה מהמצלמה',
  mask_on: 'מסכה פעילה',
  add_region: 'הוספת אזור',
  delete_region: 'מחיקת אזור',
  discard: 'ביטול השינויים',
  region_n: 'אזור {n}',
  region_poly: 'אזור {n} (צורה חופשית)',
  regions_count: '{n} מתוך {max} אזורים',
  region_keys: 'חצים מזיזים. Shift וחצים משנים גודל. Delete מוחק.',
  corner: 'פינה {name}',
  corner_tl: 'שמאלית עליונה',
  corner_tr: 'ימנית עליונה',
  corner_bl: 'שמאלית תחתונה',
  corner_br: 'ימנית תחתונה',
  review: 'בדיקת השינויים ({n})',
  reviewing: 'קורא את המצלמות…',
  back: 'חזרה לעריכה',
  next: 'המשך לאישור',
  write: 'כתיבה ל־NVR',
  cancel: 'ביטול',
  preview_title: 'לפני ואחרי',
  before: 'לפני',
  after: 'אחרי',
  st_ready: 'ייכתב',
  st_unchanged: 'ללא שינוי',
  st_invalid: 'לא תקין',
  st_skipped: 'לא ייכתב',
  confirm_title: 'כתיבת מסכות פרטיות',
  confirm_lead: 'המסכה מכסה את התמונה בצפייה החיה ובהקלטה. הכתיבה נשלחת רק עכשיו, פעם אחת.',
  confirm_count: '{n} מצלמות ייכתבו',
  confirm_count_one: 'מצלמה אחת תיכתב',
  applying: 'כותב…',
  result_title: 'תוצאות הכתיבה',
  res_applied: 'נכתב ואומת',
  res_unchanged: 'ללא שינוי',
  res_skipped: 'לא נכתב',
  res_failed: 'הכתיבה נכשלה',
  res_not_attempted: 'לא נוסה',
  restored: 'המקור הוחזר',
  not_restored: 'המקור לא אומת, יש לבדוק במצלמה',
  undo: 'ביטול הכתיבה',
  undoing: 'מחזיר…',
  undone: 'הוחזר למצב הקודם',
  done: 'סיום',
  log_title: 'היסטוריית שינויים',
  log_empty: 'עדיין לא נכתבו מסכות במצלמה הזו',
  log_applied: 'נכתב',
  log_rolled_back: 'בוטל',
  log_failed: 'נכשל',
  log_diverged: 'לא אומת',
  log_other: 'אחר',
  off_switch: 'כתיבת מסכות פרטיות כבויה בהגדרות המערכת, ולכן אפשר רק לצפות. מנהל מערכת יכול להפעיל אותה.',
  off_perm: 'אין לך הרשאה לשנות מסכות פרטיות, ולכן אפשר רק לצפות.',
  off_nvr_writes: 'שינויי הגדרות ב־NVR של המצלמה הזו כבויים, ולכן אפשר רק לצפות. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.',
  off_remote: 'מסכות פרטיות משתנות רק ברשת המקומית, ולכן אפשר רק לצפות.',
  loading: 'טוען',
  retry: 'נסו שוב',
  err_cameras: 'רשימת המצלמות לא נטענה',
  err_mask: 'המסכה של המצלמה לא נקראה',
  forbidden: 'אין הרשאה לצפות במסכות פרטיות',
  empty_cameras: 'אין מצלמות לעריכה',
  inv_need_region: 'מסכה פעילה צריכה לפחות אזור אחד',
  inv_too_many: 'מותרים עד {max} אזורים',
  inv_too_small: 'אזור קטן מדי',
  e_feature_disabled: 'כתיבת מסכות פרטיות כבויה בהגדרות המערכת.',
  e_forbidden: 'אין הרשאה לפעולה הזו.',
  e_stale: 'המסכה במצלמה השתנתה מאז הבדיקה. יש לבדוק שוב.',
  e_validation: 'המסכה אינה תקינה למצלמה הזו.',
  e_nvr_not_supported: 'המצלמה אינה תומכת במסכות פרטיות.',
  e_source_forbidden: 'המצלמה אינה זמינה לכתיבה.',
  e_changed_since: 'המסכה במצלמה שונתה מאז, ולכן אין החזרה אוטומטית.',
  e_not_rollbackable: 'אי אפשר להחזיר את השינוי הזה.',
  e_nvr_verify_mismatch: 'ההחזרה לא אומתה. יש לבדוק את המצלמה.',
  e_nvr_writes_off: 'שינויי הגדרות ב־NVR של המצלמה הזו כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.',
  e_generic: 'הפעולה נכשלה. לא נשלח דבר נוסף.',
  sw_label: 'כתיבת מסכות פרטיות ל-NVR',
  sw_confirm: 'שום דבר לא נכתב לפני לחיצה על כפתור הכתיבה בכל פעם.',
  sw_turn_on: 'הפעלה',
  sw_saving: 'שומר…',
  sw_err: 'השינוי לא נשמר. נסו שוב.',
};

export type PmKey = keyof typeof he;

const en: Record<PmKey, string> = packTable<typeof import('./lang/en/i18n/privacy-mask').en>('en', 'i18n/privacy-mask', 'en');

const ar: Record<PmKey, string> = packTable<typeof import('./lang/ar/i18n/privacy-mask').ar>('ar', 'i18n/privacy-mask', 'ar');

const ru: Record<PmKey, string> = packTable<typeof import('./lang/ru/i18n/privacy-mask').ru>('ru', 'i18n/privacy-mask', 'ru');

export type PmLang = 'he' | 'en' | 'ar' | 'ru';
const TABLES: Record<PmLang, Record<PmKey, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const PM_DEV_MARKED: readonly PmLang[] = ['ar', 'ru'];
export const PM_KEYS = Object.keys(he) as PmKey[];
export const PM_TABLES = TABLES;

export function pmLang(): PmLang {
  return docLang(['en', 'ar', 'ru']);
}

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function pm(key: PmKey, vars?: Record<string, string | number>, lang: PmLang = pmLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** The line for a server error code (`e_<code>`), or the generic one. The server's own text is Hebrew only, so it is never shown. */
export function pmError(code: string, lang: PmLang = pmLang()): string {
  const key = `e_${code}`;
  return key in he ? pm(key as PmKey, undefined, lang) : pm('e_generic', undefined, lang);
}

registerCatalogue('i18n/privacy-mask', { he, en, ar, ru }, PM_DEV_MARKED);
