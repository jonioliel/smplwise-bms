/**
 * TV-CHIPS-2381: the text of the building-chip order (a board's "מצב הבניין" list) and of the parking / gym chip sources (Settings ›
 * Notice board). Its own table so the parallel notice-board work keeps `i18n/notices.ts` to itself; the same `{var}` rules as `nt`.
 * No platform words (owner rule): the sources are "ישויות" / "entities" of the system, never named after the platform they come from.
 */
import { ntLang } from './notices';
import { fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';

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
  // BOARD-ANSWERS-2400 (owner 04.11, Q16 = A): "הפוך" per picked on / off entity
  invert: 'הפוך',
  invertOne: 'הפוך: {n}',
  invertParking: 'הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס).',
  invertGym: 'הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי.',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/notice-chips').en>('en', 'i18n/notice-chips', 'en');

export type NcKey = Key;
export const NC_KEYS = Object.keys(he) as Key[];
const TABLES: Record<'he' | 'en', Record<Key, string>> = { he, en };

export function nc(key: Key, vars?: Record<string, string | number>, lang: 'he' | 'en' = ntLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/notice-chips', { he, en });
