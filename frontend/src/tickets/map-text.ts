/** TKMAP1 words (the vendor page has its own four languages in public-ticket/strings.ts). Hebrew, the product language, by default;
 * the English column when the document language is English (tickets/text.ts `ticketsLang`). `MAP_TEXT.x` is read at render time, so
 * each property is a getter that picks the language then; module-name tokens (D33) are rendered with the configured name. */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

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

export type MapTextKey = keyof typeof he;

const en: Record<MapTextKey, string> = packTable<typeof import('../i18n/lang/en/tickets/map-text').en>('en', 'tickets/map-text', 'en');

/** One text in the document's language (a key missing in English falls back to the Hebrew), the module's name rendered (D33). */
export function mapText(key: MapTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  const raw = (lang === 'en' ? en[key] : undefined) ?? he[key];
  return tn(raw, lang as TicketLang);
}

/** The texts by key, read at render time (`MAP_TEXT.section`): every property is a getter over `mapText`. */
export const MAP_TEXT: Readonly<Record<MapTextKey, string>> = Object.defineProperties(
  {},
  Object.fromEntries((Object.keys(he) as MapTextKey[]).map((k) => [k, { get: () => mapText(k), enumerable: true }])),
) as Readonly<Record<MapTextKey, string>>;

export const MAP_TEXT_KEYS = Object.keys(he) as MapTextKey[];
export const MAP_TEXT_EN_KEYS = Object.keys(en) as MapTextKey[];

registerCatalogue('tickets/map-text', { he, en });
