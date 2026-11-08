/**
 * CAMERA-STREAM-SOURCES-2410: the words of "מקור וידאו" (a camera's video source) and of "מצלמה ללא מקליט". Hebrew first; the English
 * column follows the document language (a missing key falls back to the Hebrew; a unit test holds the parity). No permission name,
 * error code, address or device path on the face.
 */
const he = {
  section: 'מקור וידאו',
  fromNvr: 'מהמקליט',
  manual: 'כתובת ידנית',
  fromNvrLead: 'הווידאו והתמונות מגיעים מהמקליט, כמו היום.',
  manualLead: 'הווידאו והתמונות מגיעים ישירות מהמצלמה, מהכתובות שלמטה.',
  current: 'המקור כעת: {mode}',
  change: 'שנה מקור…',
  dialogTitle: 'מקור וידאו',
  dialogSub: '{name}',
  mainUrl: 'כתובת RTSP — זרם ראשי',
  subUrl: 'כתובת RTSP — זרם משני',
  urlHint: 'אם ממלאים רק כתובת אחת, היא משמשת לשני הזרמים.',
  passwordKept: 'הסיסמה שמורה ומוצגת כ־***. כדי להחליף אותה, הקלידו כתובת מלאה.',
  test: 'בדיקת זרם',
  testing: 'בודק…',
  testOk: 'הזרם תקין · {res}{codec}',
  testEncourage: 'מומלץ לבדוק את הזרם לפני השמירה.',
  save: 'שמור',
  saving: 'שומר…',
  cancel: 'ביטול',
  saved: 'מקור הווידאו נשמר.',
  urlBad: 'הכתובת צריכה להתחיל ב־rtsp:// או ב־rtsps://',
  urlRequired: 'יש להזין לפחות כתובת אחת.',
  healthOk: 'המקור עובד',
  healthFailing: 'המקור הידני אינו עובד כרגע. המצלמה נשארת על המקור הזה; בדקו את הכתובת או את המצלמה.',
  healthUnknown: 'המקור עדיין לא נבדק',
  standaloneNote: 'מצלמה ללא מקליט: וידאו חי ותמונות בלבד.',
  noRecording: 'למצלמה ללא מקליט אין הקלטות, אירועי מקליט או הפעלה מחדש דרך מקליט.',
  noRecorder: 'ללא מקליט',
  addTitle: 'הוספת מצלמה ללא מקליט',
  addButton: 'הוסף מצלמה ללא מקליט',
  addLead: 'מצלמה שאינה מחוברת למקליט: וידאו חי ותמונות ישירות ממנה. אין הקלטות.',
  name: 'שם המצלמה',
  area: 'אזור',
  noArea: 'ללא אזור',
  add: 'הוסף',
  added: 'המצלמה נוספה.',
  listTitle: 'מצלמות ללא מקליט',
  listEmpty: 'אין מצלמות ללא מקליט.',
  remove: 'הסר',
  removeConfirm: 'להסיר את "{name}"? המצלמה תוסר מכל המסכים. לא נשמרות ממנה הקלטות.',
  removed: 'המצלמה הוסרה.',
  edit: 'מקור',
  view: 'צפייה',
  offline: 'המקור הידני של המצלמה אינו עונה.',
  errStale: 'ההגדרות השתנו בינתיים. סגרו ופתחו שוב.',
  errPasswordReenter: 'הכתובת השתנתה: יש להקליד שוב את הסיסמה.',
  errNotAllowed: 'הכתובת הזו אינה מותרת כמקור וידאו.',
  errNotSupported: 'הכתובת אינה כתובת RTSP נתמכת (rtsp:// או rtsps://).',
  errMedia: 'שירות הווידאו לא הוגדר, ולכן אי אפשר לבדוק את הזרם.',
  errRate: 'יותר מדי בדיקות ברצף. נסו שוב בעוד דקה.',
  errForbidden: 'אין לך הרשאה לשנות מקורות וידאו.',
  errLimit: 'הגעתם למספר המרבי של מצלמות ללא מקליט.',
  errName: 'יש להזין שם למצלמה.',
  errGeneric: 'הפעולה נכשלה. נסו שוב.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  section: 'Video source',
  fromNvr: 'From the recorder',
  manual: 'Manual address',
  fromNvrLead: 'Video and snapshots come from the recorder, as today.',
  manualLead: 'Video and snapshots come straight from the camera, from the addresses below.',
  current: 'Current source: {mode}',
  change: 'Change source…',
  dialogTitle: 'Video source',
  dialogSub: '{name}',
  mainUrl: 'RTSP address — main stream',
  subUrl: 'RTSP address — sub stream',
  urlHint: 'If only one address is filled, it serves both streams.',
  passwordKept: 'The password is stored and shown as ***. To replace it, type the full address.',
  test: 'Test stream',
  testing: 'Testing…',
  testOk: 'Stream OK · {res}{codec}',
  testEncourage: 'Testing the stream before saving is recommended.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  saved: 'Video source saved.',
  urlBad: 'The address must start with rtsp:// or rtsps://',
  urlRequired: 'Enter at least one address.',
  healthOk: 'The source works',
  healthFailing: 'The manual source is not working right now. The camera stays on it; check the address or the camera.',
  healthUnknown: 'The source has not been checked yet',
  standaloneNote: 'Camera without a recorder: live video and snapshots only.',
  noRecording: 'A camera without a recorder has no recordings, recorder events or restart through a recorder.',
  noRecorder: 'No recorder',
  addTitle: 'Add a camera without a recorder',
  addButton: 'Add camera without a recorder',
  addLead: 'A camera that is not connected to a recorder: live video and snapshots straight from it. No recordings.',
  name: 'Camera name',
  area: 'Area',
  noArea: 'No area',
  add: 'Add',
  added: 'Camera added.',
  listTitle: 'Cameras without a recorder',
  listEmpty: 'No cameras without a recorder.',
  remove: 'Remove',
  removeConfirm: 'Remove "{name}"? The camera leaves every screen. Nothing of it is recorded.',
  removed: 'Camera removed.',
  edit: 'Source',
  view: 'View',
  offline: 'The manual source of the camera is not answering.',
  errStale: 'The settings changed meanwhile. Close and open again.',
  errPasswordReenter: 'The address changed: type the password again.',
  errNotAllowed: 'This address is not allowed as a video source.',
  errNotSupported: 'The address is not a supported RTSP address (rtsp:// or rtsps://).',
  errMedia: 'The video service is not configured, so the stream cannot be tested.',
  errRate: 'Too many tests in a row. Try again in a minute.',
  errForbidden: 'You are not allowed to change video sources.',
  errLimit: 'The maximum number of cameras without a recorder is reached.',
  errName: 'Enter a name for the camera.',
  errGeneric: 'The action failed. Try again.',
};

export type CsKey = Key;
export type CsLang = 'he' | 'en';

export function csLang(): CsLang {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

const TABLES: Record<CsLang, Record<Key, string>> = { he, en };

export function cst(key: Key, vars?: Record<string, string | number>, lang: CsLang = csLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const CS_KEYS = Object.keys(he) as Key[];
export const CS_TABLES = TABLES;
