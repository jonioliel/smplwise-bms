/**
 * Strings of the curved-wall tools of the structure tool (owner request 2026-10-08), Hebrew and English. The language
 * follows the document's `lang` (Hebrew unless it starts with "en"), like plan-package.ts.
 *
 * WALLP (2026-10-08): the primary way to draw a curved wall is "קיר מעוגל" - clicking points ON the curve (curve-fit.ts).
 * The bend tool ("כיפוף", C) stays for bending a segment of an existing wall and rounding corners; it is no longer a
 * chip of its own (the wall inspector's button and the C key open it), and the old three-click arc mode is gone.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  modeCurve: 'כיפוף',
  hintCurve: 'גרור את הנקודה שבאמצע קטע של הקיר הנבחר כדי לכופף אותו; לחיצה על פינה מאפשרת לעגל אותה. (C)',
  tipCurve: 'כיפוף (C): כיפוף קטע של קיר קיים ועיגול פינות',
  bendOpen: 'כיפוף ועיגול פינות',
  bendDone: 'סיום כיפוף',
  modeCurved: 'קיר מעוגל',
  hintCurved: 'לחץ נקודות לאורך הקשת והקיר נבנה דרכן. לחיצה כפולה, Enter או "סיום" בונים; לחיצה על הנקודה הראשונה סוגרת חדר עגול; Backspace מבטל נקודה; Esc מבטל.',
  tipCurved: 'קיר מעוגל (R): לוחצים נקודות על הקשת והקיר נבנה דרכן',
  draft: 'קיר מעוגל',
  points: 'נקודות',
  length: 'אורך',
  minRadius: 'רדיוס',
  straightLine: 'ישר',
  finish: 'סיום',
  undoPoint: 'בטל נקודה',
  closeHint: 'לחיצה על הנקודה הראשונה סוגרת',
  pointsWall: 'קיר דרך נקודות',
  pointHandle: 'נקודת קשת',
  addPoint: 'הוסף נקודה',
  removePoint: 'הסר נקודה',
  pointsNote: 'גרירת נקודה מעצבת את הקשת מחדש; נקודה נבחרת נמחקת ב-Delete.',
  segment: 'קטע',
  radius: 'רדיוס (מ׳)',
  straight: 'ישר',
  straighten: 'יישור',
  corner: 'פינה',
  roundCorner: 'עיגול פינה',
  apply: 'החל',
  radiusTooSmall: 'הרדיוס קטן מחצי אורך הקטע',
  cornerCannot: 'אי אפשר לעגל את הפינה ברדיוס הזה',
  segmentHandle: 'אמצע קטע',
  area: 'שטח פנימי',
};
type Key = keyof typeof he;
const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/plan-curves').en>('en', 'i18n/plan-curves', 'en');

export const PLAN_CURVE_STRINGS = { he, en } as const;

function curveLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function curveT(key: Key, lang: 'he' | 'en' = curveLang()): string {
  return PLAN_CURVE_STRINGS[lang][key] ?? he[key];
}

registerCatalogue('i18n/plan-curves', { he, en });
