/**
 * Strings of the glass wall (glass curtain wall, kind "glass") in the Plan Studio panel, Hebrew and English. The language
 * follows the document's `lang` (Hebrew unless it starts with "en"), as i18n/plan-package.ts.
 *
 * WALLP (owner request 2026-10-08): the kind is called "קיר זכוכית" everywhere (it was "קיר חלונות", which the owner did
 * not find); "קיר מסך" (curtain wall) is its alias in the drawing chip's tooltip and accessible name.
 */
import type { GlassTint, PanelOperation } from '../map/glass-wall';
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  kind: 'קיר זכוכית',
  alias: 'קיר מסך',
  tool: 'קיר זכוכית',
  toolTip: 'קיר זכוכית / קיר מסך (G): מציירים קיר שכולו זיגוג, ישר או מעוגל',
  toolHint: 'לחץ נקודה אחר נקודה כמו בקיר רגיל: נוצר קיר זכוכית עם לוחות ומליונים. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, Esc מבטל.',
  toolHintCurved: 'לחץ נקודות לאורך הקשת: נוצר קיר זכוכית מעוגל דרכן. לחיצה כפולה, Enter או "סיום" בונים, Esc מבטל.',
  shape: 'צורה',
  shapeStraight: 'ישר',
  shapeCurved: 'מעוגל',
  frameDepth: 'עומק מסגרת (מ׳)',
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
  toGlass: 'המר לקיר זכוכית',
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

const en: Record<Key, string> = packTable<typeof import('./lang/en/i18n/plan-glass').en>('en', 'i18n/plan-glass', 'en');

export const PLAN_GLASS_STRINGS = { he, en } as const;

function glassLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function glassT(key: Key, lang: 'he' | 'en' = glassLang()): string {
  return PLAN_GLASS_STRINGS[lang][key] ?? he[key];
}

export const tintLabel = (t: GlassTint, lang?: 'he' | 'en'): string => glassT(`tint_${t}` as Key, lang);
export const operationLabel = (o: PanelOperation, lang?: 'he' | 'en'): string => glassT(`op_${o}` as Key, lang);

registerCatalogue('i18n/plan-glass', { he, en });
