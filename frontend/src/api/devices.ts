/**
 * Electricity and device control (CR-007 slice 1, read-only): the Home Assistant floors → areas tree with live
 * counts, the building-wide counts and one area's per-domain cards. Projections of the synced HA catalogue; a state
 * change arrives through the existing /ha/ws push (api/ha.ts subscribeHa) and the screens refetch.
 */
import { get } from './client';
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
}

export interface DeviceFloor {
  /** An HA floor id, or `none` for the "ללא קומה" bucket of areas that belong to no floor. */
  floor_id: string;
  name: string;
  level: number | null;
  icon: string | null;
  areas: DeviceArea[];
  counts: DeviceCounts;
}

export interface DeviceTree {
  floors: DeviceFloor[];
  unassigned: { area_id: 'unassigned'; name: string; counts: DeviceCounts };
  building: DeviceCounts;
  /** True when the caller holds devices.read on some floors only: the tree is narrowed to what is placed there. */
  scoped: boolean;
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
  percentage?: number | null;
  current_humidity?: number | null;
  target_humidity?: number | null;
  unit?: string | null;
  // covers
  position?: number | null;
  tilt?: number | null;
  moving?: boolean;
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
  sync: HaSyncState;
}

export const getDevicesTree = () => get<DeviceTree>('devices/tree');
export const getDevicesArea = (areaId: string) => get<DeviceAreaDetail>(`devices/areas/${encodeURIComponent(areaId)}`);

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
