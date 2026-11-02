/**
 * The words of the phone app sign-in card (הגדרות › גישה מרחוק › כניסה מהאפליקציה לנייד; api/app-signin.ts). Hebrew first; English follows
 * the document language (a missing key falls back to the Hebrew). `{x}` placeholders are filled by `ast(key, { x })`. No platform names.
 */
const he = {
  title: 'כניסה מהאפליקציה לנייד',
  sub: 'למנהל מערכת. ההפעלה רק מתוך הרשת המקומית; הכיבוי אפשרי מכל מקום ומנתק מיד.',
  refresh: 'כניסה שמורה באפליקציה',
  refreshHint: 'האפליקציה נשארת מחוברת בלי סיסמה בכל פתיחה. כיבוי מסיים מיד את הכניסה השמורה בכל הטלפונים.',
  exchange: 'חיבור מסך האפליקציה',
  exchangeHint: 'מסך האפליקציה נפתח מחובר בעזרת קוד חד־פעמי, בלי בקשת סיסמה. דורש כניסה שמורה פעילה.',
  off: 'כבוי',
  on: 'פעיל',
  localOnly: 'את ההפעלה עושים רק מתוך הרשת המקומית',
  needsRefresh: 'קודם מפעילים את הכניסה השמורה באפליקציה',
  accessTooLong: 'כשחיבור מסך האפליקציה פעיל, תוקף אסימון הגישה עד {max} דקות (כעת {n}). יש לקצר אותו קודם.',
  save: 'שמור',
  saved: 'ההגדרות נשמרו',
  savedEnded: 'ההגדרות נשמרו · {n} כניסות שמורות הסתיימו',
  confirmTitle: 'לשמור ולנתק?',
  confirmRefresh: 'הכניסה השמורה בכל הטלפונים תסתיים עכשיו. כל משתמש יתבקש להיכנס שוב באפליקציה.',
  confirmExchange: 'מסכי האפליקציה שנפתחו בחיבור הזה ינותקו עכשיו.',
  confirmGo: 'שמור ונתק',
  cancel: 'ביטול',
  loadError: 'הגדרות הכניסה מהאפליקציה לא נטענו',
  demo: 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  title: 'Sign-in from the phone app',
  sub: 'For a system administrator. Switching on works from the local network only; switching off works anywhere and disconnects at once.',
  refresh: 'Saved sign-in in the app', refreshHint: 'The app stays signed in without a password every time it opens. Switching it off ends the saved sign-in on every phone at once.',
  exchange: 'App screen sign-in', exchangeHint: 'The app screen opens signed in with a one-time code, without asking for a password. Needs the saved sign-in on.',
  off: 'Off', on: 'On', localOnly: 'Switching on is done from the local network only', needsRefresh: 'Switch the saved sign-in on first',
  accessTooLong: 'While the app screen sign-in is on, the access token lasts at most {max} minutes (now {n}). Shorten it first.',
  save: 'Save', saved: 'Settings saved', savedEnded: 'Settings saved · {n} saved sign-ins ended', confirmTitle: 'Save and disconnect?',
  confirmRefresh: 'The saved sign-in on every phone ends now. Every user will be asked to sign in again in the app.',
  confirmExchange: 'The app screens opened by this sign-in are disconnected now.', confirmGo: 'Save and disconnect', cancel: 'Cancel',
  loadError: 'The phone app sign-in settings could not be loaded', demo: 'Demo data: the settings are saved against a server only.',
};

export type AstKey = Key;
const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

export function astLang(): 'he' | 'en' {
  const l = typeof document !== 'undefined' ? (document.documentElement.lang || '').toLowerCase() : '';
  return l.startsWith('en') ? 'en' : 'he';
}

export function ast(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = astLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export const AST_KEYS = Object.keys(he) as Key[];
export const AST_TABLES = TABLES;
