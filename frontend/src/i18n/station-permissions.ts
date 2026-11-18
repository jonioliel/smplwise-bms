/**
 * STATIONPERM-295: the words of the person's per-station access block (the person's page, tab "גישה"). Short operator texts, no hint
 * paragraphs. The product is "WisKey" in every text; no text names the home platform. Every key exists in all four tables (a unit test
 * holds the parity); the Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked).
 */
import { xtLang, type XtLang } from './access-external';
import { fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';

const he = {
  title: 'הרשאות לפי עמדה',
  src_group: 'דרך קבוצה',
  src_personal: 'אישית',
  src_blocked: 'חסומה',
  src_blocked_group: 'נחסמה אישית · הקבוצה מאפשרת',
  src_none: 'ללא גישה',
  src_unknown: 'לא ידוע',
  sync_pending: 'ממתין לשליחה',
  sync_applied: 'עודכן ב-WisKey',
  sync_unverified: 'לא אומת',
  sync_failed: 'נדחה ב-WisKey',
  allow: 'אפשר',
  deny: 'חסום',
  inherit: 'לפי קבוצה',
  removePersonal: 'הסרת גישה אישית',
  approve: 'אישור',
  refuse: 'דחייה',
  withdraw: 'ביטול בקשה',
  sync: 'בדיקה חוזרת',
  add: 'הוספת עמדה',
  addPick: 'בחירת עמדה',
  doors: 'דלתות {doors}',
  requested: 'בקשה: {who}',
  requestedMine: 'הבקשה שלך ממתינה לאישור',
  requestSent: 'הבקשה נשלחה לאישור',
  confirmDeny: 'לחסום את {station}?',
  confirmYes: 'חסום',
  cancel: 'ביטול',
  done: 'נשמר',
  unavailable: 'WisKey לא זמין כרגע',
  grantLive: 'גישה זמנית פעילה מנהלת את הדלתות של אדם זה',
  self: 'לא ניתן לשנות את הגישה של עצמך',
  empty: 'אין עמדות',
  error: 'לא ניתן לטעון',
  retry: 'נסה שוב',
};
type SpKey = keyof typeof he;

const en: Record<SpKey, string> = packTable<typeof import('./lang/en/i18n/station-permissions').en>('en', 'i18n/station-permissions', 'en');

const ar: Record<SpKey, string> = packTable<typeof import('./lang/ar/i18n/station-permissions').ar>('ar', 'i18n/station-permissions', 'ar');

const ru: Record<SpKey, string> = packTable<typeof import('./lang/ru/i18n/station-permissions').ru>('ru', 'i18n/station-permissions', 'ru');

const TABLES: Record<XtLang, Record<SpKey, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const SP_DEV_MARKED: readonly XtLang[] = ['ar', 'ru'];
export const SP_KEYS = Object.keys(he) as SpKey[];
export const SP_TABLES = TABLES;
export type { SpKey };

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function spt(key: SpKey, vars?: Record<string, string | number>, lang: XtLang = xtLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

registerCatalogue('i18n/station-permissions', { he, en, ar, ru }, SP_DEV_MARKED);
