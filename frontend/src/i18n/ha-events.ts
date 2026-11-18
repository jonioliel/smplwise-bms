/**
 * NVRLESS-295: the words of the sensor events list (הרשימה שמחליפה את מרכז האירועים כשאין NVR: דלתות, תנועה ומנעולים מהחיישנים). Hebrew first;
 * English, Arabic and Russian columns follow the document language (a missing key falls back to the Hebrew). The Arabic and Russian
 * columns are an INITIAL translation and need a native review (dev-marked). `{n}` placeholders are filled by `hev(key, { n })`.
 * Operator screens never name the home platform: the events are "sensor events".
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'אירועי חיישנים',
  subtitle: 'דלתות, תנועה ומנעולים מהחיישנים · לקריאה בלבד · אזור זמן {tz}',
  readOnly: 'לקריאה בלבד',
  search: 'חיפוש חופשי (שם חיישן, פרטי אירוע)',
  searchLabel: 'חיפוש חופשי',
  type: 'סוג',
  typeAll: 'כל סוגי האירועים',
  typeDoor: 'דלת / מנעול',
  typeMotion: 'תנועה',
  typeOther: 'אחר (אזעקה)',
  area: 'אזור',
  areaAll: 'כל האזורים',
  areaFloor: '{floor}',
  areaZone: '{floor} › {zone}',
  rangeLabel: 'טווח ימים',
  range1: 'יום',
  range7: '7 ימים',
  range30: '30 יום',
  dateLabel: 'תאריך',
  colEvent: 'אירוע',
  colSensor: 'חיישן',
  colArea: 'אזור',
  colTime: 'זמן',
  colSeverity: 'חומרה',
  sevInfo: 'מידע',
  sevAlert: 'התראה',
  sevCritical: 'קריטי',
  summary: '{n} אירועים · {a} התראות · {s} חיישנים',
  live: 'עדכונים חיים: פעיל',
  liveConnecting: 'עדכונים חיים: מתחבר…',
  noArea: 'לא ממוקם בתוכנית',
  opened: 'נפתח',
  closed: 'נסגר',
  locked: 'ננעל',
  unlocked: 'המנעול נפתח',
  motionStart: 'זוהתה תנועה',
  motionEnd: 'התנועה הסתיימה',
  unavailable: 'החיישן אינו זמין',
  restored: 'החיישן חזר לפעול',
  alarmChanged: 'מצב האזעקה: {to}',
  stateChange: 'מצב: {from} ← {to}',
  repeats: '{n} חזרות',
  drawerSensor: 'חיישן',
  drawerEvent: 'אירוע',
  drawerArea: 'אזור',
  drawerTime: 'זמן',
  drawerFrom: 'מצב קודם',
  drawerTo: 'מצב חדש',
  drawerCertainty: 'ודאות',
  drawerMeasured: 'נמדד על ידי החיישן',
  drawerSource: 'מקור',
  drawerSourceValue: 'חיישן התקן (מעבר מצב)',
  drawerNoClip: 'אין הקלטה או תמונה לאירוע: ההתקנה פועלת בלי מצלמות מקושרות.',
  close: 'סגור',
  emptyTitle: 'אין אירועי חיישנים בטווח הזה',
  emptyHint: 'אירוע נרשם כשדלת, חיישן תנועה או מנעול משנים מצב.',
  emptyFiltered: 'אין אירועים שמתאימים למסננים',
  emptyFilteredHint: 'שנו את הטווח, את האזור או את הסוג.',
  clearFilters: 'נקה מסננים',
  loadError: 'לא ניתן לטעון את האירועים',
  retry: 'נסה שוב',
  unsupported: 'המסנן אינו נתמך כאן, לא "אין תוצאות": {why}',
  truncated: 'מוצגים {n} האירועים האחרונים; צמצמו את הטווח כדי לראות את השאר.',
  stateOn: 'פעיל',
  stateOff: 'כבוי',
};

type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/ha-events').en>('en', 'i18n/ha-events', 'en');

const ar: Partial<Record<Key, string>> = packTable<typeof import('./lang/ar/i18n/ha-events').ar>('ar', 'i18n/ha-events', 'ar');

const ru: Partial<Record<Key, string>> = packTable<typeof import('./lang/ru/i18n/ha-events').ru>('ru', 'i18n/ha-events', 'ru');

export type HevKey = Key;
export type HevLang = 'he' | 'en' | 'ar' | 'ru';

export function hevLang(): HevLang {
  return docLang(['en', 'ar', 'ru']);
}

const TABLES: Record<HevLang, Partial<Record<Key, string>>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const HEV_DEV_MARKED: readonly HevLang[] = ['ar', 'ru'];

export function hev(key: Key, vars?: Record<string, string | number>, lang: HevLang = hevLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

export const HEV_KEYS = Object.keys(he) as Key[];
export const HEV_TABLES = TABLES;

registerCatalogue('i18n/ha-events', { he, en, ar, ru }, HEV_DEV_MARKED);
