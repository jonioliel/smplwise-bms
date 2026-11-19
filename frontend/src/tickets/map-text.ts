/** TKMAP1 words (the vendor page has its own four languages in public-ticket/strings.ts). Hebrew, the product language, by default;
 * the English column when the document language is English (tickets/text.ts `ticketsLang`). `MAP_TEXT.x` is read at render time, so
 * each property is a getter that picks the language then; module-name tokens (D33) are rendered with the configured name. */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';
import { registerCatalogue } from '../i18n/core';

const he = {
  section: 'רכיב במפה',
  add: 'הוסף רכיב מהמפה',
  replace: 'החלף רכיב',
  remove: 'הסר',
  show: 'הצג במפה',
  vendorPreview: 'מה הספק רואה',
  vendorPreviewHide: 'הסתר תמונה',
  vendorNoImage: 'הספק יראה את התיאור בלבד (אין תמונת מפה).',
  gone: 'הרכיב כבר לא במפה - נשמר התיאור מרגע הצירוף.',
  pickTitle: 'בחירת רכיב מהמפה',
  pickFloor: 'קומה',
  pickHint: 'לחצו על רכיב במפה (מצלמה, התקן או עצם).',
  pickNone: 'אין במפה של הקומה הזו רכיבים לבחירה.',
  pickNoPlan: 'לקומה הזו אין תוכנית מפורסמת.',
  pickChosen: 'נבחר',
  pickSave: 'צרף לבקשה',
  pickCancel: 'ביטול',
  pickLoading: 'טוען את המפה...',
  attached: 'הרכיב צורף לבקשה',
  removed: 'הרכיב הוסר מהבקשה',
  createLine: 'רכיב מהמפה',
} as const;

type MapTextKey = keyof typeof he;

const en: Record<MapTextKey, string> = {
  section: 'Map element',
  add: 'Add an element from the map',
  replace: 'Replace the element',
  remove: 'Remove',
  show: 'Show on the map',
  vendorPreview: 'What the vendor sees',
  vendorPreviewHide: 'Hide the picture',
  vendorNoImage: 'The vendor will see the description only (no map picture).',
  gone: 'The element is no longer on the map - the description from the moment it was attached is kept.',
  pickTitle: 'Choose an element from the map',
  pickFloor: 'Floor',
  pickHint: 'Click an element on the map (a camera, a device or an object).',
  pickNone: 'The map of this floor has no elements to choose.',
  pickNoPlan: 'This floor has no published plan.',
  pickChosen: 'Chosen',
  pickSave: 'Attach to the {ticket}',
  pickCancel: 'Cancel',
  pickLoading: 'Loading the map...',
  attached: 'The element was attached to the {ticket}',
  removed: 'The element was removed from the {ticket}',
  createLine: 'Map element',
};

/** One text in the document's language (a key missing in English falls back to the Hebrew), the module's name rendered (D33). */
function mapText(key: MapTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  const raw = (lang === 'en' ? en[key] : undefined) ?? he[key];
  return tn(raw, lang as TicketLang);
}

/** The texts by key, read at render time (`MAP_TEXT.section`): every property is a getter over `mapText`. */
export const MAP_TEXT: Readonly<Record<MapTextKey, string>> = Object.defineProperties(
  {},
  Object.fromEntries((Object.keys(he) as MapTextKey[]).map((k) => [k, { get: () => mapText(k), enumerable: true }])),
) as Readonly<Record<MapTextKey, string>>;

registerCatalogue('tickets/map-text', { he, en });
