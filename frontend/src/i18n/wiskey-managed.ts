/**
 * WISKEY-MANAGED-INSTALL-2382: the words of the "installation and updates" card on Settings > Security > access-control
 * (#/system/security/wiskey). Hebrew first; English, Arabic and Russian follow the document language (a missing key falls back to the
 * Hebrew; a unit test holds the parity). The Arabic and Russian columns are an INITIAL translation and need a native review
 * (dev-marked). No home-platform name and no internal key on the face: the platform is "תשתית המערכת"; closed codes show only in the
 * small details line.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'התקנה ועדכון של רכיב בקרת הכניסה',
  lead: 'מנהל מערכת מתקין ומעדכן את הרכיב מכאן, אחרי בדיקת גיבוי מלא. התקנה בעליית התוסף רק אם הופעלה כאן, ואין שדרוג לאחור.',
  installed: 'מותקן',
  shipped: 'זמין בגרסה זו',
  status: 'מצב',
  none: 'לא מותקן',
  details: 'פרטים',
  on: 'פועל',
  off: 'כבוי',
  turnOn: 'הפעלה',
  turnOff: 'כיבוי',
  cancel: 'ביטול',
  close: 'סגירה',
  retry: 'נסו שוב',
  loadFailed: 'הטעינה נכשלה',
  failed: 'הפעולה נכשלה',
  forbidden: 'רק מנהל מערכת יכול לבצע פעולה זו.',
  own_manual: 'הותקן ידנית',
  own_adopted: 'הועבר לניהול המערכת',
  own_arx_managed: 'מנוהל על ידי המערכת',
  own_legacy: 'התקנה קודמת מזוהה',
  own_unknown: 'לא מזוהה',
  own_missing: 'לא מותקן',
  own_marker_invalid: 'סימון ההתקנה הידנית אינו תקין',
  own_link: 'קישור במקום תיקייה',
  own_unreadable: 'לא ניתן לקריאה',
  own_not_mapped: 'תיקיית ההגדרות אינה זמינה',
  plan_install: 'אפשר להתקין',
  plan_upgrade: 'עדכון זמין',
  plan_convert: 'אפשר להעביר לניהול (אותה גרסה)',
  plan_up_to_date: 'מעודכן',
  plan_downgrade_refused: 'המותקן חדש יותר: אין שדרוג לאחור',
  plan_same_version_different_content: 'אותו מספר גרסה עם תוכן אחר: נדרשת בדיקה',
  plan_version_unknown: 'מספר הגרסה אינו מזוהה',
  plan_bundle_missing: 'אין חבילה תקינה בגרסה זו',
  plan_not_mapped: 'תיקיית ההגדרות אינה זמינה',
  enabledTitle: 'התקנה ועדכון דרך המערכת',
  enabledText: 'כשמופעל, מנהל מערכת יכול להתקין, לעדכן ולהחזיר גרסה מכאן. ההפעלה עצמה לא מתקינה דבר.',
  riskTitle: 'קבלת סיכון בבדיקת סביבת ההתקנה',
  riskText: 'מאפשר עדכון כשסביבת ההתקנה נצפתה אך לא ניתן לאמת את מקורה. לא חל על אף תוצאה אחרת, ולא על התקנה בעליית התוסף.',
  startupTitle: 'התקנה ועדכון בעליית התוסף',
  startupText: 'כשמופעל, עדכון זמין מתבצע מעצמו כשהתוסף עולה, עם אותן בדיקות: גיבוי מלא עדכני, בדיקת סביבת ההתקנה, השוואה והחזרה בכשל. התקנה ידנית שלא הועברה לניהול לא תוחלף. ניסיון אחד לכל גרסה.',
  keepTitle: 'כמה עדכונים אחרונים לשמור',
  keepText: 'לכל עדכון נשמרים הגרסה הקודמת והגיבוי הפרטי שלו. הישנים יותר נמחקים אחרי העדכון המוצלח הבא.',
  keepLabel: 'מספר העדכונים',
  keepSave: 'שמירה',
  keepSaved: 'נשמר',
  originStartup: 'בעליית התוסף',
  typeQ: 'להפעיל את "{name}"?',
  typeText: 'כדי לאשר, יש להקליד את המשפט: {phrase}',
  typeLabel: 'משפט האישור',
  typeWrong: 'המשפט אינו תואם. יש להקליד אותו בדיוק.',
  offQ: 'לכבות את "{name}"?',
  offText: 'אי אפשר יהיה להתקין או לעדכן מכאן עד שיופעל שוב. מה שמותקן נשאר כפי שהוא.',
  adoptButton: 'העברה לניהול המערכת',
  adoptQ: 'להעביר את ההתקנה הידנית לניהול המערכת?',
  adoptText: 'המערכת תשמור גיבוי פרטי של הרכיב ושל הרישום. בהתקנה עצמה לא ישתנה דבר עד העדכון הבא.',
  adoptDone: 'ההתקנה עברה לניהול המערכת',
  checkButton: 'בדיקה לפני עדכון',
  checking: 'בודק…',
  checkTitle: 'תוצאת הבדיקה',
  chk_preflight: 'גרסאות, חבילה ובעלות',
  chk_supervisor: 'שירות הניהול של תשתית המערכת',
  chk_core_gate: 'בדיקת סביבת ההתקנה',
  chk_backup_check: 'גיבוי מלא מ-24 השעות האחרונות',
  chk_pass: 'עבר',
  chk_warn: 'עבר בקבלת סיכון',
  chk_fail: 'לא עבר',
  upgradeButton: 'עדכון עכשיו',
  installButton: 'התקנה עכשיו',
  convertButton: 'העברה לניהול עכשיו',
  upgradeQ: 'להתחיל עכשיו?',
  upgradeText: 'תשתית המערכת תיעצר לזמן קצר, הרכיב יוחלף ויאומת, ותשתית המערכת תופעל שוב. בכל כשל הגרסה הקודמת תוחזר.',
  rollbackButton: 'חזרה לגרסה הקודמת',
  rollbackQ: 'לחזור לגרסה הקודמת?',
  rollbackText: 'תשתית המערכת תיעצר לזמן קצר והגרסה הקודמת תוחזר בדיוק כפי שהייתה.',
  start: 'התחלה',
  progress: 'התקדמות',
  step_preflight: 'בדיקות מקדימות',
  step_core_gate: 'בדיקת סביבת ההתקנה',
  step_backup_check: 'בדיקת גיבוי מלא',
  step_snapshot_before: 'רישום המצב לפני',
  step_stop_core: 'עצירת תשתית המערכת',
  step_backup_local: 'גיבוי פרטי',
  step_swap: 'החלפה מאומתת של הרכיב',
  step_start_core: 'הפעלת תשתית המערכת',
  step_verify: 'השוואת לפני ואחרי',
  step_rollback: 'החזרת הגרסה הקודמת',
  step_start_core_after_rollback: 'הפעלה אחרי ההחזרה',
  step_verify_after_rollback: 'השוואה אחרי ההחזרה',
  job_running: 'בביצוע',
  job_succeeded: 'הושלם בהצלחה',
  job_aborted: 'הופסק לפני כל שינוי',
  job_rolled_back: 'נכשל, והגרסה הקודמת הוחזרה',
  job_rollback_failed: 'נכשל וגם ההחזרה נכשלה: יש לשחזר את הגיבוי המלא',
  job_interrupted: 'נקטע בהפעלה מחדש של המערכת: יש לבדוק את המצב',
  job_failed: 'נכשל',
  lastRun: 'הפעולה האחרונה',
  riskAccepted: 'בוצע בקבלת סיכון בבדיקת סביבת ההתקנה',
  unattended: 'ההתקנה האוטומטית הישנה, בלי בדיקת גיבוי והשוואה, נשארת כבויה.',
  code_core_not_running: 'תשתית המערכת לא פועלת',
  code_validation: 'הערך אינו תקין',
  code_full_backup_missing: 'לא נמצא גיבוי מלא',
  code_full_backup_stale: 'הגיבוי המלא האחרון ישן מ-24 שעות',
  code_backups_unreadable: 'אי אפשר לקרוא את רשימת הגיבויים',
  code_core_gate_unverified: 'מקור סביבת ההתקנה אינו מאומת',
  code_core_did_not_stop: 'תשתית המערכת לא נעצרה',
  code_core_stop_refused: 'עצירת תשתית המערכת נדחתה',
  code_core_did_not_start: 'תשתית המערכת לא עלתה בזמן',
  code_core_start_refused: 'הפעלת תשתית המערכת נדחתה',
  code_entry_not_loaded: 'תחנה לא נטענה אחרי ההחלפה',
  code_entries_changed: 'רשימת התחנות השתנתה',
  code_devices_changed: 'רשימת ההתקנים השתנתה',
  code_entities_changed: 'רשימת הישויות השתנתה',
  code_snapshot_unavailable: 'אי אפשר לקרוא את הרישום',
  code_supervisor_unreachable: 'שירות הניהול אינו זמין',
  code_adoption_required: 'יש להעביר את ההתקנה לניהול המערכת קודם',
  code_plan_refused: 'אין עדכון שאפשר לבצע',
  code_other: 'הפעולה נדחתה',
};
type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/wiskey-managed').en>('en', 'i18n/wiskey-managed', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Record<Key, string> = packTable<typeof import('./lang/ar/i18n/wiskey-managed').ar>('ar', 'i18n/wiskey-managed', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Record<Key, string> = packTable<typeof import('./lang/ru/i18n/wiskey-managed').ru>('ru', 'i18n/wiskey-managed', 'ru');

const TABLES: Record<WmLang, Record<Key, string>> = { he, en, ar, ru };
export type WmKey = Key;
export type WmLang = 'he' | 'en' | 'ar' | 'ru';

export function wmLang(): WmLang {
  return docLang(['en', 'ar', 'ru']);
}

export const WM_DEV_MARKED: readonly WmLang[] = ['ar', 'ru'];

export function wmt(key: Key, vars?: Record<string, string | number>, lang: WmLang = wmLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A word for a closed key family (`own_`, `plan_`, `step_`, `job_`, `chk_`, `code_`), or null when the code has none. */
export function wmtOf(prefix: 'own_' | 'plan_' | 'step_' | 'job_' | 'chk_' | 'code_', code: string | null | undefined, lang: WmLang = wmLang()): string | null {
  if (!code) return null;
  const k = `${prefix}${code}`;
  return k in he ? wmt(k as Key, undefined, lang) : null;
}

export const WM_KEYS = Object.keys(he) as Key[];
export const WM_TABLES = TABLES;

registerCatalogue('i18n/wiskey-managed', { he, en, ar, ru }, WM_DEV_MARKED);
