// CR-040 (WXROT): the strings of Settings › בקרת כניסה › "מפתח הגשר". Hebrew is the product language; the English column is used when the
// document language is English (a key missing there falls back to the Hebrew). A Settings page may name the bridge; no key, salt or
// signature is ever shown, and the request id appears only shortened, as a reference for the log.
const he = {
  segment: 'מפתח הגשר',
  title: 'מפתח האמון של הגשר',
  sub: 'המפתח שחותם על כל פעולה בין Arx לגשר. החלפה מעבירה את שניהם יחד, בבת אחת, לדור הבא.',
  epoch: 'דור המפתח הנוכחי',
  epochValue: 'דור {n}',
  bridge: 'הגשר',
  bridgeOk: 'גרסה {v} · תומך בהחלפת מפתח',
  bridgeOld: 'נדרש עדכון של רכיב החיבור לגרסה {req} לפחות',
  bridgeOldSeen: 'מותקנת גרסה {v}; נדרשת {req} לפחות',
  bridgeNoCapability: 'הגשר עוד לא דיווח שהוא תומך בהחלפת מפתח',
  notPaired: 'הגשר לא צומד עדיין',
  noHa: 'אין גישה לתשתית המערכת',
  seen: 'אישור אחרון מהגשר',
  seenValue: 'דור {n} · {when}',
  seenNever: 'עוד לא התקבל דיווח מהגשר',
  seenMismatch: 'הגשר דיווח על דור {n}',
  rotate: 'החלפת מפתח…',
  inProgress: 'החלפה פתוחה מחכה לבירור',
  // the open request
  openUnknown: 'לא ידוע אם המפתח הוחלף. פעולות דרך הגשר מושהות עד שבדיקת המצב תברר זאת; הבקשה לא תישלח שוב.',
  openRunning: 'ההחלפה בתהליך. פעולות דרך הגשר מושהות לרגע.',
  openNeither: 'הגשר אינו מקבל אף אחד מהמפתחות. נדרש צימוד מחדש (הגדרות › חיבורים).',
  check: 'בדיקת מצב',
  checking: 'בודק…',
  // the confirmation
  confirmTitle: 'החלפת מפתח הגשר',
  confirmSwitch: 'Arx והגשר יעברו יחד, בבת אחת, למפתח חדש ולדור {next}. אין רגע שבו שני מפתחות תקפים.',
  confirmPause: 'בשניות ההחלפה פעולות דרך הגשר אינן נשלחות. פעולה שנדחתה לא תישלח שוב מעצמה.',
  confirmUnknown: 'אם תשובת הגשר לא תגיע, התוצאה תסומן "לא ידוע" ותבורר מול הגשר. ההחלפה לא תישלח שוב.',
  confirmRepair: 'החלפה אינה צימוד מחדש. בחשד לדליפת מפתח יש לצמד מחדש.',
  confirmAck: 'הבנתי',
  confirmGo: 'החלפת המפתח',
  cancel: 'ביטול',
  working: 'מחליף…',
  // the results
  results: 'תוצאות',
  resultsSub: '{n} אחרונות',
  none: 'עדיין לא הוחלף מפתח',
  stRotated: 'הוחלף',
  stNotRotated: 'לא הוחלף',
  stUnknown: 'לא ידוע',
  stRunning: 'בתהליך',
  stSuperseded: 'הוחלף בצימוד מחדש',
  rowLine: '{when} · {who} · מדור {from} לדור {to}',
  ref: 'בקשה {id}',
  checks: '{n} בדיקות מצב',
  // why (the code, in words)
  c_rotated: 'הגשר אישר',
  c_status_applied: 'בדיקת המצב אישרה',
  c_not_sent: 'הבקשה לא יצאה',
  c_bridge_outdated: 'רכיב החיבור ישן',
  c_ha_forbidden: 'תשתית המערכת דחתה',
  c_refused: 'הגשר דחה',
  c_epoch_mismatch: 'הגשר בדור אחר',
  c_storage_unavailable: 'הגשר לא הצליח לשמור',
  c_fenced: 'בדיקת המצב: לא הוחל',
  c_reverted_on_bridge: 'הגשר חזר למפתח הקודם',
  c_transport: 'לא התקבלה תשובה',
  c_bridge_error: 'שגיאה בתשתית המערכת',
  c_invalid_response: 'תשובה לא תקינה',
  c_interrupted: 'Arx הופעל מחדש באמצע',
  c_status_unreachable: 'בדיקת המצב לא הגיעה',
  c_status_transport: 'בדיקת המצב לא נענתה',
  c_status_refused: 'הגשר דחה את בדיקת המצב',
  c_neither_key: 'הגשר אינו מקבל אף מפתח',
  c_inconsistent: 'תשובה סותרת',
  c_repaired: 'צימוד מחדש',
  // states of the segment
  loadFailed: 'מצב המפתח לא נטען',
  forbidden: 'החלפת מפתח הגשר אינה זמינה לך',
  localOnly: 'זמין רק מהרשת המקומית',
  retry: 'נסה שוב',
};

export type TtKey = keyof typeof he;

const en: Partial<Record<TtKey, string>> = {
  segment: 'Bridge key',
  title: 'Bridge trust key',
  epoch: 'Current key generation',
  epochValue: 'Generation {n}',
  rotate: 'Rotate key…',
  check: 'Check status',
  confirmTitle: 'Rotate the bridge key',
  confirmAck: 'I understand',
  confirmGo: 'Rotate the key',
  cancel: 'Cancel',
  results: 'Results',
  none: 'No key has been rotated yet',
  stRotated: 'Rotated',
  stNotRotated: 'Not rotated',
  stUnknown: 'Unknown',
  stRunning: 'In progress',
  stSuperseded: 'Replaced by a re-pair',
  retry: 'Retry',
};

export function ttLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function tt(key: TtKey, vars?: Record<string, string | number>): string {
  const raw = (ttLang() === 'en' ? en[key] : undefined) ?? he[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** A run-time key (`c_<code>`), or the fallback when there is none. */
export function ttDynamic(key: string, fallback: TtKey, vars?: Record<string, string | number>): string {
  return key in he ? tt(key as TtKey, vars) : tt(fallback, vars);
}

export const BRIDGE_TRUST_HE = he;
