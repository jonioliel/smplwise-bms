/**
 * CAMHEALTH091: the words of camera image health - the compact card on בריאות מצלמות and the settings card in הגדרות › בריאות ועבודות.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew). `{n}` placeholders are
 * filled by `cit(key, { n })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
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

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/camera-image-health').en>('en', 'i18n/camera-image-health', 'en');

export type CitKey = Key;
const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

export function cit(key: Key, vars?: Record<string, string | number>): string {
  const raw = TABLES[docLang(['en'])][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const CIT_KEYS = Object.keys(he) as Key[];
export const CIT_TABLES = TABLES;

registerCatalogue('i18n/camera-image-health', { he, en });
