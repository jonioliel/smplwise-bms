/**
 * Owner rule (2026-10-20): an operator screen never shows a raw Home Assistant entity id (`sensor.x`, `climate.x`, ...).
 * One shared fallback chain for every label: name -> original name -> device / unit name -> a neutral Hebrew label,
 * never the id. Only the settings / explore screens that deliberately show ids may print them (see `techIdLine`).
 */

/** A Home Assistant entity id: `<domain>.<object_id>`, lower-case, no spaces. A Hebrew or spaced name never matches. */
const ENTITY_ID_RE = /^[a-z_]+\.[a-z0-9_]+$/;
export function looksLikeEntityId(text: string | null | undefined): boolean {
  return ENTITY_ID_RE.test((text ?? '').trim());
}

/** Domains an entity id can start with, for scanning free text (a scan of "x.y" alone would hit file names and numbers). */
export const ENTITY_DOMAINS = [
  'sensor', 'binary_sensor', 'climate', 'switch', 'light', 'cover', 'fan', 'humidifier', 'media_player', 'lock', 'alarm_control_panel',
  'camera', 'input_boolean', 'input_number', 'input_select', 'input_text', 'input_datetime', 'scene', 'script', 'automation', 'number',
  'select', 'button', 'person', 'device_tracker', 'weather', 'water_heater', 'vacuum', 'siren', 'remote', 'update', 'calendar', 'group', 'zone', 'sun',
] as const;
/** Finds an entity id inside free text (the unit-test scan of rendered text / title / aria-label). */
export const ENTITY_ID_SCAN_RE = new RegExp(`(?:^|[^a-z0-9_.])((?:${[...ENTITY_DOMAINS].sort((a, b) => b.length - a.length).join('|')})\.[a-z0-9_]+)`);

export const NEUTRAL_LABEL = 'התקן ללא שם';
const NEUTRAL_BY_DOMAIN: Record<string, string> = {
  light: 'תאורה ללא שם', switch: 'מתג ללא שם', cover: 'תריס ללא שם', climate: 'מזגן ללא שם', fan: 'מאוורר ללא שם', humidifier: 'מכשיר אדים ללא שם',
  media_player: 'נגן ללא שם', lock: 'מנעול ללא שם', alarm_control_panel: 'אזעקה', camera: 'מצלמה ללא שם', sensor: 'חיישן ללא שם', binary_sensor: 'חיישן ללא שם',
};

/** The neutral label for an entity id's domain (the id itself is only read to pick the domain, never printed). */
export function neutralLabel(entityId?: string | null): string {
  const domain = (entityId ?? '').split('.')[0];
  return NEUTRAL_BY_DOMAIN[domain] ?? NEUTRAL_LABEL;
}

/** The first candidate that is a real name (non-empty, not an entity id), else `neutral`. */
export function friendlyLabel(candidates: ReadonlyArray<string | null | undefined>, neutral: string = NEUTRAL_LABEL): string {
  for (const c of candidates) {
    const t = (c ?? '').trim();
    if (t && !looksLikeEntityId(t)) return t;
  }
  return neutral;
}

export interface LabelSource {
  entity_id?: string | null;
  name?: string | null;
  original_name?: string | null;
  device_name?: string | null;
  unit_name?: string | null;
}
/** name -> original name -> device name -> unit name -> neutral (by domain). Never the entity id. */
export function entityLabel(src: LabelSource, neutral?: string): string {
  return friendlyLabel([src.name, src.original_name, src.device_name, src.unit_name], neutral ?? neutralLabel(src.entity_id));
}

/** An administrator's explicit technical line: the id, marked so it is clearly technical, selectable as one unit (copy) and skipped by the operator-screen scan. */
export const TECH_ID_ATTR = 'data-tech-id';
