/**
 * DATASTORE-295 phase 2: the words of Settings › אבחון › גיבוי ושחזור › עותקים מחוץ למכונה and the restore drill rows. Hebrew first;
 * English, Arabic and Russian follow the document language (a missing key falls back to the Hebrew). Arabic and Russian are an INITIAL
 * translation that needs a native review (dev-marked, like backup-password.ts). `{x}` placeholders are filled by `obt(key, vars)`.
 * Error codes of the server (`err_<code>`) are translated here; an unknown code shows `err_other`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  cardTitle: 'עותקים מחוץ למכונה',
  cardSub: 'עותק מוצפן של הגיבוי היומי נשלח ליעד חיצוני ונבדק אחרי ההעלאה',
  empty: 'אין יעדים',
  addS3: 'הוספת יעד S3',
  addSftp: 'הוספת יעד SFTP',
  kind_s3: 'S3 (תואם)',
  kind_sftp: 'SFTP',
  kind_local: 'תיקייה',
  enabled: 'פעיל',
  disabled: 'כבוי',
  name: 'שם',
  endpoint: 'כתובת השירות',
  bucket: 'דלי (bucket)',
  region: 'אזור',
  prefix: 'תיקייה בדלי',
  path_style: 'כתובת בסגנון path',
  access_key: 'מזהה מפתח גישה',
  secret_key: 'מפתח סודי',
  host: 'שרת',
  port: 'פורט',
  username: 'משתמש',
  remote_dir: 'תיקייה בשרת',
  host_key: 'מפתח השרת (קבוע)',
  hostKeyHint: 'השורה ssh-ed25519 … של השרת, או טביעת SHA256:…',
  key: 'מפתח פרטי',
  secretSet: 'שמור · השאירו ריק כדי לא לשנות',
  secretMissing: 'לא הוגדר',
  retention: 'שמירה',
  keep_last: 'אחרונים',
  keep_daily: 'ימים',
  keep_weekly: 'שבועות',
  keep_monthly: 'חודשים',
  save: 'שמירה',
  cancel: 'ביטול',
  edit: 'עריכה',
  remove: 'מחיקה',
  removeConfirm: 'למחוק את היעד? העותקים שכבר נמצאים ביעד לא נמחקים.',
  test: 'בדיקת חיבור',
  testOk: 'החיבור תקין: נכתב, נקרא ונמחק קובץ בדיקה',
  dryRun: 'בדיקה יבשה',
  dryRunOk: 'יועלה {name}; יימחקו {n} עותקים ישנים',
  pushNow: 'העלאה עכשיו',
  pushStarted: 'ההעלאה התחילה',
  lastPush: 'עותק אחרון',
  lastTest: 'בדיקה אחרונה',
  lastDrill: 'בדיקת שחזור',
  never: 'עדיין לא',
  ok: 'תקין',
  failed: 'נכשל',
  verified: 'נבדק',
  saved: 'היעד נשמר',
  keyTitle: 'מפתח ההצפנה',
  keySub: 'נשמר רק בהתקנה הזו. בלי המפתח אי אפשר לפתוח את העותקים.',
  keyActive: 'מפתח פעיל',
  keyNone: 'ייווצר בהעלאה הראשונה',
  keyExported: 'יוצא',
  keyNotExported: 'לא יוצא',
  keyExport: 'ייצוא המפתח',
  keyExportTitle: 'ייצוא מפתח ההצפנה',
  keyExportWarn: 'המפתח יוצג פעם אחת בלבד. שמרו אותו מחוץ למכונה (מנהל סיסמאות או נייר). כל מי שמחזיק בו יכול לפתוח את העותקים.',
  keyExportConfirm: 'לאישור הקלידו EXPORT',
  keyExportWhat: 'מפתח ההצפנה הוא הסוד שמצפין את עותקי הגיבוי החיצוניים. רק הוא פותח אותם.',
  keyExportNoRestore: 'בלי המפתח אי אפשר לשחזר גיבוי.',
  keyExportLost: 'אם המפתח אבד, הגיבוי אבד, וגם אנחנו לא נוכל לפתוח אותו.',
  keyExportStore: 'שמרו את המפתח מחוץ למערכת הזו, במנהל סיסמאות או על נייר, ולא בגיבוי עצמו.',
  keyExportAck: 'הבנתי ששומרים את המפתח מחוץ למערכת ושבלעדיו אי אפשר לשחזר',
  keyShown: 'העתיקו עכשיו. המפתח לא יוצג שוב.',
  copy: 'העתקה',
  copied: 'הועתק',
  keyRotate: 'החלפת מפתח',
  keyRotateTitle: 'החלפת מפתח ההצפנה',
  keyRotateWarn: 'עותקים חדשים יוצפנו במפתח חדש. המפתחות הקודמים נשמרים, והעותקים הישנים ממשיכים להיפתח. יש לייצא גם את המפתח החדש.',
  keyRotateConfirm: 'לאישור הקלידו ROTATE',
  keyRotated: 'המפתח הוחלף',
  keyImport: 'ייבוא מפתח',
  keyImportHint: 'מפתח שיוצא מהתקנה קודמת (SWXB-KEY-1:…)',
  keyImported: 'המפתח נוסף',
  keys: '{n} מפתחות',
  drillTitle: 'בדיקת שחזור',
  drillSub: 'הגיבוי משוחזר לתיקייה זמנית ונבדק. המסד הפעיל לא משתנה.',
  drillRun: 'בדיקה עכשיו',
  drillRunTarget: 'בדיקת העותק המוצפן',
  drillRunning: 'הבדיקה רצה…',
  drillMonthly: 'בדיקה חודשית',
  drillLocal: 'גיבוי מקומי',
  drillOffbox: 'עותק מחוץ למכונה',
  pass: 'עבר',
  fail: 'נכשל',
  sftpMissing: 'רכיב ה־SFTP לא מותקן בגרסה הזו',
  err_auth_failed: 'פרטי הכניסה נדחו',
  err_host_key_mismatch: 'מפתח השרת לא תואם למפתח השמור',
  err_host_key_required: 'יש להדביק את מפתח השרת',
  err_bucket_missing: 'הדלי לא קיים',
  err_object_missing: 'הקובץ לא נמצא ביעד',
  err_destination_unavailable: 'היעד לא זמין',
  err_permission_denied: 'אין הרשאת כתיבה ביעד',
  err_verify_hash_mismatch: 'הקובץ שהועלה לא תואם',
  err_verify_plain_mismatch: 'העותק לא נפתח כמו המקור',
  err_credential_missing: 'חסרים פרטי גישה',
  err_secrets_missing: 'חסרים פרטי גישה',
  err_key_unreadable: 'המפתח הפרטי לא נקרא',
  err_key_missing: 'אין מפתח הצפנה',
  err_key_mismatch: 'העותק הוצפן במפתח שלא נמצא כאן',
  err_key_already_exported: 'המפתח כבר יוצא. לייצוא נוסף יש להחליף מפתח.',
  err_key_import_invalid: 'זה לא מפתח מיוצא תקין',
  err_archive_missing: 'אין גיבוי להעלאה',
  err_destination_invalid: 'אחד השדות לא תקין',
  err_push_running: 'העברה אחרת רצה',
  err_transport_not_available: 'רכיב ההעברה לא מותקן',
  err_offbox_fetch: 'העותק לא הורד או לא נפתח',
  // GDRIVEBK-2310: Google Drive targets
  addGdrive: 'הוספת Google Drive',
  kind_gdrive: 'Google Drive',
  client_id: 'מזהה לקוח (Client ID)',
  client_secret: 'סוד הלקוח (Client secret)',
  folder_name: 'שם התיקייה ב־Drive',
  prune_mode: 'מחיקת עותקים ישנים',
  prune_delete: 'מחיקה מיידית',
  prune_trash: 'העברה לאשפה (נספרת במכסה 30 יום)',
  chunk_mib: 'גודל מקטע העלאה (MiB)',
  quota_margin_pct: 'מרווח מכסה (%)',
  min_free_mib: 'מקום פנוי מינימלי (MiB)',
  gdriveSetupHint: 'יש ליצור פעם אחת לקוח OAuth מסוג "TVs and Limited Input devices" בחשבון Google שלכם ולהדביק כאן את המזהה והסוד. ההרשאה מוגבלת לקבצים שהמערכת יצרה בלבד.',
  gdriveKeyFirst: 'לפני ההפעלה יש לייצא את מפתח ההצפנה: ב־Drive נשמר רק עותק מוצפן, ובלי המפתח אי אפשר לפתוח אותו.',
  gdriveConnected: 'חשבון Google מחובר',
  gdriveNotConnected: 'לא חובר חשבון Google',
  gdriveConnect: 'חיבור חשבון Google',
  gdriveReconnect: 'חיבור מחדש',
  gdriveDisconnect: 'ניתוק החשבון',
  gdriveDisconnected: 'החשבון נותק והיעד כובה',
  gdriveCodeTitle: 'חיבור חשבון Google',
  gdriveStep1: 'בטלפון או במחשב אחר, פתחו את {url}',
  gdriveStep2: 'הקלידו את הקוד',
  gdriveStep3: 'התחברו לחשבון Google ואשרו גישה לתיקיית הגיבוי',
  gdriveWaiting: 'ממתין לאישור…',
  gdriveDone: 'החשבון חובר. אפשר להפעיל את היעד.',
  gdriveDenied: 'האישור נדחה ב־Google. אם לא לחצתם \'ביטול\' - כנראה החשבון לא נוסף כמשתמש בדיקה (ב־Google Auth Platform, במסך Audience, ברשימת Test users).',
  gdriveExpired: 'הקוד פג. יש ללחוץ שוב על חיבור.',
  gdriveEnableAfter: 'אפשר להפעיל אחרי חיבור החשבון',
  gdriveBlockedHint: 'אם Google מציג \'Access blocked\' או \'הגישה חסומה\' - החשבון לא נוסף כמשתמש בדיקה. מוסיפים אותו ב־Google Auth Platform, במסך Audience, ברשימת Test users (Add users).',
  gdriveDiagnose: 'בדיקת חיבור Google',
  gdriveDiagTitle: 'בדיקת חיבור Google',
  gdriveDiagRunning: 'בודק מול Google…',
  gdriveDiagFix: 'מה לעשות:',
  gdriveDiagAgain: 'בדיקה חוזרת',
  gdriveDiagNote: 'הבדיקה לא משנה דבר: לא נוצרת תיקייה ב־Drive ולא נשמר דבר.',
  err_quota_exceeded: 'אין מספיק מקום פנוי ב־Google Drive',
  err_rate_limited: 'Google Drive מגביל כרגע את קצב הבקשות; ננסה שוב',
  err_gdrive_reconnect_required: 'החיבור ל־Google Drive פג או בוטל; יש לחבר מחדש',
  err_gdrive_not_connected: 'לא חובר חשבון Google',
  err_gdrive_client_invalid: 'Google דחה את מזהה הלקוח או הסוד',
  err_gdrive_client_missing: 'חסרים מזהה הלקוח או הסוד',
  err_gdrive_scope_refused: 'Google לא אישר את ההרשאה לתיקיית הגיבוי',
  err_gdrive_token_via_connect: 'האסימון מתקבל רק דרך חיבור החשבון',
  err_gdrive_client_type: 'סוג הלקוח ב־Google שגוי (צריך \'TVs and Limited Input devices\')',
  err_gdrive_client_not_found: 'Google לא מכיר את מזהה הלקוח (נמחק או הועתק חלקית)',
  err_gdrive_consent_not_configured: 'מסך ההסכמה לא הוגדר בפרויקט ב־Google Cloud',
  err_gdrive_api_disabled: 'Google Drive API לא הופעל בפרויקט ב־Google Cloud',
  err_remote_error: 'תשובה לא צפויה מהיעד',
  err_other: 'שגיאה בהעברה',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/backup-offbox').en>('en', 'i18n/backup-offbox', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/backup-offbox').ar>('ar', 'i18n/backup-offbox', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/backup-offbox').ru>('ru', 'i18n/backup-offbox', 'ru');

export type ObtKey = Key;
export type ObtLang = 'he' | 'en' | 'ar' | 'ru';

export function obtLang(): ObtLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<ObtLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const OBT_DEV_MARKED: readonly ObtLang[] = ['ar', 'ru'];

export function obt(key: Key, vars?: Record<string, string | number>, lang: ObtLang = obtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A server error code (`auth_failed`, ...) in words; unknown codes say `err_other`. */
export function obtError(code: string | null | undefined, lang: ObtLang = obtLang()): string {
  const k = `err_${code ?? ''}` as Key;
  return k in he ? obt(k, undefined, lang) : obt('err_other', undefined, lang);
}

/** The export button works only with the typed word AND the ticked acknowledgement. */
export function keyExportReady(typed: string, acked: boolean, busy: boolean): boolean {
  return typed === 'EXPORT' && acked && !busy;
}

export const OBT_KEYS = Object.keys(he) as Key[];
export const OBT_TABLES = TABLES;

registerCatalogue('i18n/backup-offbox', { he, en, ar, ru }, OBT_DEV_MARKED);
