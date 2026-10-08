/**
 * Strings of the curved-wall tools of the structure tool (owner request 2026-10-08), Hebrew and English. The language
 * follows the document's `lang` (Hebrew unless it starts with "en"), like plan-package.ts.
 */
const he = {
  modeCurve: 'קשת',
  modeArc: 'קיר מעוגל',
  hintCurve: 'בחר קיר וגרור את הנקודה שבאמצע קטע כדי לכופף אותו. לחיצה על פינה מאפשרת לעגל אותה. (C)',
  hintArc: 'לחץ נקודת התחלה, נקודת סיום ואז נקודה על הקשת. Esc מבטל.',
  tipCurve: 'קשת (C): כיפוף קטעי קיר ועיגול פינות',
  segment: 'קטע',
  radius: 'רדיוס (מ׳)',
  straight: 'ישר',
  straighten: 'יישור',
  corner: 'פינה',
  roundCorner: 'עיגול פינה',
  apply: 'החל',
  radiusTooSmall: 'הרדיוס קטן מחצי אורך הקטע',
  cornerCannot: 'אי אפשר לעגל את הפינה ברדיוס הזה',
  arcStart: 'קיר מעוגל: לחץ על נקודת ההתחלה',
  arcEnd: 'קיר מעוגל: לחץ על נקודת הסיום',
  arcThrough: 'קיר מעוגל: לחץ על נקודה על הקשת',
  segmentHandle: 'אמצע קטע',
  area: 'שטח פנימי',
};
type Key = keyof typeof he;
const en: Record<Key, string> = {
  modeCurve: 'Curve',
  modeArc: 'Arc wall',
  hintCurve: 'Select a wall and drag the dot in the middle of a segment to bend it. Click a corner to round it. (C)',
  hintArc: 'Click a start point, an end point, then a point on the arc. Esc cancels.',
  tipCurve: 'Curve (C): bend wall segments and round corners',
  segment: 'Segment',
  radius: 'Radius (m)',
  straight: 'Straight',
  straighten: 'Straighten',
  corner: 'Corner',
  roundCorner: 'Round corner',
  apply: 'Apply',
  radiusTooSmall: 'The radius is shorter than half the segment',
  cornerCannot: 'This corner cannot take that radius',
  arcStart: 'Arc wall: click the start point',
  arcEnd: 'Arc wall: click the end point',
  arcThrough: 'Arc wall: click a point on the arc',
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
