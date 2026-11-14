/**
 * PLAN3D-R28-UI-2433 (round 28 mockup, app/pills.html): one pill per room on the 3D map instead of one pill per device. A dense
 * floor (14 devices, 40 devices) put a pill on every device and the pills covered the picture; the room pill says what the room
 * holds in order of weight - how many doors / windows are open, presence, how many lights are on, the temperature - and a room
 * with a single device names that device ("דלת שירותים · סגורה"). Three distances: far (or a phone-wide stage) = the name with
 * count badges, mid = the name with words, near (the camera close to one room) = that room's devices one by one where they stand,
 * the other rooms still summarised. Pure: the host summarises the rooms from its anchors, zones and the room state layer
 * (summarizeRooms), groupDescription takes the anchor point of every pill from the built description and drops the room's own name
 * and temperature parts (the pill carries both); the element (sw-plan-3d) only places the pills and picks the distance per frame.
 * Every choice the owner has not answered yet (round 28 questions.html, group א) is a product setting (pillPrefsOf), so an answer
 * is a default change: `map.room_pills`, `map.room_pill_tap`, `map.room_pill_quiet`.
 */
import { pointInPolygon } from '../api/zones';
import { isOpenState } from './coverage';
import { isLightEntity, isOpeningEntity, isPresenceEntity, temperatureText, type RoomStateLayer } from './room-state';
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';

/** Round 28 Q1 (א1): one pill per room, devices one by one when near (`room`, recommended), one pill per room even when near
 * (`room_always`), or one pill per device as before (`device`). */
export type PillMode = 'room' | 'room_always' | 'device';
/** Round 28 Q2 (א2): a tap on a room pill opens the small detail popover (`popover`, recommended) or the room card at once (`card`). */
export type PillTap = 'popover' | 'card';
/** Round 28 Q3 (א3): a room with nothing to report shows its name only (`name`, recommended), nothing (`hide`), or a pill that
 * says "הכול סגור" (`bubble`). */
export type PillQuiet = 'name' | 'hide' | 'bubble';
export interface RoomPillPrefs {
  mode: PillMode;
  tap: PillTap;
  quiet: PillQuiet;
}
/** The recommended answers of round 28 (questions.html): the defaults until the owner answers. */
export const DEFAULT_PILL_PREFS: RoomPillPrefs = { mode: 'room', tap: 'popover', quiet: 'name' };
const MODES: readonly PillMode[] = ['room', 'room_always', 'device'];
const TAPS: readonly PillTap[] = ['popover', 'card'];
const QUIETS: readonly PillQuiet[] = ['name', 'hide', 'bubble'];
const pick = <T extends string>(v: unknown, all: readonly T[], dflt: T): T => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : dflt);

/** The pill settings from the product settings (an unknown or missing value reads as the default). */
export function pillPrefsOf(s: Record<string, unknown> | null | undefined): RoomPillPrefs {
  return {
    mode: pick(s?.['map.room_pills'], MODES, DEFAULT_PILL_PREFS.mode),
    tap: pick(s?.['map.room_pill_tap'], TAPS, DEFAULT_PILL_PREFS.tap),
    quiet: pick(s?.['map.room_pill_quiet'], QUIETS, DEFAULT_PILL_PREFS.quiet),
  };
}

/** What a device tells about its room: open (a door / window / lock open), lit, presence, a reading, or nothing special. */
export type DeviceKind = 'open' | 'lit' | 'pres' | 'temp' | 'stale' | 'other';
export interface RoomDevice {
  /** The anchor id (the entity pill's part is `ent:<anchorId>`, a click selects it). */
  anchorId: string;
  label: string;
  /** The state words of the rest of the UI (api/ha stateLabel), '' when unknown. */
  words: string;
  kind: DeviceKind;
  /** An sw-icon name. */
  icon: string;
}
export interface RoomSummary {
  id: string;
  name: string;
  level_id: string | null;
  /** Open doors / windows / locks of the room. */
  open: number;
  presence: boolean;
  /** Lights on. */
  lit: number;
  temp: number | null;
  devices: RoomDevice[];
}
/** A summary with the point the pill stands on (metres, the description's frame) and the room's size (its larger side, m). */
export interface RoomPill extends RoomSummary {
  pos: Vec3;
  extent: number;
}

/** One anchor as summarizeRooms reads it (the host's bundle anchor, flattened). */
export interface PillAnchor {
  id: string;
  resource_id: string;
  domain: string;
  device_class: string | null;
  layer_id: string | null;
  label: string;
  state: string | null;
  words: string;
  x: number;
  y: number;
  level_id: string | null;
}
export interface PillZone {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  level_id: string | null;
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Weight order of the popover's rows and of the near pills: open first, then presence, lit, readings, the rest. */
const WEIGHT: Record<DeviceKind, number> = { open: 0, pres: 1, lit: 2, temp: 3, stale: 4, other: 5 };

/** The kind and icon of one device from its domain, class and state. */
export function deviceKind(a: Pick<PillAnchor, 'domain' | 'device_class' | 'layer_id' | 'state' | 'resource_id'>): { kind: DeviceKind; icon: string } {
  const e = { id: a.resource_id, domain: a.domain, device_class: a.device_class, layer_id: a.layer_id };
  const stale = a.state === null || a.state === 'unavailable' || a.state === 'unknown';
  if (isLightEntity(e)) return { kind: stale ? 'stale' : a.state === 'on' ? 'lit' : 'other', icon: 'light' };
  if (isPresenceEntity(e)) return { kind: stale ? 'stale' : a.state === 'on' ? 'pres' : 'other', icon: 'user' };
  if (isOpeningEntity(e)) return { kind: stale ? 'stale' : isOpenState(a.state) ? 'open' : 'other', icon: a.domain === 'lock' ? 'lock' : 'door' };
  if (a.domain === 'cover') return { kind: stale ? 'stale' : 'other', icon: 'menu' };
  if (a.domain === 'climate' || (a.domain === 'sensor' && a.device_class === 'temperature')) return { kind: stale ? 'stale' : 'temp', icon: 'thermometer' };
  if (a.domain === 'camera') return { kind: 'other', icon: 'camera' };
  return { kind: stale ? 'stale' : 'other', icon: 'sensor' };
}

/** The rooms of a floor with what their devices say (the room state layer for presence, open openings, lamps and the
 * temperature; the anchors inside each polygon for the counts and the device list). Rooms in id order, devices by weight. */
export function summarizeRooms(zones: readonly PillZone[], anchors: readonly PillAnchor[], layer: RoomStateLayer | null, levelOf: (id: string | null) => string = (id) => id ?? ''): RoomSummary[] {
  const out: RoomSummary[] = [];
  for (const z of [...zones].filter((r) => r.polygon.length >= 3).sort(byId)) {
    const level = levelOf(z.level_id);
    const inside = anchors.filter((a) => levelOf(a.level_id) === level && pointInPolygon({ x: a.x, y: a.y }, z.polygon));
    const devices = inside
      .map((a): RoomDevice => ({ anchorId: a.id, label: a.label, words: a.words, ...deviceKind(a) }))
      .sort((p, q) => WEIGHT[p.kind] - WEIGHT[q.kind] || (p.label < q.label ? -1 : p.label > q.label ? 1 : 0) || (p.anchorId < q.anchorId ? -1 : 1));
    const st = layer?.rooms[z.id];
    const openDevices = devices.filter((d) => d.kind === 'open').length;
    const litDevices = devices.filter((d) => d.kind === 'lit').length;
    out.push({
      id: z.id,
      name: z.name,
      level_id: z.level_id,
      open: Math.max(openDevices, st?.openings.length ?? 0),
      presence: !!st?.presence || devices.some((d) => d.kind === 'pres'),
      lit: litDevices || (st?.lit ? 1 : 0),
      temp: st?.temperature ?? null,
      devices,
    });
  }
  return out;
}

/** A room with nothing to report: nothing open, nobody, no light, no reading. */
export const isQuiet = (s: RoomSummary): boolean => !s.open && !s.presence && !s.lit && s.temp === null;

/** The parts a room pill replaces: the room's name (`room:<id>#label`) and its temperature chip (`room:<id>#temp`). */
const replacedBy = (p: ScenePart): string | null => (p.kind === 'label' || p.kind === 'chip') && p.id.startsWith('room:') && (p.id.endsWith('#label') || p.id.endsWith('#temp')) ? p.userData.id : null;

/** The description the view draws with room pills, and the pills with their anchor points. A room's pill stands where its
 * name stood (the label part; else the centroid of its room plate at the label height); its name and temperature parts are
 * dropped (the pill carries both). `quiet: 'hide'` gives a quiet room no pill and no name. `mode: 'device'` changes nothing. */
export function groupDescription(desc: SceneDescription, rooms: readonly RoomSummary[], prefs: RoomPillPrefs): { desc: SceneDescription; pills: RoomPill[] } {
  if (prefs.mode === 'device' || !rooms.length) return { desc, pills: [] };
  const plates = new Map<string, ScenePart>();
  const labels = new Map<string, ScenePart>();
  for (const p of desc.parts) {
    if (p.kind === 'room' && p.id.startsWith('room:') && !p.id.includes('#')) plates.set(p.userData.id, p);
    else if (p.kind === 'label' && p.id.startsWith('room:') && p.id.endsWith('#label')) labels.set(p.userData.id, p);
  }
  const pills: RoomPill[] = [];
  const pilled = new Set<string>();
  for (const r of rooms) {
    const plate = plates.get(r.id);
    if (!plate?.polygon?.length) continue; // not shown (another level, zones layer off)
    pilled.add(r.id);
    if (prefs.quiet === 'hide' && isQuiet(r)) continue;
    const xs = plate.polygon.map((q) => q[0]);
    const zs = plate.polygon.map((q) => q[1]);
    const label = labels.get(r.id);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
    const pos: Vec3 = label ? [label.position[0], label.position[1], label.position[2]] : [plate.position[0] + cx, plate.position[1] + 1.2, plate.position[2] + cz];
    pills.push({ ...r, pos, extent: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) });
  }
  if (!pilled.size) return { desc, pills };
  const parts = desc.parts.filter((p) => {
    const z = replacedBy(p);
    return !z || !pilled.has(z);
  });
  return { desc: parts.length === desc.parts.length ? desc : { ...desc, parts }, pills };
}

/** The distance a pill is drawn at. */
export type PillLod = 'far' | 'mid';
/** Under this many stage pixels per metre the floor is far: name + count badges (the 40-device floor of the mockup at 1280 px
 * is ~22 px/m; a whole house on a phone ~9 px/m). */
export const FAR_PX_PER_M = 14;
/** A room is near when its larger side covers at least this share of the stage's shorter side and its point is in the
 * middle of the stage (NEAR_CENTRE of each axis). */
export const NEAR_SHARE = 0.5;
export const NEAR_CENTRE = 0.7;
/** ... and only while the camera is closer than the overview: the floor (the pills' rooms together) spans more than this many
 * times the stage's longer side. At the overview of a small floor a big room fills half the stage too - it is not "near". */
export const NEAR_ZOOM = 1.2;

/** The floor's larger side (metres) from the pills: their points widened by half their rooms' extents. */
export function floorExtent(pills: readonly RoomPill[]): number {
  if (!pills.length) return 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of pills) {
    x0 = Math.min(x0, p.pos[0] - p.extent / 2);
    x1 = Math.max(x1, p.pos[0] + p.extent / 2);
    z0 = Math.min(z0, p.pos[2] - p.extent / 2);
    z1 = Math.max(z1, p.pos[2] + p.extent / 2);
  }
  return Math.max(x1 - x0, z1 - z0);
}

/** far / mid for a scale (px per metre) and a stage width: a phone-wide stage is always far. */
export function pillLod(pxPerM: number, stageW: number, phoneW: number): PillLod {
  return stageW > 0 && stageW < phoneW ? 'far' : pxPerM > 0 && pxPerM < FAR_PX_PER_M ? 'far' : 'mid';
}

/** The near room: the largest on the screen among those that fill NEAR_SHARE of the stage with their point near its middle,
 * while the camera is zoomed in past the overview (NEAR_ZOOM); null when none does. `at` is the projected point and the px-per-metre at it, per pill id. */
export function nearRoom(pills: readonly RoomPill[], at: ReadonlyMap<string, { x: number; y: number; pxPerM: number }>, stageW: number, stageH: number): string | null {
  const short = Math.min(stageW, stageH);
  if (!(short > 0)) return null;
  const floor = floorExtent(pills);
  const mx = (stageW * (1 - NEAR_CENTRE)) / 2;
  const my = (stageH * (1 - NEAR_CENTRE)) / 2;
  let best: string | null = null;
  let bestPx = 0;
  for (const p of pills) {
    const a = at.get(p.id);
    if (!a) continue;
    const px = p.extent * a.pxPerM;
    if (px < short * NEAR_SHARE || floor * a.pxPerM < NEAR_ZOOM * Math.max(stageW, stageH) || a.x < mx || a.x > stageW - mx || a.y < my || a.y > stageH - my) continue;
    if (px > bestPx || (px === bestPx && best !== null && p.id < best)) {
      best = p.id;
      bestPx = px;
    }
  }
  return best;
}

/** The tone of a pill: its weightiest fact (the ring and the leading badge colour). */
export const pillTone = (s: RoomSummary): 'open' | 'pres' | 'lit' | 'quiet' => (s.open ? 'open' : s.presence ? 'pres' : s.lit ? 'lit' : 'quiet');

/** "פתוח 1" / "2 פתוחים". */
export const openWords = (n: number): string => (n === 1 ? 'פתוח 1' : `${n} פתוחים`);

/** The one device a single-device room names on its pill (mid distance), or null. A temperature is never "the" device: the
 * pill's own reading shows it. */
export function soleDevice(s: RoomSummary): RoomDevice | null {
  return s.devices.length === 1 && s.devices[0].kind !== 'temp' ? s.devices[0] : null;
}

/** The pill's accessible name: the room and every fact in words (the badges are glyphs and numbers). */
export function pillAria(s: RoomSummary): string {
  const bits = [s.name || 'חדר'];
  if (s.open) bits.push(openWords(s.open));
  if (s.presence) bits.push('נוכחות');
  if (s.lit) bits.push(s.lit === 1 ? 'אור אחד דולק' : `${s.lit} אורות דולקים`);
  if (s.temp !== null) bits.push(temperatureText(s.temp));
  if (isQuiet(s)) bits.push('הכול סגור');
  return bits.join(', ');
}

/** The popover's rows: open, lights on, then the rest (state), at most `max` with the count of the others. */
export function popoverRows(s: RoomSummary, max = 6): { open: RoomDevice[]; lit: RoomDevice[]; rest: RoomDevice[]; more: number } {
  const open = s.devices.filter((d) => d.kind === 'open');
  const lit = s.devices.filter((d) => d.kind === 'lit');
  const rest = s.devices.filter((d) => d.kind !== 'open' && d.kind !== 'lit');
  let room = max;
  const take = (list: RoomDevice[]): RoomDevice[] => {
    const t = list.slice(0, Math.max(0, room));
    room -= t.length;
    return t;
  };
  const o = take(open);
  const l = take(lit);
  const r = take(rest);
  return { open: o, lit: l, rest: r, more: s.devices.length - o.length - l.length - r.length };
}
