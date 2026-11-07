/**
 * CAMERA-REBOOT-2407: the words of "הפעלה מחדש של מצלמה" in the camera's settings (live camera screen). Hebrew first; the English
 * column follows the document language (a missing key falls back to the Hebrew; a unit test holds the parity). No permission
 * name, error code or device path on the face.
 */
const he = {
  section: 'הפעלה מחדש של המצלמה',
  button: 'הפעל מחדש את המצלמה…',
  lead: 'המצלמה תופעל מחדש דרך ה־NVR. במשך דקה–שתיים אין ממנה וידאו חי ואין הקלטה.',
  dialogTitle: 'הפעלה מחדש של המצלמה',
  dialogSub: '{name} · ערוץ {channel}',
  dialogText: 'המצלמה תתנתק לדקה–שתיים: אין וידאו חי ואין הקלטה של המצלמה הזו עד שתחזור. שאר המצלמות וה־NVR ממשיכים לעבוד. הפעולה נרשמת ביומן.',
  confirm: 'הפעל מחדש',
  cancel: 'ביטול',
  sending: 'שולח…',
  done: 'פקודת ההפעלה מחדש נשלחה. המצלמה תחזור בעוד דקה–שתיים.',
  reasonNotSupported: 'ה־NVR הזה אינו מאפשר הפעלה מחדש של מצלמה מכאן.',
  reasonNoPermission: 'אין לך הרשאה להפעיל מחדש מצלמות. מנהל המערכת יכול להעניק אותה.',
  reasonWritesOff: 'שינויים ב־NVR כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.',
  reasonCooldown: 'המצלמה הופעלה מחדש לפני רגע. אפשר לנסות שוב בעוד {min} דק׳.',
  errorRateLimited: 'יותר מדי הפעלות מחדש ברצף. נסו שוב בעוד כמה דקות.',
  errorRejected: 'ה־NVR דחה את הפקודה. המצלמה לא הופעלה מחדש.',
  errorUnavailable: 'ה־NVR אינו זמין כרגע. המצלמה לא הופעלה מחדש.',
  errorForbidden: 'אין הרשאה לפעולה הזו.',
  errorGeneric: 'הפעולה נכשלה. המצלמה לא הופעלה מחדש.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  section: 'Restart camera',
  button: 'Restart camera…',
  lead: 'The camera restarts through the NVR. For a minute or two it has no live video and no recording.',
  dialogTitle: 'Restart this camera',
  dialogSub: '{name} · channel {channel}',
  dialogText: 'The camera goes offline for a minute or two: no live video and no recording from this camera until it is back. The other cameras and the NVR keep working. The action is logged.',
  confirm: 'Restart',
  cancel: 'Cancel',
  sending: 'Sending…',
  done: 'Restart command sent. The camera will be back in a minute or two.',
  reasonNotSupported: 'This NVR does not allow restarting a camera from here.',
  reasonNoPermission: 'You do not have permission to restart cameras. A system administrator can grant it.',
  reasonWritesOff: 'NVR changes are turned off. They can be turned on in the NVR connection settings.',
  reasonCooldown: 'The camera was just restarted. Try again in {min} min.',
  errorRateLimited: 'Too many restarts in a row. Try again in a few minutes.',
  errorRejected: 'The NVR refused the command. The camera was not restarted.',
  errorUnavailable: 'The NVR is not reachable right now. The camera was not restarted.',
  errorForbidden: 'You are not allowed to do this.',
  errorGeneric: 'The action failed. The camera was not restarted.',
};

export type CrKey = Key;
export type CrLang = 'he' | 'en';

export function crLang(): CrLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

const TABLES: Record<CrLang, Record<Key, string>> = { he, en };

export function crt(key: Key, vars?: Record<string, string | number>, lang: CrLang = crLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const CR_KEYS = Object.keys(he) as Key[];
export const CR_TABLES = TABLES;
