/**
 * CAMHEALTH091: the words of camera image health - the compact card on בריאות מצלמות and the settings card in הגדרות › בריאות ועבודות.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew). `{n}` placeholders are
 * filled by `cit(key, { n })`.
 */
const he = {
  title: 'תמונת המצלמות',
  off: 'כבוי',
  ok: 'תקינות',
  unknown: 'לא נבדקו',
  excluded: 'מוחרגות',
  dark: 'חשוכה',
  blurred: 'מטושטשת',
  frozen: 'קפואה',
  shifted: 'זזה',
  stateOk: 'תקינה',
  stateUnknown: 'לא נבדקה',
  stateExcluded: 'מוחרגת',
  stateOff: '—',
  checkNow: 'בדוק עכשיו',
  checking: 'בודק…',
  lastCheck: 'נבדק {t}',
  never: 'טרם נבדק',
  every: 'כל {n} דק׳',
  openSettings: 'הגדרות',
  column: 'תמונה',
  refSet: 'קבע כתמונת ייחוס',
  refClear: 'נקה ייחוס',
  refAuto: 'ייחוס אוטומטי',
  refManual: 'ייחוס ידני',
  refNone: 'אין ייחוס',
  reference: 'ייחוס',
  brightness: 'בהירות',
  sharpness: 'חדות',
  // settings card
  settingsTitle: 'בדיקת תמונת המצלמות',
  enabled: 'בדיקה פעילה',
  passiveOnly: 'רק זרמים שכבר מוצגים',
  checks: 'בדיקות',
  checkDark: 'חשוכה',
  checkBlur: 'מטושטשת',
  checkFreeze: 'קפואה',
  checkShift: 'זזה',
  interval_s: 'דגימה כל (שניות)',
  per_pass_max: 'מצלמות בכל סבב',
  dark_level: 'סף חושך (0-255)',
  blur_min: 'סף חדות',
  freeze_diff: 'סף שינוי לקפואה',
  freeze_samples: 'דגימות זהות לקפואה',
  shift_pct: 'תזוזה מרבית (%)',
  shift_corr_min: 'התאמה מזערית לייחוס',
  confirm_samples: 'דגימות רצופות לאישור',
  recover_s: 'זמן עד סגירת התראה (שניות)',
  excludedCams: 'מצלמות מוחרגות',
  recipients: 'מקבלי ההתראה',
  recipientsUsers: 'משתמשים נבחרים',
  save: 'שמירה',
  saved: 'נשמר',
  loading: 'קורא…',
} as const;

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Camera picture',
  off: 'Off',
  ok: 'OK',
  unknown: 'Not checked',
  excluded: 'Excluded',
  dark: 'Dark',
  blurred: 'Blurred',
  frozen: 'Frozen',
  shifted: 'Shifted',
  stateOk: 'OK',
  stateUnknown: 'Not checked',
  stateExcluded: 'Excluded',
  checkNow: 'Check now',
  checking: 'Checking…',
  lastCheck: 'Checked {t}',
  never: 'Not checked yet',
  every: 'Every {n} min',
  openSettings: 'Settings',
  column: 'Picture',
  refSet: 'Use as reference',
  refClear: 'Clear reference',
  refAuto: 'Automatic reference',
  refManual: 'Manual reference',
  refNone: 'No reference',
  reference: 'Reference',
  brightness: 'Brightness',
  sharpness: 'Sharpness',
  settingsTitle: 'Camera picture check',
  enabled: 'Check on',
  passiveOnly: 'Only streams already playing',
  checks: 'Checks',
  checkDark: 'Dark',
  checkBlur: 'Blurred',
  checkFreeze: 'Frozen',
  checkShift: 'Shifted',
  interval_s: 'Sample every (s)',
  per_pass_max: 'Cameras per pass',
  dark_level: 'Dark level (0-255)',
  blur_min: 'Sharpness threshold',
  freeze_diff: 'Freeze change threshold',
  freeze_samples: 'Identical samples for frozen',
  shift_pct: 'Largest move (%)',
  shift_corr_min: 'Least reference match',
  confirm_samples: 'Samples in a row to confirm',
  recover_s: 'Time until the alert closes (s)',
  excludedCams: 'Excluded cameras',
  recipients: 'Alert recipients',
  recipientsUsers: 'Selected users',
  save: 'Save',
  saved: 'Saved',
  loading: 'Loading…',
};

export type CitKey = Key;
const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

export function cit(key: Key, vars?: Record<string, string | number>): string {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  const raw = TABLES[l.startsWith('en') ? 'en' : 'he'][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const CIT_KEYS = Object.keys(he) as Key[];
export const CIT_TABLES = TABLES;
