/**
 * How a meter or a candidate sensor is named on screen. Many sensors are called just "Energy"; what tells them apart is the device they belong to.
 * `primary` is the device's name (the user's name for the device, else its own); `secondary` is the sensor's own name, only when it differs. A sensor
 * with no device shows only its name. A registered meter the operator renamed keeps that name as primary, with the device and sensor below it.
 */
export interface NamedMeter {
  name: string;
  device_name?: string | null;
  entity_name?: string | null;
}

export interface MeterNames {
  primary: string;
  secondary: string;
}

export function meterNames(x: NamedMeter): MeterNames {
  const device = (x.device_name ?? '').trim();
  const entity = (x.entity_name ?? '').trim() || x.name;
  if (x.name && x.name !== entity && x.name !== device) {
    return { primary: x.name, secondary: [...new Set([device, entity].filter((s) => s && s !== x.name))].join(' · ') };
  }
  const primary = device || entity;
  return { primary, secondary: device && entity !== device ? entity : '' };
}

/** The text a search matches: the shown name, the device's name and the sensor's name. */
export function meterSearchText(x: NamedMeter): string {
  return [x.name, x.device_name, x.entity_name].filter(Boolean).join(' ').toLowerCase();
}

export const METER_NAME_MAX = 120;

export interface NameCheck {
  /** the trimmed name to send */
  name: string;
  /** a Hebrew sentence when the name cannot be saved, else '' */
  error: string;
  /** true when another meter already carries the same name (allowed, but the screen warns) */
  duplicate: boolean;
}

/** The friendly name of a meter as typed: trimmed, required, at most 120 characters; `others` are the names of the other meters (a name another meter already has is an error). */
export function checkMeterName(raw: string, others: readonly string[]): NameCheck {
  const name = raw.trim();
  const key = name.toLocaleLowerCase();
  const duplicate = !!name && others.some((o) => o.trim().toLocaleLowerCase() === key);
  if (!name) return { name, error: 'צריך להזין שם למונה', duplicate: false };
  if (name.length > METER_NAME_MAX) return { name, error: `השם ארוך מדי (עד ${METER_NAME_MAX} תווים)`, duplicate };
  if (duplicate) return { name, error: DUPLICATE_NAME_ERROR, duplicate };
  return { name, error: '', duplicate };
}

/** Meter names are unique (case-insensitive, paused meters included); the server refuses a colliding name with the code `meter_name_taken`. */
export const DUPLICATE_NAME_ERROR = 'קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם';
export const RENAME_HINT = 'השם החדש יופיע במסמכים חדשים. חשבוניות שכבר הונפקו לא ישתנו.';
