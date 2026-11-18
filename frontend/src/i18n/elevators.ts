/**
 * CR-INFRA-ELEVATORS: the words of the elevators module (Infrastructure screen, home tiles, Settings › תשתיות › מעליות). Hebrew first; English,
 * Arabic and Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian columns are an
 * INITIAL translation and need a native review (dev-marked). `{n}` placeholders are filled by `elt(key, { n })`. Operator screens never
 * name the home platform; only the settings section says "התשתית".
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'מעליות',
  stateFireService: 'פיקוד כבאים',
  stateFault: 'תקלה',
  stateOutOfService: 'בהשבתה',
  stateActive: 'פעילה',
  stateMovingUp: 'עולה',
  stateMovingDown: 'יורדת',
  stateDoorOpen: 'דלת פתוחה',
  stateWaiting: 'ממתינה',
  stateTravelling: 'בנסיעה',
  kpiTravel: 'בנסיעה',
  summaryTravel: '{n} בנסיעה',
  travelOption: 'הצג נסיעה כשאינה ממתינה וללא תקלה',
  travelOptionHint: 'כשהאפשרות פעילה והמעלית אינה בהמתנה וללא תקלה, השבתה או פיקוד כבאים, מוצג המצב "בנסיעה". ברירת המחדל: כבוי.',
  stateUnknown: 'לא ידוע',
  since: 'מאז {t}',
  stale: 'לא מסונכרן',
  partial: 'חלק מהחיישנים לא זמינים',
  summary: '{n} מעליות',
  summaryFault: '{f} בתקלה',
  summaryFire: '{k} פיקוד כבאים',
  empty: 'אין מעליות',
  loadError: 'לא ניתן לטעון את המעליות',
  roleMovingUp: 'עולה',
  roleMovingDown: 'יורדת',
  roleWaiting: 'ממתינה / עומדת',
  roleFault: 'תקלה',
  roleFireService: 'פיקוד כבאים',
  roleDoorOpen: 'דלת פתוחה',
  roleOutOfService: 'השבתה',
  extras: 'חיישנים נוספים',
  extraLabel: 'שם',
  addExtra: 'הוספת חיישן',
  none: 'ללא',
  missing: 'החיישן לא נמצא בתשתית',
  add: 'הוספת מעלית',
  edit: 'עריכה',
  remove: 'מחיקה',
  removeConfirm: 'למחוק את המעלית {name}?',
  save: 'שמירה',
  cancel: 'ביטול',
  saved: 'נשמר',
  name: 'שם',
  enabled: 'פעילה',
  disabled: 'לא פעילה',
  up: 'למעלה',
  down: 'למטה',
  settingsIntro: 'כל מעלית מקושרת לחיישני מצב (פתוח/סגור) מהתשתית. צריך לפחות חיישן אחד.',
  settingsEmpty: 'עדיין לא הוגדרו מעליות',
  needOne: 'יש לבחור לפחות חיישן אחד',
  permission: 'ניהול מעליות: הגדרה וקישור חיישני מצב',
  // 2.8.0: the designed Infrastructure screen, the home widget and the display settings
  subtitle: 'תשתיות · מצב חי מהחיישנים',
  kpiOk: 'ממתינות או פעילות',
  kpiFault: 'בתקלה',
  kpiOff: 'בהשבתה',
  kpiFire: 'פיקוד כבאים',
  newElevator: 'מעלית חדשה',
  addCard: 'הוספת מעלית וקישור חיישנים',
  editPage: 'עריכת העמוד',
  editDone: 'סיום עריכה',
  last24: '24 שעות אחרונות',
  noHistory: 'אין עדיין היסטוריה',
  historyOpen: 'היסטוריית {name}',
  historyTitle: 'היסטוריה: {name}',
  historyHint: 'לחיצה ארוכה על מעלית פותחת את ההיסטוריה שלה',
  durMin: '{n} דק׳',
  close: 'סגירה',
  agoNow: 'עכשיו',
  agoMin: 'מלפני {n} דק׳',
  agoHour: 'מלפני {n} שע׳',
  agoYesterday: 'מאתמול',
  agoDays: 'מלפני {n} ימים',
  ledDoor: 'דלת',
  sensorsLit: 'חיישנים מקושרים',
  futureRoles: 'עולה / יורדת / דלת פתוחה / קומה',
  futureNone: 'לא מוגדר (אפשר להוסיף בעתיד)',
  displayTitle: 'תצוגה במסך הראשי',
  displayWidget: 'יישומון מעליות',
  shown: 'מוצג',
  hiddenOpt: 'מוסתר',
  displayMode: 'אופן התצוגה',
  modeCombined: 'כרטיס אחד לכל המעליות',
  modeCards: 'כרטיס לכל מעלית',
  modeBoth: 'שניהם',
  defaultSize: 'גודל היישומון (בפריסה הנוכחית)',
  sizeS: 'קטן',
  sizeM: 'בינוני',
  sizeL: 'גדול',
  filter: 'מה מציגים',
  filterAll: 'כל המצבים',
  filterAlerts: 'רק תקלה / השבתה / פיקוד כבאים',
  include: 'מעליות שמוצגות במסך הראשי',
  editHome: 'מיקום וגודל: מצב עריכה במסך הראשי',
  displayAdmin: 'שינוי התצוגה לכל המשתמשים דורש הרשאת הגדרות מערכת',
  noAlerts: 'אין מעלית בתקלה, בהשבתה או בפיקוד כבאים',
  allHidden: 'כל המעליות הוסתרו',
  countOne: 'מעלית אחת',
  personalTitle: 'מעליות: התצוגה שלי',
  personalDefault: 'כמו לכולם',
  // 2.8.0 alert settings (owner decision 2026-10-18: off by default, recipients chosen now)
  alertsTitle: 'התראות מעליות',
  alertsMaster: 'שליחת התראות מעליות',
  alertsOff: 'כבוי: לא נשלחת אף התראה. היסטוריית המצבים ממשיכה להירשם.',
  alertsRule: 'הפעלה שולחת התראה רק על מצב שמתחיל מעכשיו. כיבוי סוגר מיד את ההתראות הפתוחות של אותו מצב.',
  recRoles: 'תפקידים',
  recUsers: 'משתמשים',
  recGroups: 'קבוצות',
  noRecipients: 'לא נבחרו נמענים: אף אחד לא יקבל התראה',
  recipientsCount: '{n} נמענים נבחרו',
  channels: 'ערוצים',
  chInbox: 'מרכז ההתראות (תמיד)',
  chPush: 'התראת דפדפן',
  chApp: 'אפליקציית הטלפון',
  chWhatsapp: 'WhatsApp',
  chNote: 'דוא״ל אינו זמין להתראות מעליות. WhatsApp כבוי כברירת מחדל, והוספתו דורשת גם הרשאת ניהול התראות',
  alertsReadOnly: 'שינוי ההתראות דורש הרשאת הגדרות מערכת',
  search: 'חיפוש',
  ledOn: 'פעיל',
  ledOff: 'כבוי',
  ledNoValue: 'אין נתון',
  ledNa: 'לא מקושר',
  hours: '{n} שע׳',
  lessHour: 'פחות משעה',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/elevators').en>('en', 'i18n/elevators', 'en');

// initial translation - needs a native review (dev-marked)
const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/elevators').ar>('ar', 'i18n/elevators', 'ar');

// initial translation - needs a native review (dev-marked)
const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/elevators').ru>('ru', 'i18n/elevators', 'ru');

export type EltKey = Key;
export type EltLang = 'he' | 'en' | 'ar' | 'ru';

export function eltLang(): EltLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<EltLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const ELT_DEV_MARKED: readonly EltLang[] = ['ar', 'ru'];

export function elt(key: Key, vars?: Record<string, string | number>, lang: EltLang = eltLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const ELT_KEYS = Object.keys(he) as Key[];
export const ELT_TABLES = TABLES;

registerCatalogue('i18n/elevators', { he, en, ar, ru }, ELT_DEV_MARKED);
