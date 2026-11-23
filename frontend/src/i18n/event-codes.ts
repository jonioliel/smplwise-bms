/**
 * EVENTS-POLISH-2331: Hebrew for the raw values an event row carries from the device (the recorder's own event code, its English
 * description and the backend's time-precision tag). Only what a mapping exists for is translated; anything unknown is returned as
 * null so the screen shows the raw value as is (in the technical details), never an invented meaning.
 *
 * Codes: services/events_ingest.py TYPE_MAP (Hikvision / Provision-ISR ISAPI eventType values, lower-cased there).
 * Precision: services/events_ingest.py device_time_to_utc, services/events_derive.py, services/playback.py.
 *
 * I18N-EN-2490: a catalogue (he / en) - the English is in the language pack (src/i18n/lang/en/i18n/event-codes.ts) and follows the
 * document language; a word the pack lacks stays Hebrew. Keys: `c_<code>` the recorder's codes, `alertOf` the device's
 * "<code> alarm" text, `p_<tag>` the time precision, `s_*` the span units.
 */
import { docLang, fill, registerCatalogue, type Vars } from './core';
import { packTable } from './lang-packs';


const he = {
  c_vmd: 'זיהוי תנועה',
  c_motiondetection: 'זיהוי תנועה',
  c_linedetection: 'חציית קו',
  c_fielddetection: 'חדירה לאזור',
  c_regionentrance: 'כניסה לאזור',
  c_regionexiting: 'יציאה מאזור',
  c_intrusion: 'חדירה לאזור',
  c_videoloss: 'אובדן וידאו',
  c_videolost: 'אובדן וידאו',
  c_ipcdisconnect: 'מצלמה התנתקה',
  c_shelteralarm: 'הסתרת מצלמה',
  c_tamperdetection: 'חבלה במצלמה',
  c_facedetection: 'זיהוי פנים',
  c_humandetect: 'זיהוי אדם',
  c_vehicledetection: 'זיהוי רכב',
  c_io: 'כניסת חיווי',
  c_diskfull: 'דיסק מלא',
  c_diskerror: 'שגיאת דיסק',
  c_nicbroken: 'תקלת רשת',
  alertOf: 'התראת {label}',
  p_device_offset: 'שעון המכשיר, מתוקן להפרש',
  p_wall_clock: 'שעון המכשיר כמו שהוא',
  p_received: 'שעת הקליטה',
  p_recording_file: 'לפי קובץ ההקלטה',
  p_keyframe_limited: 'לפי פריים מפתח',
  p_verified: 'מאומת',
  s_sec: '{s} שנ׳',
  s_min: '{m} דק׳',
  s_min_sec: '{m} דק׳ {s} שנ׳',
  s_hour: '{h} שע׳',
  s_hour_min: '{h} שע׳ {m} דק׳',
};
type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = packTable<typeof import('./lang/en/i18n/event-codes').en>('en', 'i18n/event-codes', 'en');

const TABLES: Record<'he' | 'en', Partial<Record<Key, string>>> = { he, en };
function t(key: Key, vars?: Vars): string {
  return fill(TABLES[docLang(['en'])][key] ?? he[key], vars);
}
const has = (key: string): key is Key => Object.prototype.hasOwnProperty.call(he, key);

/** The operator's name of a raw device code in the interface language, or null when there is no mapping (the caller falls back to
 * the event kind). */
export function rawCodeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = `c_${raw.trim().toLowerCase()}`;
  return has(key) ? t(key) : null;
}

/** The device's English description ("Motion alarm", "linedetection alarm", "videoloss alarm") in the interface language, or null
 * when the text is not one of the known "<code> alarm" forms - then it is shown verbatim, marked as the device's own text. */
export function describeDeviceText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = /^\s*([a-z]+)\s+alarm\s*$/i.exec(text);
  if (!m) return null;
  const code = m[1].toLowerCase() === 'motion' ? 'vmd' : m[1];
  const label = rawCodeLabel(code);
  return label ? t('alertOf', { label }) : null;
}

/** How exact the event time is, in words; null for an unknown tag. */
export function precisionLabel(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const key = `p_${tag}`;
  return has(key) ? t(key) : null;
}

/** A span in seconds as a short reading ("49 שנ׳", "3 דק׳ 5 שנ׳", "1 שע׳ 2 דק׳"; English "49 s", "3 min 5 s", "1 h 2 min"); null
 * below one second or without an end. */
export function spanText(fromIso: string, toIso: string | null | undefined): string | null {
  if (!toIso) return null;
  const s = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 1) return null;
  if (s < 60) return t('s_sec', { s });
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? t('s_min_sec', { m, s: s % 60 }) : t('s_min', { m });
  const h = Math.floor(m / 60);
  return m % 60 ? t('s_hour_min', { h, m: m % 60 }) : t('s_hour', { h });
}

registerCatalogue('i18n/event-codes', { he, en });
