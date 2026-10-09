/**
 * Strings of the curved-wall tools of the structure tool (owner request 2026-10-08), Hebrew and English. The language
 * follows the document's `lang` (Hebrew unless it starts with "en"), like plan-package.ts.
 *
 * WALLP (2026-10-08): the primary way to draw a curved wall is "קיר מעוגל" - clicking points ON the curve (curve-fit.ts).
 * The bend tool ("כיפוף", C) stays for bending a segment of an existing wall and rounding corners; it is no longer a
 * chip of its own (the wall inspector's button and the C key open it), and the old three-click arc mode is gone.
 */
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
const en: Record<Key, string> = {
  modeCurve: 'Bend',
  hintCurve: 'Drag the dot in the middle of a segment of the selected wall to bend it; click a corner to round it. (C)',
  tipCurve: 'Bend (C): bend a segment of an existing wall and round corners',
  bendOpen: 'Bend and round corners',
  bendDone: 'Done bending',
  modeCurved: 'Curved wall',
  hintCurved: 'Click points along the curve and the wall is built through them. Double-click, Enter or "Finish" builds it; clicking the first point closes a round room; Backspace removes a point; Esc cancels.',
  tipCurved: 'Curved wall (R): click points on the curve and the wall is built through them',
  draft: 'Curved wall',
  points: 'points',
  length: 'Length',
  minRadius: 'Radius',
  straightLine: 'straight',
  finish: 'Finish',
  undoPoint: 'Remove point',
  closeHint: 'clicking the first point closes it',
  pointsWall: 'Wall through points',
  pointHandle: 'Curve point',
  addPoint: 'Add point',
  removePoint: 'Remove point',
  pointsNote: 'Dragging a point reshapes the curve; Delete removes the selected point.',
  segment: 'Segment',
  radius: 'Radius (m)',
  straight: 'Straight',
  straighten: 'Straighten',
  corner: 'Corner',
  roundCorner: 'Round corner',
  apply: 'Apply',
  radiusTooSmall: 'The radius is shorter than half the segment',
  cornerCannot: 'This corner cannot take that radius',
  segmentHandle: 'Segment middle',
  area: 'Enclosed area',
};

export const PLAN_CURVE_STRINGS = { he, en } as const;

export function curveLang(): 'he' | 'en' {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || '' : '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function curveT(key: Key, lang: 'he' | 'en' = curveLang()): string {
  return PLAN_CURVE_STRINGS[lang][key] ?? he[key];
}
