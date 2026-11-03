/**
 * TV-CHIPS-2381: the text of the building-chip order (a board's "מצב הבניין" list) and of the parking / gym chip sources (Settings ›
 * Notice board). Its own table so the parallel notice-board work keeps `i18n/notices.ts` to itself; the same `{var}` rules as `nt`.
 * No platform words (owner rule): the sources are "ישויות" / "entities" of the system, never named after the platform they come from.
 */
import { ntLang } from './notices';

const he = {
  orderHint: 'הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.',
  moveUp: 'הזזה למעלה: {k}',
  moveDown: 'הזזה למטה: {k}',
  noSource: 'אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.',
  sourcesTitle: 'מקורות לסמלי החניה וחדר הכושר',
  sourcesHint: 'הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.',
  parkingLabel: 'חניה',
  parkingHint: 'מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.',
  gymLabel: 'חדר כושר',
  gymHint: 'מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.',
  pick: 'בחירת ישות',
  add: 'הוספה',
  remove: 'הסרה',
  removeOne: 'הסרה: {n}',
  none: 'לא נבחרה ישות',
  noCandidates: 'אין ישויות מתאימות',
  max: 'עד {n} ישויות',
  gone: 'לא נמצאה',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  orderHint: 'The order of this list is the order of the chips on the board and their priority: when the row has no room, a healthy chip lower in the list is hidden first. A fault stays to the end.',
  moveUp: 'Move up: {k}',
  moveDown: 'Move down: {k}',
  noSource: 'No source, the chip is not shown. Pick a source in the notice-board settings.',
  sourcesTitle: 'Sources of the parking and gym chips',
  sourcesHint: 'The chip shows the state only (a word and a colour), never the entity name. With no entity picked the chip is not shown.',
  parkingLabel: 'Parking',
  parkingHint: 'A number = free spaces (summed over the entities). An occupied / free sensor = one space (on = taken). A list = its option as written.',
  gymLabel: 'Gym',
  gymHint: 'A switch or a schedule: on = open, off = closed. An occupancy sensor: in use / free, never a number of people. A list = its option as written.',
  pick: 'Pick an entity',
  add: 'Add',
  remove: 'Remove',
  removeOne: 'Remove: {n}',
  none: 'No entity picked',
  noCandidates: 'No suitable entities',
  max: 'Up to {n} entities',
  gone: 'Not found',
};

export type NcKey = Key;
export const NC_KEYS = Object.keys(he) as Key[];
const TABLES: Record<'he' | 'en', Record<Key, string>> = { he, en };

export function nc(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = ntLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
