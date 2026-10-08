/**
 * Strings of the window wall (glass curtain wall) in the Plan Studio panel, Hebrew and English. The language follows
 * the document's `lang` (Hebrew unless it starts with "en"), as i18n/plan-package.ts.
 */
import type { GlassTint, PanelOperation } from '../map/glass-wall';

const he = {
  kind: 'קיר חלונות',
  glazing: 'זיגוג',
  panels: 'לוחות',
  panelWidth: 'רוחב לוח (מ׳)',
  panelCount: 'מספר לוחות',
  panelCountAuto: 'אוטומטי',
  mullion: 'רוחב מליון (מ׳)',
  sill: 'גובה אדן (מ׳)',
  glazedHeight: 'גובה זיגוג (מ׳)',
  glazedHeightAuto: 'עד ראש הקיר',
  tint: 'גוון',
  autoDivide: 'חלוקה שווה',
  autoMin: 'מינימום (מ׳)',
  autoMax: 'מקסימום (מ׳)',
  autoNone: 'אין חלוקה שווה בטווח הזה',
  operable: 'לוחות נפתחים',
  operation: 'פתיחה',
  entity: 'ישות',
  noEntity: 'ללא',
  panel: 'לוח',
  toGlass: 'המר לקיר חלונות',
  toSolid: 'המר לקיר רגיל',
  desktopOnly: 'בדסקטופ בלבד',
  tint_clear: 'שקוף',
  tint_tinted: 'כהה',
  tint_frosted: 'חלבי',
  tint_reflective: 'מחזיר אור',
  op_casement_left: 'ציר שמאל',
  op_casement_right: 'ציר ימין',
  op_tilt: 'נטוי',
  op_sliding: 'הזזה',
  op_awning: 'קיפ',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  kind: 'Window wall',
  glazing: 'Glazing',
  panels: 'panels',
  panelWidth: 'Panel width (m)',
  panelCount: 'Panels',
  panelCountAuto: 'auto',
  mullion: 'Mullion width (m)',
  sill: 'Sill height (m)',
  glazedHeight: 'Glazed height (m)',
  glazedHeightAuto: 'to the head',
  tint: 'Tint',
  autoDivide: 'Equal panels',
  autoMin: 'Min (m)',
  autoMax: 'Max (m)',
  autoNone: 'No equal division fits this range',
  operable: 'Opening panels',
  operation: 'Opens',
  entity: 'Entity',
  noEntity: 'none',
  panel: 'Panel',
  toGlass: 'Convert to window wall',
  toSolid: 'Convert to solid wall',
  desktopOnly: 'Desktop only',
  tint_clear: 'Clear',
  tint_tinted: 'Tinted',
  tint_frosted: 'Frosted',
  tint_reflective: 'Reflective',
  op_casement_left: 'Left hinge',
  op_casement_right: 'Right hinge',
  op_tilt: 'Tilt',
  op_sliding: 'Sliding',
  op_awning: 'Awning',
};

export const PLAN_GLASS_STRINGS = { he, en } as const;

export function glassLang(): 'he' | 'en' {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || '' : '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function glassT(key: Key, lang: 'he' | 'en' = glassLang()): string {
  return PLAN_GLASS_STRINGS[lang][key] ?? he[key];
}

export const tintLabel = (t: GlassTint, lang?: 'he' | 'en'): string => glassT(`tint_${t}` as Key, lang);
export const operationLabel = (o: PanelOperation, lang?: 'he' | 'en'): string => glassT(`op_${o}` as Key, lang);
