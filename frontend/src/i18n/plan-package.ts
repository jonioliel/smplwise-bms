/**
 * Strings of the plan package and DXF export (T088, ST5), Hebrew and English. The language follows the document's
 * `lang` (Hebrew unless it starts with "en"); keys are stable English identifiers like he.ts.
 */
const he = {
  dxf: 'DXF',
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

const en: Record<Key, string> = {
  dxf: 'DXF',
  exportPackage: 'Package',
  importPackage: 'Import package',
  title: 'Import plan package',
  checking: 'Checking the package…',
  importing: 'Importing…',
  source: 'Source',
  draft: 'draft',
  published: 'published',
  signedHere: 'Signed by this system',
  signedForeign: 'Signed by another system',
  trustForeign: 'I trust this source',
  mode: 'Import mode',
  replace: 'Replace',
  merge: 'Merge',
  changes: 'Changes to the draft',
  noChanges: 'No changes',
  added: 'added',
  removed: 'removed',
  changed: 'changed',
  calibration: 'Calibration changes',
  otherDrawing: 'Different drawing: check positions after the import',
  newerApp: 'Made by a newer version',
  missing: 'Missing here',
  unplaced: 'Not placed on this floor',
  itemsAdded: 'Will be added to the library',
  itemsDiffer: 'Library has another version',
  issues: 'Issues to check',
  importDraft: 'Import to draft',
  cancel: 'Cancel',
  imported: 'Package imported to the draft',
  saved: 'Package saved',
  walls: 'Walls',
  openings: 'Openings',
  labels: 'Labels',
  objects: 'Objects',
  connectors: 'Connectors',
  levels: 'Levels',
  circuits: 'Circuits',
  groups: 'Groups',
  rooms: 'Rooms',
  cameras: 'Cameras and entities',
  switches: 'Switches',
  items: 'Custom items',
};

export const PLAN_PACKAGE_STRINGS = { he, en } as const;

export function pkgLang(): 'he' | 'en' {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || '' : '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function pkgT(key: Key, lang: 'he' | 'en' = pkgLang()): string {
  return PLAN_PACKAGE_STRINGS[lang][key] ?? he[key];
}

/** The label of a structure collection in the diff, or the raw name for one this table does not know. */
export function pkgCollection(name: string, lang: 'he' | 'en' = pkgLang()): string {
  return name in he ? pkgT(name as Key, lang) : name;
}
