/**
 * Electricity and device control (CR-007 slice 1, read-only): the Home Assistant floors → areas tree with live
 * counts, the building-wide counts and one area's per-domain cards. Projections of the synced HA catalogue; a state
 * change arrives through the existing /ha/ws push (api/ha.ts subscribeHa) and the screens refetch.
 */
import { get, post, put } from './client';
import { entityLabel } from '../i18n/entity-label';
import type { HaSyncState } from './ha';
import type * as Wire from './generated/wire-devices';
import type { HomeView } from './home-config';
import type { UnlockReason } from '../screens/lock-reason';
import { tr } from '../i18n/msg/api-devices';

export type { UnlockReason };

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/devices.py), generated into
 * ./generated/wire-devices.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Kept optional on
 * purpose (the demo trees and an older server lack them): the switch.* counts, the area row's indicators, the tree's / area's `can_*` flags,
 * a row's `activity` / `activity_kind`. Narrowed on purpose: a row's `activity_kind`, `climate_kind`, `kind` and `bulk_reason` to the closed
 * sets the services fix, a card's `id` to CardId. `sync` keeps api/ha.ts's HaSyncState (the same document; the demo trees build it). */

/** The per-kind counts of a scope. SWITCH-LIGHT-DIMMER-2331: `switch_entities(_on)` = the switch.* entities among `switches` (no
 * input_boolean helper) - the synoptic option "מפסקים בעמודת התאורה = כל המפסקים" adds them to its lights column; absent from an older
 * server. Heating (a climate entity that cannot cool) is its own group, never part of `climate`. `alarm`: the panel's state, null = no panel. */
export type DeviceCounts = Omit<Wire.DeviceCounts, 'switch_entities' | 'switch_entities_on'> & Partial<Pick<Wire.DeviceCounts, 'switch_entities' | 'switch_entities_on'>>;

/** CR-007 slice 3 `can_bulk`: the caller may start a bulk action here. Release 0.1.149 (the area row's indicators, api/area-row.ts): this
 * area's own climate.* units, the room temperature (null = unknown) and the open doors / windows. K88 `map`: the plan room linked to this
 * area - "הצג על המפה"; null = not linked. */
export interface DeviceArea extends Pick<Wire.DeviceTreeArea, 'area_id' | 'name' | 'icon' | 'floor_id' | 'has_camera'>,
  Partial<Pick<Wire.DeviceTreeArea, 'can_bulk' | 'climate' | 'temperature' | 'open_count' | 'map'>> {
  counts: DeviceCounts;
}

/** CR-007 slice 4: the building/floor "מזגני הקומה" strip - mode + target only, never the full card. */
export type ClimateSummary = Wire.DeviceClimateSummary;

/** `floor_id` is an HA floor id, or `none` for the "ללא קומה" bucket of areas that belong to no floor. */
export interface DeviceFloor extends Pick<Wire.DeviceTreeFloor, 'floor_id' | 'name' | 'level' | 'icon' | 'climate'>, Partial<Pick<Wire.DeviceTreeFloor, 'can_bulk'>> {
  areas: DeviceArea[];
  counts: DeviceCounts;
}

/** `scoped`: the caller holds devices.read on some floors only (the tree is narrowed to what is placed there). `home`: what the home
 * screen's widgets show now (api/home-config.ts types the home screen module's document). */
export interface DeviceTree extends Pick<Wire.DeviceTree, 'building_climate' | 'scoped'>, Partial<Pick<Wire.DeviceTree, 'can_bulk'>> {
  floors: DeviceFloor[];
  unassigned: Omit<Wire.DeviceUnassigned, 'area_id' | 'counts'> & { area_id: 'unassigned'; counts: DeviceCounts };
  building: DeviceCounts;
  sync: HaSyncState;
  home?: HomeView;
}

export type CardId = 'lighting' | 'switches' | 'climate' | 'heating' | 'covers' | 'security' | 'media' | 'sensors';
export const CARD_IDS: CardId[] = ['lighting', 'switches', 'climate', 'heating', 'covers', 'security', 'media', 'sensors'];

/** The fields a card row is narrowed on, or that only some routes add (typed by the row types that carry them below). */
type RowNarrowed = 'activity' | 'activity_kind' | 'climate_kind' | 'kind' | 'bulk_reason' | 'card' | 'area_id' | 'area_name' | 'floor_id' | 'floor_name' | 'unlock_reason' | 'can_unlock';

/** One card row (services/devices.card_row): the fields every row carries, then each card's own (absent elsewhere). `can_control`
 * (CR-007 slice 2): devices.control or ha.entity.control at this entity's own floor scope - controls render only when true. `alarm_managed`
 * (CR-010 review B1): owned by the alarm section, read-only everywhere else. CR-019 (switch rows, for a bulk holder): `bulk_protected` is
 * the administrator's mark (left out of group actions only), `bulk_reason` what a group action does with it ("unclassified" was removed by
 * the owner decision of 2026-10-02; never emitted). `bulk_excluded` (re-review M1): why a bulk action would not reach the row, or null.
 * SWITCH-LIGHT-DIMMER-2331 `dimmable`: the server's verdict, read only through `isDimmable`. `power`: an outlet's linked power sensor
 * (null / absent = show no power). */
export interface DeviceRow extends Omit<Wire.DeviceRow, RowNarrowed> {
  /** Fallbacks for `name` when the server has none (or sends the entity id): see i18n/entity-label.ts. Never shown as an id. */
  original_name?: string | null;
  device_name?: string | null;
  /** CR-032: the server marks an electrical device whose activity popup exists; `activity_kind` picks the icon and wording. Never guessed client side. */
  activity?: boolean;
  activity_kind?: import('./device-activity').ActivityKind | null;
  /** The climate group this entity is in (heating = cannot cool; automatic from its modes, or an administrator's override). */
  climate_kind?: 'ac' | 'heating';
  kind?: 'lock' | 'alarm' | 'camera' | 'binary_sensor';
  bulk_reason?: 'allowed' | 'protected' | 'doors_layer' | 'alarm_managed';
}

export interface DeviceCard extends Omit<Wire.DeviceCard, 'id' | 'entities'> {
  id: CardId;
  entities: DeviceRow[];
}

/** One area's cards. `floor_areas`: the areas of the same floor (this one included) for the chip row, empty for the unassigned bucket.
 * `can_bulk` (CR-007 slice 3), `can_mark_bulk_protected` (CR-019, system.configure; only for a bulk holder), `can_assign_area` (CR-007
 * slice 4: the unassigned bucket itself, system.configure). */
export interface DeviceAreaDetail extends Pick<Wire.DeviceArea, 'area' | 'scoped'>, Partial<Pick<Wire.DeviceArea, 'can_bulk' | 'can_mark_bulk_protected' | 'can_assign_area'>> {
  floor_areas: (Omit<Wire.DeviceAreaSibling, 'counts'> & { counts: DeviceCounts })[];
  cards: Record<CardId, DeviceCard>;
  counts: DeviceCounts;
  sync: HaSyncState;
}

export const getDevicesTree = () => get<DeviceTree>('devices/tree');

/** The overview tiles' kinds (owner 2026-09-29): one per building / floor counter. */
export type TileKind = 'lights' | 'switches' | 'covers' | 'climate' | 'heating' | 'media' | 'locks' | 'alarm';
export const TILE_KINDS: TileKind[] = ['lights', 'switches', 'covers', 'climate', 'heating', 'media', 'locks', 'alarm'];
export type ItemsScope = 'building' | 'floor' | 'area';

/** A row of the tiles' panel: the area card's own row plus its place (and, for a lock, whether this caller may unlock). */
export interface DeviceItem extends DeviceRow, Pick<Wire.DeviceRow, 'can_unlock'> {
  area_id: string;
  area_name: string;
  floor_id: string | null;
  floor_name: string | null;
  /** UNLOCK-REASON-2370: why a lock row cannot be unlocked (`ok` when it can) - one of the closed set the server's `unlock_reason` returns. */
  unlock_reason?: UnlockReason;
}

/** active = lit / on / open / heating-cooling / playing / locked / armed; unavailable apart from both. `can_mark_bulk_protected`: the
 * caller may protect switches from group actions (system.configure) - the switches list only. */
export interface DeviceItems extends Pick<Wire.DeviceItems, 'id' | 'name' | 'floor_name' | 'counts' | 'truncated' | 'scoped'>,
  Partial<Pick<Wire.DeviceItems, 'can_bulk' | 'can_mark_bulk_protected'>> {
  kind: TileKind;
  scope: ItemsScope;
  floors: (Omit<Wire.DeviceItemsFloor, 'areas'> & { areas: (Omit<Wire.DeviceItemsArea, 'items'> & { items: DeviceItem[] })[] })[];
  sync?: HaSyncState;
}

/** `GET /devices/items`: every entity of one tile kind in the building / one HA floor / one HA area, floor › area. */
export function getDeviceItems(kind: TileKind, scope: ItemsScope = 'building', id = '', switches: 'typed' | 'all' = 'typed', building = '') {
  return get<DeviceItems>(`devices/items?${itemsQuery(kind, scope, id, switches, building)}`);
}

/** The query of `GET /devices/items`. BUILDING-SCOPE-CONTROL-2351: `building` (a multi-building site, inside one building) lists only
 * that building's areas as the server resolves them; '' = the request exactly as before. */
export function itemsQuery(kind: TileKind, scope: ItemsScope = 'building', id = '', switches: 'typed' | 'all' = 'typed', building = ''): string {
  const q = new URLSearchParams({ kind, scope });
  if (scope !== 'building') q.set('id', id);
  if (kind === 'lights' && switches === 'all') q.set('switches', 'all'); // SWITCH-LIGHT-DIMMER-2331: every switch.* with the lights
  if (building) q.set('building', building);
  return q.toString();
}

/** "רענן מ-Home Assistant" (CR-007 HA refresh): re-read HA's entity / device / area / floor registries now.
 * `devices.read`; one per user per 10 s (429 `refresh_rate_limited`, details.retry_after_s); 503 while HA is not
 * connected. The open screens also receive the `structure_changed` push when something moved. */
type DevicesRefreshResult = Omit<Wire.DeviceRefresh, 'sync'> & { sync: HaSyncState };
export const refreshDevicesFromHa = () => post<DevicesRefreshResult>('devices/refresh');
/** Owner rule 2026-10-20: an operator never sees a raw entity id - a row whose name is empty or is the id gets the fallback chain's label. */
export function withFriendlyNames(d: DeviceAreaDetail): DeviceAreaDetail {
  for (const card of Object.values(d.cards ?? {})) for (const r of card?.entities ?? []) r.name = entityLabel(r);
  return d;
}
export const getDevicesArea = (areaId: string) => get<DeviceAreaDetail>(`devices/areas/${encodeURIComponent(areaId)}`).then(withFriendlyNames);

/** A row of a device that is not one of the area's own (owner 2026-09-30, area redesign): the area's card row plus the card
 * it belongs to and its own area. GET /devices/entities?ids= (same visibility as the tree). */
export interface EntityRow extends DeviceRow {
  card: CardId;
  area_id: string | null;
  area_name: string | null;
}
export const getEntityRows = (ids: string[]) => get<{ entities: EntityRow[] }>(`devices/entities?ids=${encodeURIComponent(ids.slice(0, 80).join(','))}`);

/** One device of the editor's whole-installation list (GET /devices/entity-pool, system.configure). */
export interface PoolEntity extends Omit<Wire.DevicePoolEntity, 'card'> {
  card: CardId;
}
export const getEntityPool = () => get<Omit<Wire.DeviceEntityPool, 'entities'> & { entities: PoolEntity[] }>('devices/entity-pool');

/** CR-007 slice 4: assign an entity to an HA area (the "ללא שיוך" bucket's own action) - a Home Assistant config
 * write through the bridge, system.configure, audited. */
export const assignEntityArea = (entityId: string, areaId: string) => put<Wire.DeviceAreaAssigned>(`devices/entities/${encodeURIComponent(entityId)}/area`, { area_id: areaId });

/** Per-card empty state, our own wording following the same idea as DomusUI's empty sections (extraction §3.4):
 * say what is missing and what would fill it. `GET /devices/building` (the same counts as the tree's `building`)
 * has no wrapper yet: no screen needs it apart from the tree, which already carries the counts. */
export const CARD_EMPTY: Record<CardId, { heading: string; hint: string }> = {
  lighting: { heading: tr('אין תאורה באזור הזה'), hint: tr('שייכו גופי תאורה לאזור והם יופיעו כאן אוטומטית.') },
  switches: { heading: tr('אין מתגים באזור הזה'), hint: tr('מתגים ודגלים (input_boolean) המשויכים לאזור יופיעו כאן.') },
  climate: { heading: tr('אין התקן מיזוג באזור הזה'), hint: tr('שייכו מזגן, תרמוסטט, מאוורר או מייבש לאזור והם יופיעו כאן.') },
  heating: { heading: tr('אין התקן חימום באזור הזה'), hint: tr('תרמוסטטים, משאבות חום וחימום תת־רצפתי המשויכים לאזור יופיעו כאן.') },
  covers: { heading: tr('אין תריסים באזור הזה'), hint: tr('תריסים, וילונות ושערים המשויכים לאזור יופיעו כאן.') },
  security: { heading: tr('אין התקני אבטחה באזור הזה'), hint: tr('מנעולים, מצלמות, מערכת אזעקה וחיישני דלת / תנועה המשויכים לאזור יופיעו כאן.') },
  media: { heading: tr('אין מסכים או נגנים באזור הזה'), hint: tr('טלוויזיות, מקרנים ורמקולים המשויכים לאזור יופיעו כאן.') },
  sensors: { heading: tr('אין חיישנים באזור הזה'), hint: tr('טמפרטורה, לחות ושאר חיישני הסביבה של האזור יופיעו כאן.') },
};

/** A climate row's target range and step: the entity's own (a heating thermostat / heat pump targets 45 and reports
 * max 95 - never cut to an air conditioner's 35); 5..35 and one degree only for one that reports none; an entity's own step (0.5) is honoured. */
export function climateRange(r: Pick<DeviceRow, 'min_temp' | 'max_temp' | 'target_temp_step'>): { min: number; max: number; step: number } {
  const min = r.min_temp ?? 5;
  const max = r.max_temp ?? 35;
  return { min, max: max >= min ? max : min, step: r.target_temp_step && r.target_temp_step > 0 ? r.target_temp_step : 1 };
}

export const HVAC_HE: Record<string, string> = { heat: tr('חימום'), cool: tr('קירור'), heat_cool: tr('חימום/קירור'), auto: tr('אוטומטי'), dry: tr('ייבוש'), fan_only: tr('מאוורר'), off: tr('כבוי') };
/** POLISH-LEFTOVERS-2341: the common climate fan_mode values (HA's FAN_* constants plus the usual vendor words) in Hebrew. */
export const FAN_HE: Record<string, string> = {
  auto: tr('אוטומטי'), on: tr('פועל'), off: tr('כבוי'), low: tr('נמוך'), medium: tr('בינוני'), middle: tr('בינוני'), mid: tr('בינוני'), high: tr('גבוה'), top: tr('מרבי'),
  focus: tr('ממוקד'), diffuse: tr('מפוזר'), quiet: tr('שקט'), silent: tr('שקט'), turbo: tr('טורבו'), strong: tr('חזק'), powerful: tr('חזק'), max: tr('מרבי'), min: tr('מזערי'),
  low_medium: tr('נמוך-בינוני'), medium_low: tr('בינוני-נמוך'), medium_high: tr('בינוני-גבוה'), high_medium: tr('גבוה-בינוני'), very_low: tr('נמוך מאוד'), very_high: tr('גבוה מאוד'),
  level1: tr('דרגה 1'), level2: tr('דרגה 2'), level3: tr('דרגה 3'), level4: tr('דרגה 4'), level5: tr('דרגה 5'),
};
/** The common climate swing_mode values (HA's SWING_* constants plus the usual vendor words) in Hebrew. */
export const SWING_HE: Record<string, string> = {
  off: tr('כבוי'), on: tr('פועל'), both: tr('אנכי ואופקי'), vertical: tr('אנכי'), horizontal: tr('אופקי'), auto: tr('אוטומטי'), swing: tr('נדנוד'), stop: tr('עצור'), fixed: tr('קבוע'),
  top: tr('למעלה'), upper: tr('למעלה'), high: tr('למעלה'), middle: tr('באמצע'), center: tr('באמצע'), mid: tr('באמצע'), bottom: tr('למטה'), lower: tr('למטה'), low: tr('למטה'),
  left: tr('שמאלה'), right: tr('ימינה'), wide: tr('רחב'), '1': tr('מיקום 1'), '2': tr('מיקום 2'), '3': tr('מיקום 3'), '4': tr('מיקום 4'), '5': tr('מיקום 5'),
};
/** P6 item 7 (moved here from devices-controls.ts): the common preset names, plus a humidifier's usual modes, in Hebrew. */
export const PRESET_HE: Record<string, string> = {
  home: tr('בבית'), away: tr('מחוץ לבית'), eco: tr('חיסכון'), comfort: tr('נוחות'), sleep: tr('שינה'), boost: tr('מוגבר'), none: tr('ללא'), auto: tr('אוטומטי'), off: tr('כבוי'), activity: tr('פעילות'),
  normal: tr('רגיל'), baby: tr('תינוק'), night: tr('לילה'), quiet: tr('שקט'), manual: tr('ידני'), smart: tr('חכם'), turbo: tr('טורבו'), vacation: tr('חופשה'), frost_protection: tr('הגנה מקיפאון'),
};
type ClimateChoice = 'hvac' | 'fan' | 'swing' | 'preset' | 'hmode';
/** A climate / humidifier mode value in words for the screen - display only (the device always receives the raw value).
 * Case-insensitive; an unknown value is shown as the device reports it. */
export function climateWord(kind: ClimateChoice, value: string | null | undefined): string {
  const v = value ?? '';
  if (!v) return '';
  const map = kind === 'hvac' ? HVAC_HE : kind === 'fan' ? FAN_HE : kind === 'swing' ? SWING_HE : PRESET_HE;
  const k = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return map[v] ?? map[k] ?? v;
}
export const HVAC_ACTION_HE: Record<string, string> = { heating: tr('מחמם'), cooling: tr('מקרר'), drying: tr('מייבש'), fan: tr('מאוורר'), idle: tr('ממתין'), off: tr('כבוי'), preheating: tr('מחמם מראש'), defrosting: tr('מפשיר') };
export const ALARM_HE: Record<string, string> = {
  disarmed: tr('מנוטרלת'),
  armed_home: tr('דרוכה (בית)'),
  armed_away: tr('דרוכה (חוץ)'),
  armed_night: tr('דרוכה (לילה)'),
  armed_vacation: tr('דרוכה (חופשה)'),
  armed_custom_bypass: tr('דרוכה (מותאם)'),
  pending: tr('ממתינה'),
  arming: tr('נדרכת…'),
  disarming: tr('מנוטרלת…'),
  triggered: tr('הופעלה!'),
  unavailable: tr('לא זמינה'),
  unknown: tr('לא ידוע'),
};

/**
 * SWITCH-LIGHT-DIMMER-2331 (owner 2026-11-01): the ONE gate of every brightness slider (area tiles and rows, the lights panel, the quick
 * sheet, the bubble pill and its sheet, every skin and the phone). A brightness control only for a light.* entity that really takes a
 * brightness: never a switch / input_boolean an administrator typed as a light (it keeps the light's look, it is on/off only), never a
 * light that reports only the "onoff" colour mode (a relay shown as a light). The server's `dimmable` decides; a row from an older
 * server or a demo row (no field) is dimmable unless its colour mode says "onoff" (the behaviour before 2.33.1).
 */
export function isDimmable(r: { domain: string; dimmable?: boolean; color_mode?: string | null }): boolean {
  if (r.domain !== 'light') return false;
  if (typeof r.dimmable === 'boolean') return r.dimmable;
  return r.color_mode !== 'onoff';
}
