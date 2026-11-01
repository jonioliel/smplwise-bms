/**
 * EVENTS-POLISH-2331: Hebrew for the raw values an event row carries from the device (the recorder's own event code, its English
 * description and the backend's time-precision tag). Only what a mapping exists for is translated; anything unknown is returned as
 * null so the screen shows the raw value as is (in the technical details), never an invented meaning.
 *
 * Codes: services/events_ingest.py TYPE_MAP (Hikvision / Provision-ISR ISAPI eventType values, lower-cased there).
 * Precision: services/events_ingest.py device_time_to_utc, services/events_derive.py, services/playback.py.
 */

/** The recorder's event code (any case) -> the operator's word for it. */
const RAW_CODE_LABEL: Record<string, string> = {
  vmd: 'זיהוי תנועה',
  motiondetection: 'זיהוי תנועה',
  linedetection: 'חציית קו',
  fielddetection: 'חדירה לאזור',
  regionentrance: 'כניסה לאזור',
  regionexiting: 'יציאה מאזור',
  intrusion: 'חדירה לאזור',
  videoloss: 'אובדן וידאו',
  videolost: 'אובדן וידאו',
  ipcdisconnect: 'מצלמה התנתקה',
  shelteralarm: 'הסתרת מצלמה',
  tamperdetection: 'חבלה במצלמה',
  facedetection: 'זיהוי פנים',
  humandetect: 'זיהוי אדם',
  vehicledetection: 'זיהוי רכב',
  io: 'כניסת חיווי',
  diskfull: 'דיסק מלא',
  diskerror: 'שגיאת דיסק',
  nicbroken: 'תקלת רשת',
};

/** The Hebrew name of a raw device code, or null when there is no mapping (the caller falls back to the event kind). */
export function rawCodeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return RAW_CODE_LABEL[raw.trim().toLowerCase()] ?? null;
}

/** The device's English description ("Motion alarm", "linedetection alarm", "videoloss alarm") in Hebrew, or null when the text is
 * not one of the known "<code> alarm" forms - then it is shown verbatim, marked as the device's own text. */
export function describeDeviceText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = /^\s*([a-z]+)\s+alarm\s*$/i.exec(text);
  if (!m) return null;
  const code = m[1].toLowerCase() === 'motion' ? 'vmd' : m[1];
  const label = rawCodeLabel(code);
  return label ? `התראת ${label}` : null;
}

const PRECISION_LABEL: Record<string, string> = {
  device_offset: 'שעון המכשיר, מתוקן להפרש',
  wall_clock: 'שעון המכשיר כמו שהוא',
  received: 'שעת הקליטה',
  recording_file: 'לפי קובץ ההקלטה',
  keyframe_limited: 'לפי פריים מפתח',
  verified: 'מאומת',
};

/** How exact the event time is, in words; null for an unknown tag. */
export function precisionLabel(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return PRECISION_LABEL[tag] ?? null;
}

/** A span in seconds as a short reading ("49 שנ׳", "3 דק׳ 5 שנ׳", "1 שע׳ 2 דק׳"); null below one second or without an end. */
export function spanText(fromIso: string, toIso: string | null | undefined): string | null {
  if (!toIso) return null;
  const s = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 1) return null;
  if (s < 60) return `${s} שנ׳`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} דק׳ ${s % 60} שנ׳` : `${m} דק׳`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} שע׳ ${m % 60} דק׳` : `${h} שע׳`;
}
