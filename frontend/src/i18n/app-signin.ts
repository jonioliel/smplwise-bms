/**
 * The words of the phone app sign-in card (הגדרות › גישה מרחוק › כניסה מהאפליקציה לנייד; api/app-signin.ts). Hebrew first; English follows
 * the document language (a missing key falls back to the Hebrew). `{x}` placeholders are filled by `ast(key, { x })`. No platform names.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
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

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/app-signin').en>('en', 'i18n/app-signin', 'en');

export type AstKey = Key;
const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };

export function astLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function ast(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = astLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const AST_KEYS = Object.keys(he) as Key[];
export const AST_TABLES = TABLES;

registerCatalogue('i18n/app-signin', { he, en });
