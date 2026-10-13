/**
 * CR-038 slice 5a: the strings of Settings › ערוץ ההודעות (`#/system/messaging-accounts`, section 9.9.3) - which linked WhatsApp
 * account sends for which use. A Settings page may name WhatsApp ("וואטסאפ"); the home platform is "תשתית המערכת", never its product
 * name (UI_COPY_RULES). The labels of the uses and the module names come from the server already rendered with the tickets module's
 * configured name (D33), so no text here names that module. Hebrew first; the English column is used when the document language is
 * English (a missing key falls back to the Hebrew). `{name}` placeholders are filled by `wt(key, { name })`.
 */
const he = {
  tab: 'ערוץ ההודעות',
  title: 'ערוץ ההודעות',
  sub: 'מאיזה חשבון וואטסאפ נשלחות ההודעות של כל שימוש',
  keywords: 'וואטסאפ חשבון חשבונות מספר שולח ערוץ הודעות קוד אימות שימושים SMS',
  loading: 'טוען…',
  forbidden: 'אין הרשאה לצפות בחשבונות',
  retry: 'נסו שוב',

  accounts: 'חשבונות וואטסאפ',
  source: 'מרכיב הוואטסאפ של תשתית המערכת',
  refresh: 'רענון',
  refreshed: 'נקרא מחדש',
  noAccounts: 'לא נמצאו חשבונות. אפשר להוסיף חשבון ידני.',
  wsDown: 'אין חיבור לתשתית המערכת - המצבים אינם עדכניים',
  manualTag: 'ידני',
  notInMirror: 'לא נמצא בתשתית',
  usedBy: 'בשימוש: {uses}',
  unused: 'לא בשימוש',
  sends: '{n} מתוך {cap} ב-24 שעות',
  lastSend: 'שליחה אחרונה {time}',
  neverSent: 'לא נשלחו הודעות',

  st_connected: 'מחובר',
  st_disconnected: 'מנותק',
  st_unknown: 'לא ידוע',
  st_missing: 'לא נמצא',

  usesTitle: 'שימושים',
  noUses: 'אין שימושים פעילים',
  none: 'ללא',
  same: 'כמו {use}',
  deptDefault: 'ברירת המחדל',
  deptOwn: 'חשבון משלה',
  installDefault: 'ברירת המחדל להתקנה',
  inheritDefault: 'ברירת המחדל: אותו חשבון',
  deptOf: '{dept}',
  deptsToggle: 'מחלקות ({n})',
  queued: '{n} ממתינות',

  w_shared_module: 'המספר משותף גם ל{module} - קצב שליחה משותף',
  w_shared_outside: 'המספר משמש גם מחוץ למערכת',
  w_required_unmapped: 'לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ',
  w_maybe_same_number: 'ייתכן שזה אותו מספר',
  w_down_disconnected: 'החשבון מנותק',
  w_down_missing: 'החשבון לא נמצא',
  w_down_unknown: 'מצב החשבון לא ידוע',
  sharedChip: 'משותף',

  manualRow: 'הזנה ידנית',
  manualSub: 'כשהחשבון לא נמצא בתשתית',
  manualAdd: 'חשבון ידני',
  manualTitle: 'חשבון ידני',
  manualValue: 'מזהה החשבון',
  manualValueSub: 'מזהה הרשומה או ספרות המספר, כפי שהם בתשתית',
  manualStatus: 'ישות מצב (לא חובה)',
  labelField: 'שם',
  add: 'הוספה',
  cancel: 'ביטול',

  selected: 'החשבון הנבחר',
  selectHint: 'בחרו חשבון מהרשימה',
  sharedOutside: 'משמש גם מחוץ למערכת',
  sharedOutsideSub: 'למשל אינטרקום או טלפון של אדם',
  pacing: 'קצב שליחה',
  pacingSub: 'משותף לכל השימושים של החשבון',
  pacingSummary: '{hour} בשעה · {day} ביממה · מרווח {gap} שניות',
  p_min_gap_s: 'מרווח מזערי (שניות)',
  p_jitter_s: 'תוספת אקראית (שניות)',
  p_per_hour: 'בשעה',
  p_per_day: 'ביממה',
  p_per_recipient_hour: 'לנמען בשעה',
  p_hold_when_down_min: 'המתנה כשמנותק (דקות)',
  remove: 'הסרה',
  removeInUse: 'החשבון בשימוש - בחרו חשבון אחר לשימושים לפני ההסרה',
  testTitle: 'שליחת בדיקה',
  testTarget: 'מספר לבדיקה',
  testSend: 'שליחה',
  testOff: 'שליחת בדיקה תיפתח אחרי אישור בדיקות חיות',
  testQueued: 'הבדיקה נשלחה לתור',

  channels: 'ערוצים',
  ch_whatsapp: 'וואטסאפ',
  ch_whatsapp_sub: 'הערוץ הראשי לספקים ולאנשי קשר',
  ch_email: 'דוא"ל',
  ch_email_sub: 'גיבוי כשהערוץ מנותק',
  ch_inapp: 'באפליקציה',
  ch_inapp_sub: 'משתמשי המערכת',
  ch_sms: 'SMS',
  ch_sms_sub: 'בקרוב',
  cs_active: 'פעיל',
  cs_down: 'מנותק',
  cs_not_configured: 'לא מוגדר',
  cs_idle: 'לא בשימוש',
  cs_soon: 'בקרוב',

  save: 'שמירה',
  discard: 'ביטול שינויים',
  dirty: 'לא נשמר',
  saved: 'נשמר',
  readOnly: 'צפייה בלבד',
  confirmTitle: 'הודעות ממתינות',
  confirmLine: '{n} הודעות ממתינות יישלחו מהחשבון החדש',
  confirmSave: 'שמירה',
  err_manual_equals_discovered: 'המזהה הזה הוא של חשבון שכבר נמצא - בחרו אותו מהרשימה',
  err_manual_value_invalid: 'מזהה לא תקין',
  err_pacing_out_of_range: 'ערך מחוץ לטווח',
  err_pacing_day_below_hour: 'המכסה ביממה קטנה מהמכסה בשעה',
} as const;

const en: Partial<Record<keyof typeof he, string>> = {
  tab: 'Messaging channel',
  title: 'Messaging channel',
  sub: 'Which WhatsApp account sends the messages of each use',
  accounts: 'WhatsApp accounts',
  source: 'The system platform\'s WhatsApp component',
  refresh: 'Refresh',
  st_connected: 'Connected',
  st_disconnected: 'Disconnected',
  st_unknown: 'Unknown',
  st_missing: 'Not found',
  usesTitle: 'Uses',
  none: 'None',
  same: 'Same as {use}',
  deptDefault: 'Default',
  manualAdd: 'Manual account',
  selected: 'Selected account',
  pacing: 'Sending pace',
  channels: 'Channels',
  ch_sms_sub: 'Coming soon',
  cs_soon: 'Coming soon',
  save: 'Save',
  cancel: 'Cancel',
};

export type WaTextKey = keyof typeof he;

function lang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function wt(key: WaTextKey, vars?: Record<string, string | number>): string {
  const raw = (lang() === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const WA_TEXT_KEYS = Object.keys(he) as WaTextKey[];
