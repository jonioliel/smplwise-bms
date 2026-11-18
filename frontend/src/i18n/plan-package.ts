/**
 * Strings of the plan package and DXF export (T088, ST5), Hebrew and English. The language follows the document's
 * `lang` (Hebrew unless it starts with "en"); keys are stable English identifiers like he.ts.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  dxf: 'DXF',
  dxfPicture: 'DXF + תמונה',
  exportPackage: 'חבילה',
  importPackage: 'ייבוא חבילה',
  title: 'ייבוא חבילת תוכנית',
  checking: 'בודק את החבילה…',
  importing: 'מייבא…',
  source: 'מקור',
  draft: 'טיוטה',
  published: 'מפורסם',
  signedHere: 'חתומה במערכת הזו',
  signedForeign: 'חתומה במערכת אחרת',
  trustForeign: 'אני סומך על המקור',
  mode: 'אופן הייבוא',
  replace: 'החלפה',
  merge: 'מיזוג',
  changes: 'שינויים בטיוטה',
  noChanges: 'אין שינויים',
  added: 'נוספו',
  removed: 'הוסרו',
  changed: 'השתנו',
  calibration: 'הכיול משתנה',
  otherDrawing: 'שרטוט אחר: בדוק מיקומים אחרי הייבוא',
  newerApp: 'נוצרה בגרסה חדשה יותר',
  missing: 'חסרים במערכת',
  unplaced: 'לא ממוקמים בקומה',
  itemsAdded: 'יתווספו לספרייה',
  itemsDiffer: 'בספרייה גרסה אחרת',
  issues: 'בעיות לבדיקה',
  importDraft: 'ייבוא לטיוטה',
  cancel: 'ביטול',
  imported: 'החבילה יובאה לטיוטה',
  saved: 'החבילה נשמרה',
  walls: 'קירות',
  openings: 'פתחים',
  labels: 'תוויות',
  objects: 'עצמים',
  connectors: 'מעברים',
  levels: 'מפלסים',
  circuits: 'מעגלים',
  groups: 'קבוצות',
  rooms: 'חדרים',
  cameras: 'מצלמות וישויות',
  switches: 'מפסקים',
  items: 'פריטים מותאמים',
};

type Key = keyof typeof he;

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/plan-package').en>('en', 'i18n/plan-package', 'en');

const PLAN_PACKAGE_STRINGS = { he, en } as const;

export function pkgLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function pkgT(key: Key, lang: 'he' | 'en' = pkgLang()): string {
  return PLAN_PACKAGE_STRINGS[lang][key] ?? he[key];
}

/** The label of a structure collection in the diff, or the raw name for one this table does not know. */
export function pkgCollection(name: string, lang: 'he' | 'en' = pkgLang()): string {
  return name in he ? pkgT(name as Key, lang) : name;
}

registerCatalogue('i18n/plan-package', { he, en });
