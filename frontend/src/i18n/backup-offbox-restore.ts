/**
 * OFFBOX-RESTORE-2300: the words of "restore from an off-box copy" (Settings > Diagnostics > Backup and restore > Off-box copies).
 * Hebrew and English; the document language picks (anything but English shows Hebrew). `{x}` placeholders are filled by `obr(key, vars)`.
 * Server error codes are `err_<code>`; an unknown code falls back to `err_other`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  open: 'שחזור מעותק',
  title: 'שחזור מעותק מחוץ למכונה',
  loading: 'טוען רשימת עותקים…',
  none: 'אין עותקים ביעד הזה',
  pick: 'בחרו עותק (מוצגים החדשים ביותר)',
  newest: 'החדש ביותר',
  prepare: 'הורדה ואימות',
  preparing: 'מוריד ומפענח…',
  verified: 'העותק הורד, פוענח ונבדק. עדיין לא שונה דבר במערכת.',
  summary_version: 'גרסת היישום',
  summary_schema: 'גרסת מבנה הנתונים',
  summary_tables: 'טבלאות / קבצים',
  summary_key: 'מפתח הצפנה',
  warnDestructive: 'השחזור מחליף את הפרויקט הנוכחי בתוכן העותק. לפני כן נכתב גיבוי ביטחון מקומי, שאפשר לשחזר ממנו.',
  includeAccess: 'לשחזר גם משתמשים והרשאות',
  password: 'סיסמת הגיבוי (לחלק המוצפן של העותק)',
  skipSensitive: 'לשחזר בלי הסיסמאות של החשבונות המקומיים',
  confirmHint: 'לאישור הקלידו RESTORE',
  restore: 'שחזור',
  restoring: 'משחזר…',
  cancel: 'ביטול',
  done: 'שוחזר מ־{name}: {n} טבלאות, {files} קבצים. גיבוי הביטחון: {safety}. מומלץ לרענן את המסך.',
  err_key_missing: 'אין מפתח הצפנה במערכת הזו. יש לייבא את המפתח שיוצא (ייבוא מפתח) ולנסות שוב.',
  err_key_mismatch: 'העותק הוצפן במפתח שאינו מותקן כאן. יש לייבא את המפתח הנכון.',
  err_sealed_damaged: 'העותק פגום או שונה. נסו עותק אחר.',
  err_sealed_invalid: 'הקובץ אינו עותק מוצפן של Arx.',
  err_archive_invalid: 'הארכיון שבתוך העותק אינו תקין.',
  err_schema_newer: 'העותק חדש מהגרסה המותקנת. יש לעדכן את התוסף ואז לנסות שוב.',
  err_disk_insufficient: 'אין מספיק מקום פנוי בדיסק.',
  err_object_missing: 'העותק לא נמצא ביעד.',
  err_stage_missing: 'ההכנה פגה. יש להוריד ולאמת מחדש.',
  err_stage_changed: 'הקובץ המוכן השתנה. יש להכין מחדש.',
  err_safety_failed: 'גיבוי הביטחון לא נכתב, ולכן השחזור לא התחיל.',
  err_destination_unavailable: 'היעד לא זמין.',
  err_push_running: 'העברה אחרת רצה כרגע.',
  err_other: 'הפעולה נדחתה.',
  // owner decisions 2026-10-30: the safety backup's password, the local safety backup switch, the scope default
  safetyPassword: 'סיסמה לגיבוי הביטחון',
  safetyHint: 'אופציונלי. בלעדיה גיבוי הביטחון נשמר בלי סיסמאות החשבונות המקומיים',
  safetyPlaceholder: 'לפחות {n} תווים',
  safetyOff: 'גיבוי הביטחון לפני שחזור כבוי בהגדרות: השחזור לא ישאיר נקודת חזרה.',
  localSafety: 'גיבוי ביטחון לפני שחזור',
  localSafetyHint: 'לפני כל שחזור נשמר גיבוי של המצב הנוכחי (שלושת האחרונים נשמרים)',
  scopeDefault: 'שחזור מעותק כולל משתמשים והרשאות',
  scopeDefaultHint: 'הבחירה ההתחלתית בחלון השחזור; אפשר לשנות בכל שחזור',
  saved: 'ההגדרה נשמרה',
  localScope: 'שחזור מגיבוי כולל משתמשים והרשאות',
  localScopeHint: 'הבחירה ההתחלתית בחלון השחזור; ההרשאות שלך נשמרות בכל מקרה',
  accessLabel: 'כולל משתמשים והרשאות',
  accessHint: 'ההרשאות שלך נשמרות בכל מקרה. ברירת המחדל נקבעת בהגדרות הגיבוי.',
  safetyDone: 'גיבוי הביטחון: {safety}',
  err_safety_password_weak: 'הסיסמה לגיבוי הביטחון צריכה לפחות {n} תווים.',
  err_safety_password_too_long: 'הסיסמה לגיבוי הביטחון ארוכה מדי.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/backup-offbox-restore').en>('en', 'i18n/backup-offbox-restore', 'en');

export const OBR_KEYS = Object.keys(he) as Key[];
export const OBR_TABLES = { he, en };

function obrLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function obr(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = obrLang()): string {
  const raw = OBR_TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export function obrError(code: string | null | undefined, lang: 'he' | 'en' = obrLang(), vars?: Record<string, string | number>): string {
  const k = `err_${code ?? ''}` as Key;
  return k in he ? obr(k, vars, lang) : obr('err_other', undefined, lang);
}

/** A refused restore in words: a refused safety password names the minimum in force (the server's `details.min_chars`). */
export function obrApiError(code: string, details: Record<string, unknown> | undefined, lang: 'he' | 'en' = obrLang()): string {
  const n = typeof details?.min_chars === 'number' ? details.min_chars : 12;
  return obrError(code, lang, { n });
}

registerCatalogue('i18n/backup-offbox-restore', { he, en });
