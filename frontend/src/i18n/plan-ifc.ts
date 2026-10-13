/**
 * Strings of the IFC export / import (Plan Studio 8, CR-037), Hebrew and English, in the pattern of plan-package.ts:
 * the language follows the document's `lang` (Hebrew unless it starts with "en"). Pure (no DOM beyond the lang
 * lookup), so the summary builders run in node (tests/unit-plan-ifc.spec.ts).
 */
import type { IfcImportReport } from '../api/geometry';

const he = {
  ifc: 'IFC',
  importIfc: 'ייבוא IFC',
  origin: 'מיובאים מ־IFC',
  reading: 'קורא את קובץ ה־IFC…',
  loaded: 'המועמדים מהקובץ מוצגים לאישור',
  nothing: 'לא נמצא בקובץ מה לייבא לקומה הזו',
  read: 'נקראו',
  skipped: 'דולגו',
  storey: 'קומה בקובץ',
  storeys: 'קומות בקובץ',
  moved: 'המודל הוזז לראשית התוכנית',
  tooBig: 'המודל גדול מהתוכנית',
  walls: 'קירות',
  openings: 'פתחים',
  objects: 'עצמים',
  rooms: 'חדרים',
  more: 'ועוד',
  // skip reasons (plan_ifc_read): short, for the list
  r_unsupported_class: 'סוג לא נתמך',
  r_no_geometry: 'בלי גאומטריה קריאה',
  r_curved_geometry: 'גאומטריה מעוקלת',
  r_tilted_geometry: 'גאומטריה מוטה',
  r_unsupported_geometry: 'גאומטריה לא נתמכת',
  r_unsupported_profile: 'פרופיל לא נתמך',
  r_unsupported_transform: 'טרנספורמציה לא נתמכת',
  r_no_storey: 'לא משויך לקומה',
  r_other_storey: 'קומה אחרת בקובץ',
  r_placement_cycle: 'מיקום מעגלי',
  r_unsupported_placement: 'מיקום לא נתמך',
  r_bad_placement: 'מיקום לא תקין',
  r_bad_number: 'מספר לא תקין',
  r_outside_plan: 'מחוץ לתוכנית',
  r_opening_off_wall: 'פתח רחוק מהקיר',
  r_host_wall_skipped: 'הקיר שלו דולג',
  r_host_not_wall: 'לא בקיר',
  r_unsupported_filling: 'מילוי פתח לא נתמך',
  r_live_device: 'מצלמה / ישות (לא מיובאות)',
  r_connector_not_imported: 'מעבר בין מפלסים (לא מיובא)',
  r_limit: 'מעבר למכסה',
};

type Key = keyof typeof he;

const en: Record<Key, string> = {
  ifc: 'IFC',
  importIfc: 'Import IFC',
  origin: 'imported from IFC',
  reading: 'Reading the IFC file…',
  loaded: 'The file’s candidates are shown for review',
  nothing: 'Nothing in the file to import to this level',
  read: 'Read',
  skipped: 'skipped',
  storey: 'storey in the file',
  storeys: 'storeys in the file',
  moved: 'the model was moved to the plan’s origin',
  tooBig: 'the model is larger than the plan',
  walls: 'walls',
  openings: 'openings',
  objects: 'objects',
  rooms: 'rooms',
  more: 'and',
  r_unsupported_class: 'unsupported class',
  r_no_geometry: 'no readable geometry',
  r_curved_geometry: 'curved geometry',
  r_tilted_geometry: 'tilted geometry',
  r_unsupported_geometry: 'unsupported geometry',
  r_unsupported_profile: 'unsupported profile',
  r_unsupported_transform: 'unsupported transform',
  r_no_storey: 'not in a storey',
  r_other_storey: 'another storey of the file',
  r_placement_cycle: 'cyclic placement',
  r_unsupported_placement: 'unsupported placement',
  r_bad_placement: 'invalid placement',
  r_bad_number: 'invalid number',
  r_outside_plan: 'outside the plan',
  r_opening_off_wall: 'opening away from its wall',
  r_host_wall_skipped: 'its wall was skipped',
  r_host_not_wall: 'not in a wall',
  r_unsupported_filling: 'unsupported opening filling',
  r_live_device: 'camera / entity (never imported)',
  r_connector_not_imported: 'level connector (not imported)',
  r_limit: 'over the limit',
};

export const PLAN_IFC_STRINGS = { he, en } as const;

export function ifcLang(): 'he' | 'en' {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || '' : '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function ifcT(key: Key, lang: 'he' | 'en' = ifcLang()): string {
  return PLAN_IFC_STRINGS[lang][key] ?? he[key];
}

/** A skip reason as a short label (the raw reason for one this table does not know). */
export function ifcReason(reason: string, lang: 'he' | 'en' = ifcLang()): string {
  const key = `r_${reason}` as Key;
  return key in he ? ifcT(key, lang) : reason;
}

/** One line: what was read, what was skipped, the storey chosen, the alignment note. */
export function ifcSummary(r: IfcImportReport, lang: 'he' | 'en' = ifcLang()): string {
  const c = r.counts;
  const parts = (['walls', 'openings', 'rooms', 'objects'] as const).filter((k) => c[k] > 0).map((k) => `${c[k]} ${ifcT(k, lang)}`);
  const out = [`${ifcT('read', lang)} ${parts.length ? parts.join(', ') : '0'}`];
  if (r.skipped_total) out.push(`${ifcT('skipped', lang)} ${r.skipped_total}`);
  const chosen = r.storeys.find((s) => s.chosen);
  if (r.storeys.length > 1 && chosen) out.push(`${chosen.name} (${r.storeys.length} ${ifcT('storeys', lang)})`);
  if (!r.alignment.fits) out.push(`${ifcT('tooBig', lang)} (${r.alignment.needed_m?.[0] ?? '?'} × ${r.alignment.needed_m?.[1] ?? '?'} מ׳)`);
  else if (r.alignment.dx_m || r.alignment.dy_m) out.push(ifcT('moved', lang));
  return out.join(' · ');
}

/** The skipped rows grouped by reason, most frequent first: "label: n" lines, at most `max` of them. */
export function ifcSkippedLines(r: IfcImportReport, max = 8, lang: 'he' | 'en' = ifcLang()): string[] {
  const rows = Object.entries(r.skipped_by_reason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = rows.slice(0, max).map(([reason, n]) => `${ifcReason(reason, lang)}: ${n}`);
  const rest = rows.slice(max).reduce((s, [, n]) => s + n, 0);
  if (rest) lines.push(`${ifcT('more', lang)} ${rest}`);
  return lines;
}
