/**
 * CAMERA-REBOOT-2407: the words of "הפעלה מחדש של מצלמה" in the camera's settings (live camera screen). Hebrew first; the English
 * column follows the document language (a missing key falls back to the Hebrew; a unit test holds the parity). No permission
 * name, error code or device path on the face.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
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

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/camera-reboot').en>('en', 'i18n/camera-reboot', 'en');

export type CrKey = Key;
type CrLang = 'he' | 'en';

function crLang(): CrLang {
  return docLang(['en']);
}

const TABLES: Record<CrLang, Record<Key, string>> = { he, en };

export function crt(key: Key, vars?: Record<string, string | number>, lang: CrLang = crLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const CR_KEYS = Object.keys(he) as Key[];
export const CR_TABLES = TABLES;

registerCatalogue('i18n/camera-reboot', { he, en });
