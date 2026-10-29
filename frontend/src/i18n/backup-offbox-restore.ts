/**
 * OFFBOX-RESTORE-2300: the words of "restore from an off-box copy" (Settings > Diagnostics > Backup and restore > Off-box copies).
 * Hebrew and English; the document language picks (anything but English shows Hebrew). `{x}` placeholders are filled by `obr(key, vars)`.
 * Server error codes are `err_<code>`; an unknown code falls back to `err_other`.
 */
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
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  open: 'Restore from copy',
  title: 'Restore from an off-box copy',
  loading: 'Loading the copies…',
  none: 'This target holds no copies',
  pick: 'Pick a copy (newest first)',
  newest: 'newest',
  prepare: 'Download and verify',
  preparing: 'Downloading and decrypting…',
  verified: 'The copy was downloaded, decrypted and checked. Nothing in the system has changed yet.',
  summary_version: 'Application version',
  summary_schema: 'Data schema',
  summary_tables: 'Tables / files',
  summary_key: 'Encryption key',
  warnDestructive: 'Restoring replaces the current project with the copy. A local safety backup is written first, so this can be undone.',
  includeAccess: 'Also restore users and permissions',
  password: 'Backup password (for the encrypted section of the copy)',
  skipSensitive: 'Restore without the passwords of local accounts',
  confirmHint: 'Type RESTORE to confirm',
  restore: 'Restore',
  restoring: 'Restoring…',
  cancel: 'Cancel',
  done: 'Restored from {name}: {n} tables, {files} files. Safety backup: {safety}. Refresh the screen.',
  err_key_missing: 'This installation has no encryption key. Import the exported key (Import key) and try again.',
  err_key_mismatch: 'The copy was encrypted with a key this installation does not hold. Import the right key.',
  err_sealed_damaged: 'The copy is damaged or was changed. Try another copy.',
  err_sealed_invalid: 'The file is not an encrypted Arx copy.',
  err_archive_invalid: 'The archive inside the copy is not valid.',
  err_schema_newer: 'The copy is newer than the installed version. Update the add-on, then try again.',
  err_disk_insufficient: 'Not enough free disk space.',
  err_object_missing: 'The copy is not at the target.',
  err_stage_missing: 'The preparation expired. Download and verify again.',
  err_stage_changed: 'The prepared file changed. Prepare again.',
  err_safety_failed: 'The safety backup could not be written, so the restore did not start.',
  err_destination_unavailable: 'The target is not reachable.',
  err_push_running: 'Another transfer is running.',
  err_other: 'The action was refused.',
};

export type ObrKey = Key;
export const OBR_KEYS = Object.keys(he) as Key[];
export const OBR_TABLES = { he, en };

export function obrLang(): 'he' | 'en' {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

export function obr(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = obrLang()): string {
  const raw = OBR_TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export function obrError(code: string | null | undefined, lang: 'he' | 'en' = obrLang()): string {
  const k = `err_${code ?? ''}` as Key;
  return k in he ? obr(k, undefined, lang) : obr('err_other', undefined, lang);
}
