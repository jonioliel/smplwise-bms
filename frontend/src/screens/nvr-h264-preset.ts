/**
 * NVR-H264-BULK-2341: the pure logic of the one-click "המר את כל הזרמים ל־H.264" in the bulk encoding dialog (nvr-encoding-batch) and of
 * the per-recorder switch "אפשר שינויי הגדרות ב־NVR" (components/nvr-writes-switch). No DOM and no network, so the unit spec runs it in Node.
 *
 * The preset adds no write path: it only chooses the streams (all cameras or the cameras already ticked; main, sub or both) and the target
 * settings (`{codec: 'H.264'}`, every other field "ללא שינוי"), then runs the EXISTING preview -> confirmation -> start of CR-020 phase D.
 * The server plans every stream against its device (the profile H.264 needs, a resolution H.264 does not offer moved to the closest, the
 * rest kept), lists the streams it cannot change with the reason, and the undo-all of the result puts back the values captured before.
 */
import type { EncodingSettings } from '../api/nvr-batch';
import type { EncStream } from './nvr-encoding-logic';

export type PresetScope = 'all' | 'selected';
export type PresetRole = 'both' | 'main' | 'sub';

export const PRESET_TITLE = 'המר את כל הזרמים ל־H.264';
export const PRESET_SETTINGS: EncodingSettings = { codec: 'H.264' };
/** Why (owner request): the live view plays H.264 in every browser; H.265 saves recording space but does not play in Chrome / Edge. */
export const PRESET_WHY = 'H.264 מנגן בשידור חי בכל דפדפן; H.265 חוסך נפח הקלטה אך לא מנגן ב-Chrome/Edge.';
export const PRESET_STORAGE = 'נפח ההקלטה עשוי לגדול אחרי המעבר ל־H.264.';
export const PRESET_FLOW = 'לפני השינוי תוצג תצוגה מקדימה לכל זרם, ואחריו אפשר להחזיר לערכים הקודמים.';

export const SCOPE_ITEMS: { id: PresetScope; label: string }[] = [
  { id: 'all', label: 'כל המצלמות' },
  { id: 'selected', label: 'המצלמות שנבחרו' },
];
export const ROLE_ITEMS: { id: PresetRole; label: string }[] = [
  { id: 'both', label: 'ראשי ומשני' },
  { id: 'main', label: 'ראשי' },
  { id: 'sub', label: 'משני' },
];

const roleOk = (r: EncStream, role: PresetRole): boolean => role === 'both' || r.role === role;

/**
 * The streams the preset sends to the preview: every SELECTABLE stream of the scope's cameras with the chosen role. "המצלמות שנבחרו" = the
 * cameras that have at least one ticked stream (their other stream joins when the role says so). Streams already on H.264 are kept: the
 * server answers them as "כבר מוגדרים", so the person sees the whole picture.
 */
export function presetStreams(rows: EncStream[], selected: Set<string>, scope: PresetScope, role: PresetRole): EncStream[] {
  const cams = scope === 'selected' ? new Set(rows.filter((r) => selected.has(r.key)).map((r) => r.cameraId)) : null;
  return rows.filter((r) => r.selectable && roleOk(r, role) && (cams === null || cams.has(r.cameraId)));
}

/** The streams of the scope that cannot be chosen at all (and so never reach the preview), with how many are off because the
 * recorder's switch is off - the hint then points at the connection settings. */
export function presetBlocked(rows: EncStream[], selected: Set<string>, scope: PresetScope, role: PresetRole, writesOffReason: string): { total: number; writesOff: number } {
  const cams = scope === 'selected' ? new Set(rows.filter((r) => selected.has(r.key)).map((r) => r.cameraId)) : null;
  const out = rows.filter((r) => !r.selectable && roleOk(r, role) && (cams === null || cams.has(r.cameraId)));
  return { total: out.length, writesOff: out.filter((r) => r.reason === writesOffReason).length };
}

/** The keys to tick when the preset runs (the checklist then shows what was sent). */
export const presetKeys = (streams: EncStream[]): Set<string> => new Set(streams.map((r) => r.key));

/** The preset button's label: "המר N זרמים ל־H.264" (or the title while nothing is in scope). */
export function presetButtonLabel(n: number): string {
  if (n <= 0) return PRESET_TITLE;
  return n === 1 ? 'המר זרם אחד ל־H.264' : `המר ${n} זרמים ל־H.264`;
}

/** The line under the preset when it cannot run. */
export function presetEmptyLine(scope: PresetScope, blocked: { total: number; writesOff: number }, selectedCount: number): string {
  if (scope === 'selected' && selectedCount === 0) return 'יש לסמן קודם מצלמה אחת לפחות ברשימה.';
  if (blocked.writesOff > 0) return 'שינויי הגדרות ב־NVR כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.';
  return 'אין זרמים שאפשר לשנות.';
}

/** The result's undo-all button (nvr-camera-batch): for a bulk ENCODING change it re-applies the values captured before the change -
 * "החזר לערכים הקודמים" (owner wording); the multi-camera SVC batch keeps its "בטל את מה שנשמר". */
export const undoLabel = (mode: string | null | undefined): string => (mode === 'encoding' ? 'החזר לערכים הקודמים' : 'בטל את מה שנשמר');

// ------------------------------------------------------------------------------------------------ the switch (components/nvr-writes-switch)

export const WRITES_LABEL = 'אפשר שינויי הגדרות ב־NVR';
export const WRITES_CONFIRM_HEADING = 'להפעיל שינויי הגדרות ב־NVR?';
/** The dialog's three points (owner request): what Arx will write, that it is recorded, that it can be turned off at any time. */
export const WRITES_CONFIRM_POINTS: readonly string[] = [
  'Arx יכתוב הגדרות קידוד (קודק, רזולוציה, קצב, איכות) ישירות ל־NVR, רק אחרי תצוגה מקדימה ואישור שלכם.',
  'כל הפעלה, כיבוי ושינוי נרשמים ביומן: מי ומתי.',
  'אפשר לכבות בכל רגע; הכיבוי חל מיד וחוסם כל כתיבה ל־NVR הזה.',
];
export const WRITES_CONFIRM_ACTION = 'הפעל';

/** The switch's status line: on / off, the vendor default when never switched, who changed it last and when. */
export function writesStatusLine(s: { enabled: boolean; explicit: boolean; last_change: { at: string; by: string | null } | null }, fmt: (iso: string) => string): string {
  const head = s.enabled ? 'פעיל' : 'כבוי';
  if (!s.explicit || !s.last_change) return `${head} (ברירת המחדל)`;
  return `${head} · ${s.last_change.by ?? 'מערכת'} · ${fmt(s.last_change.at)}`;
}
