/**
 * XSCENARIO109-295: the words of cross-module scenarios ("תרחישים"), shown as a block family inside the automations area (owner Q1 = 276 b) and
 * in Settings › Automations. Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew).
 * Operator wording never names the home platform, YAML or an "engine". `{n}` placeholders are filled by `sct(key, { n })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  tab: 'תרחישים',
  title: 'תרחישים חוצי מודולים',
  new: 'תרחיש חדש',
  empty: 'אין עדיין תרחישים',
  disabled: 'התרחישים כבויים',
  noPermission: 'אין הרשאה לצפות בתרחישים',
  loadError: 'לא ניתן לטעון את התרחישים',
  retry: 'נסו שוב',
  settingsLink: 'הגדרות התרחישים',
  killOn: 'עצירת חירום פעילה: אף פעולה לא מתבצעת',
  stateOff: 'כבוי',
  stateOk: 'פעיל',
  stateActive: 'הופעל',
  stateDegraded: 'פגום',
  stateSuppressed: 'נעצר',
  firesToday: '{n} הפעלות היום',
  lastFire: 'הופעל לאחרונה {t}',
  never: 'עוד לא הופעל',
  owner: 'כותב: {n}',
  page: 'עמוד {a} מתוך {b}',
  prev: 'הקודם',
  next: 'הבא',
  name: 'שם',
  description: 'תיאור',
  when: 'כאשר',
  then: 'אז',
  and: 'וגם',
  or: 'או',
  not: 'לא',
  addCondition: 'תנאי',
  addGroup: 'קבוצה',
  remove: 'הסרה',
  signal: 'אות',
  subject: 'נושא',
  value: 'ערך',
  holdFor: 'רציף (שנ׳)',
  debounce: 'יציבות (שנ׳)',
  margin: 'שוליים לשחרור',
  days: 'ימים',
  from: 'מ',
  to: 'עד',
  dayNames: 'ב,ג,ד,ה,ו,ש,א',
  actNotify: 'הודעה',
  actTicket: 'בקשת שירות',
  actFlag: 'סימון',
  recipientsRoles: 'תפקידים',
  recipientsUsers: 'משתמשים',
  recipientsDefault: 'ריק = הנמענים שבהגדרות',
  recipientsPick: 'בחירת נמענים',
  search: 'חיפוש',
  departmentPick: 'בחירת מחלקה',
  department: 'מחלקה',
  ticketTitle: 'כותרת הבקשה',
  flagName: 'שם הסימון',
  flagValue: 'ערך',
  options: 'אפשרויות',
  cooldown: 'המתנה בין הפעלות (שנ׳)',
  clearAfter: 'סיום אחרי (שנ׳)',
  forS: 'משך מינימלי של כל התנאים (שנ׳)',
  onUnknown: 'כשחיישן לא מדווח',
  onUnknownHold: 'להמתין ואז לסמן פגום',
  onUnknownFalse: 'להתייחס כ״לא מתקיים״',
  grace: 'זמן המתנה (שנ׳)',
  maxFires: 'מקסימום הפעלות ביום (ריק = ברירת המחדל)',
  maxTickets: 'מקסימום בקשות ביום (ריק = ברירת המחדל)',
  test: 'הרצה יבשה',
  simulate: 'הדמיה',
  simulateHint: 'ערך לבדיקה',
  save: 'שמירה',
  cancel: 'ביטול',
  enable: 'הפעלה',
  disable: 'כיבוי',
  delete: 'מחיקה',
  confirmDelete: 'למחוק את התרחיש?',
  enableConfirm: 'התרחיש פותח בקשות שירות. לאשר את המחלקה ואת מגבלת {n} בקשות ביום?',
  confirm: 'אישור',
  testFirst: 'יש להריץ הרצה יבשה לפני ההפעלה',
  wouldFire: 'היה מופעל עכשיו',
  wouldNot: 'לא היה מופעל עכשיו',
  unknownResult: 'לא ניתן להעריך עכשיו (חיישן לא מדווח)',
  actionOff: 'הפעולה כבויה בהגדרות',
  ticketsOff: 'מודול בקשות השירות כבוי',
  runs: 'היסטוריה',
  noRuns: 'אין עדיין הרצות',
  redacted: 'אין הרשאה להצגת הנתון',
  saved: 'נשמר',
  enabled: 'התרחיש הופעל',
  disabledNote: 'התרחיש כובה',
  deleted: 'התרחיש נמחק',
  conflict: 'התרחיש השתנה בינתיים. רעננו ונסו שוב.',
  hintHaOnly: 'כלל שמבוסס רק על התקנים מתאים לאוטומציה רגילה או לתבנית.',
  doorWall: 'תרחיש אינו מפעיל דלתות, מנעולים, אזעקות או התקנים.',
  tru: 'מתקיים',
  fls: 'לא מתקיים',
  unk: 'לא ידוע',
  // Settings
  setTitle: 'תרחישים חוצי מודולים',
  setEnabled: 'הפעלת התרחישים',
  setKill: 'עצירת חירום של כל הפעולות',
  setActNotify: 'פעולת הודעה',
  setActTicket: 'פעולת בקשת שירות',
  setActFlag: 'פעולת סימון',
  setMaxFires: 'הפעלות ביום לכל תרחיש (ברירת מחדל)',
  setMaxTickets: 'בקשות שירות ביום לכל תרחיש (ברירת מחדל)',
  setMaxHour: 'פעולות לשעה בכל המערכת',
  setMaxRules: 'מספר תרחישים מרבי',
  setTick: 'בדיקה כל (שנ׳)',
  setTestPerMin: 'הרצות יבשות לדקה',
  setKeep: 'שמירת היסטוריה (ימים)',
  setDegraded: 'הודעה כשתרחיש לא ניתן להעריך',
  setAfterSource: 'מקור שעות הפעילות',
  setAfterWindow: 'חלון קבוע',
  setAfterCalendar: 'לוח העבודה של בקשות השירות',
  setWindow: 'שעות פעילות',
  setRecipients: 'נמענים כברירת מחדל',
  setSave: 'שמירת ההגדרות',
  setSaved: 'ההגדרות נשמרו',
  setInvalid: 'ערך לא תקין',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/scenarios').en>('en', 'i18n/scenarios', 'en');

export type SctKey = Key;
export type SctLang = 'he' | 'en';

export function sctLang(): SctLang {
  return docLang(['en']);
}

const TABLES: Record<SctLang, Partial<Record<Key, string>>> = { he, en };

export function sct(key: Key, vars?: Record<string, string | number>, lang: SctLang = sctLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const SCT_KEYS = Object.keys(he) as Key[];
export const SCT_TABLES = TABLES;

registerCatalogue('i18n/scenarios', { he, en });
