/**
 * Electricity and device control (CR-007 slice 1, read-only): the Home Assistant floors → areas tree with live
 * counts, the building-wide counts and one area's per-domain cards. Projections of the synced HA catalogue; a state
 * change arrives through the existing /ha/ws push (api/ha.ts subscribeHa) and the screens refetch.
 */
import { get, post, put } from './client';
import type { HaSyncState } from './ha';

export interface DeviceCounts {
  entities: number;
  lights: number;
  lights_on: number;
  switches: number;
  switches_on: number;
  covers: number;
  covers_open: number;
  climate: number;
  climate_active: number;
  media: number;
  media_on: number;
  locks: number;
  locks_locked: number;
  /** The alarm panel's state (armed_away, disarmed, ...), null when the scope has no panel. */
  alarm: string | null;
  cameras: number;
  sensors: number;
}

export interface DeviceArea {
  area_id: string;
  name: string;
  icon: string | null;
  floor_id: string | null;
  counts: DeviceCounts;
  has_camera: boolean;
  /** CR-007 slice 3: the caller may start a bulk action here (devices.control_bulk over something placed on their floors). */
  can_bulk?: boolean;
}

/** CR-007 slice 4: the building/floor "מזגני הקומה" strip - mode + target only, never the full card. */
export interface ClimateSummary {
  entity_id: string;
  name: string;
  area_name: string | null;
  hvac_mode: string | null;
  hvac_action: string | null;
  current_temperature: number | null;
  target_temperature: number | null;
  unit: string;
  available: boolean;
}

export interface DeviceFloor {
  /** An HA floor id, or `none` for the "ללא קומה" bucket of areas that belong to no floor. */
  floor_id: string;
  name: string;
  level: number | null;
  icon: string | null;
  areas: DeviceArea[];
  counts: DeviceCounts;
  /** CR-007 slice 3: the caller may start a bulk action on this floor. */
  can_bulk?: boolean;
  /** CR-007 slice 4: this floor's climate entities (climate.* only), for the "מזגני הקומה" strip. */
  climate: ClimateSummary[];
}

export interface DeviceTree {
  floors: DeviceFloor[];
  unassigned: { area_id: 'unassigned'; name: string; counts: DeviceCounts };
  building: DeviceCounts;
  /** CR-007 slice 4: every climate.* entity in the building, for the building card's own strip. */
  building_climate: ClimateSummary[];
  /** True when the caller holds devices.read on some floors only: the tree is narrowed to what is placed there. */
  scoped: boolean;
  /** CR-007 slice 3: the caller may start a bulk action on the whole building (devices.control_bulk installation-wide). */
  can_bulk?: boolean;
  sync: HaSyncState;
}

export type CardId = 'lighting' | 'switches' | 'climate' | 'covers' | 'security' | 'media' | 'sensors';
export const CARD_IDS: CardId[] = ['lighting', 'switches', 'climate', 'covers', 'security', 'media', 'sensors'];

export interface DeviceRow {
  entity_id: string;
  name: string;
  domain: string;
  device_class: string | null;
  state: string | null;
  available: boolean;
  fresh: boolean;
  /** The domain's own "on": lit, switched on, open, heating/cooling, playing, locked. */
  active: boolean;
  icon: string | null;
  last_changed: string | null;
  /** CR-007 slice 2: devices.control or ha.entity.control at this entity's own floor scope. Controls render only
   * when this is true - the read-only rendering from slice 1 stays for everyone else. */
  can_control: boolean;
  /** CR-007 slice 3 (switch rows, for a bulk holder): whether this switch may enter a bulk action and why - "marked"
   * (an administrator marked it: the only way in), "circuit_not_marked" (a lighting circuit's switch: the mark is
   * suggested), "switch_not_marked" or "doors_layer" (never). */
  bulk_safe?: boolean;
  bulk_reason?: 'marked' | 'circuit_not_marked' | 'doors_layer' | 'switch_not_marked';
  // lighting
  brightness_pct?: number | null;
  color_mode?: string | null;
  // climate (climate.*) and fan / humidifier
  hvac_mode?: string | null;
  hvac_action?: string | null;
  current_temperature?: number | null;
  target_temperature?: number | null;
  target_temp_low?: number | null;
  target_temp_high?: number | null;
  fan_mode?: string | null;
  preset_mode?: string | null;
  /** CR-007 slice 2: what this climate entity itself reports it supports - the controls offer nothing else. */
  hvac_modes?: string[] | null;
  fan_modes?: string[] | null;
  min_temp?: number | null;
  max_temp?: number | null;
  target_temp_step?: number | null;
  percentage?: number | null;
  current_humidity?: number | null;
  target_humidity?: number | null;
  unit?: string | null;
  // CR-007 slice 4: climate in full - preset, swing, target humidity; a humidifier's own mode
  preset_modes?: string[] | null;
  swing_mode?: string | null;
  swing_modes?: string[] | null;
  min_humidity?: number | null;
  max_humidity?: number | null;
  mode?: string | null;
  available_modes?: string[] | null;
  // covers
  position?: number | null;
  tilt?: number | null;
  moving?: boolean;
  /** CR-007 slice 4: a door / garage / gate cover - a passage, not a shutter. Read-only (`can_control` is already
   * false here, server-side); shown with door/garage wording and icon instead of the shutter controls. */
  door_class?: boolean;
  // security
  kind?: 'lock' | 'alarm' | 'camera' | 'binary_sensor';
  has_camera?: boolean;
  still_url?: string | null;
  armed?: boolean;
  locked?: boolean;
  // media
  media_title?: string | null;
  source?: string | null;
  volume_pct?: number | null;
  muted?: boolean | null;
  // sensors
  value?: number | null;
  on?: boolean | null;
  battery_level?: number | null;
  /** CR-007 slice 4: the sensors card's own grouping (device class, or "other"). Display only. */
  group?: string;
}

export interface DeviceCard {
  id: CardId;
  label: string;
  entities: DeviceRow[];
  count: number;
  active: number;
}

export interface DeviceAreaDetail {
  area: { area_id: string; name: string; icon: string | null; floor_id: string | null; floor_name: string | null; level: number | null };
  /** The areas of the same floor (this one included), for the chip row. Empty for the unassigned bucket. */
  floor_areas: { area_id: string; name: string; icon: string | null; counts: DeviceCounts }[];
  cards: Record<CardId, DeviceCard>;
  counts: DeviceCounts;
  scoped: boolean;
  /** CR-007 slice 3: the caller may start a bulk action on this area. */
  can_bulk?: boolean;
  /** CR-007 slice 3: the caller may mark a switch bulk-safe (system.configure). */
  can_mark_bulk_safe?: boolean;
  /** CR-007 slice 4: the caller may assign an entity of the "ללא שיוך" bucket to an area (system.configure); true
   * only when this is the unassigned bucket itself. */
  can_assign_area?: boolean;
  sync: HaSyncState;
}

export const getDevicesTree = () => get<DeviceTree>('devices/tree');

/** "רענן מ-Home Assistant" (CR-007 HA refresh): re-read HA's entity / device / area / floor registries now.
 * `devices.read`; one per user per 10 s (429 `refresh_rate_limited`, details.retry_after_s); 503 while HA is not
 * connected. The open screens also receive the `structure_changed` push when something moved. */
export interface DevicesRefreshResult {
  changed: boolean;
  last_registry_at: string | null;
  sync: HaSyncState;
}
export const refreshDevicesFromHa = () => post<DevicesRefreshResult>('devices/refresh');
export const getDevicesArea = (areaId: string) => get<DeviceAreaDetail>(`devices/areas/${encodeURIComponent(areaId)}`);

/** CR-007 slice 4: assign an entity to an HA area (the "ללא שיוך" bucket's own action) - a Home Assistant config
 * write through the bridge, system.configure, audited. */
export const assignEntityArea = (entityId: string, areaId: string) => put<{ entity_id: string; area_id: string; area_name: string }>(`devices/entities/${encodeURIComponent(entityId)}/area`, { area_id: areaId });

/** Per-card empty state, our own wording following the same idea as DomusUI's empty sections (extraction §3.4):
 * say what is missing and what would fill it. `GET /devices/building` (the same counts as the tree's `building`)
 * has no wrapper yet: no screen needs it apart from the tree, which already carries the counts. */
export const CARD_EMPTY: Record<CardId, { heading: string; hint: string }> = {
  lighting: { heading: 'אין תאורה באזור הזה', hint: 'שייכו גופי תאורה לאזור ב־Home Assistant והם יופיעו כאן אוטומטית.' },
  switches: { heading: 'אין מתגים באזור הזה', hint: 'מתגים ודגלים (input_boolean) המשויכים לאזור יופיעו כאן.' },
  climate: { heading: 'אין התקן מיזוג באזור הזה', hint: 'שייכו מזגן, תרמוסטט, מאוורר או מייבש לאזור והם יופיעו כאן.' },
  covers: { heading: 'אין תריסים באזור הזה', hint: 'תריסים, וילונות ושערים המשויכים לאזור יופיעו כאן.' },
  security: { heading: 'אין התקני אבטחה באזור הזה', hint: 'מנעולים, מצלמות, מערכת אזעקה וחיישני דלת / תנועה המשויכים לאזור יופיעו כאן.' },
  media: { heading: 'אין מסכים או נגנים באזור הזה', hint: 'טלוויזיות, מקרנים ורמקולים המשויכים לאזור יופיעו כאן.' },
  sensors: { heading: 'אין חיישנים באזור הזה', hint: 'טמפרטורה, לחות ושאר חיישני הסביבה של האזור יופיעו כאן.' },
};

export const HVAC_HE: Record<string, string> = { heat: 'חימום', cool: 'קירור', heat_cool: 'חימום/קירור', auto: 'אוטומטי', dry: 'ייבוש', fan_only: 'מאוורר', off: 'כבוי' };
export const HVAC_ACTION_HE: Record<string, string> = { heating: 'מחמם', cooling: 'מקרר', drying: 'מייבש', fan: 'מאוורר', idle: 'ממתין', off: 'כבוי', preheating: 'מחמם מראש', defrosting: 'מפשיר' };
export const ALARM_HE: Record<string, string> = {
  disarmed: 'מנוטרלת',
  armed_home: 'דרוכה (בית)',
  armed_away: 'דרוכה (חוץ)',
  armed_night: 'דרוכה (לילה)',
  armed_vacation: 'דרוכה (חופשה)',
  armed_custom_bypass: 'דרוכה (מותאם)',
  pending: 'ממתינה',
  arming: 'נדרכת…',
  disarming: 'מנוטרלת…',
  triggered: 'הופעלה!',
  unavailable: 'לא זמינה',
  unknown: 'לא ידוע',
};
