/**
 * The room state model of the floor map (CR-006 slice 1b, §4.1 item 3): what the entities anchored inside a room's
 * polygon say about it - lit (a light or a switch used as a light is on, or a lamp object of the room glows), presence
 * (a motion / occupancy / presence sensor is on, and a tint that fades over the installation's window after the last
 * motion, from the entity's last_changed), the open openings on its boundary (door / window sensors bound to an opening
 * or sitting near one), a temperature (the room's climate current_temperature, else a temperature sensor), a lock and
 * an alarm panel when the room has one. Pure: the same structure, the same state snapshot and the same `now` give the
 * same layer (design rule 4) - the 3D builder puts it into the description, the 2D canvas draws it, the thumbnail
 * strip shows the per-level dots. Coordinates are the maps' normalised plan coordinates (0..1, origin top-left);
 * distances are measured in plan-width units (y scaled by height / width), so a tolerance means the same on both axes.
 */
import { isOpenState } from './coverage';
import { pointInPolygon } from '../api/zones';

export interface StateEntity {
  /** The Home Assistant entity id. */
  id: string;
  domain: string;
  device_class: string | null;
  /** null = unknown (stale screen, sync down, entity not fresh): it contributes nothing. */
  state: string | null;
  /** ISO time of the last state change (the fade reads it); null = unknown (no fade after the sensor goes off). */
  last_changed: string | null;
  attributes?: Record<string, unknown> | null;
  x: number;
  y: number;
  level_id: string | null;
  /** The map layer of the anchor: a switch on the lights layer counts as a light. */
  layer_id?: string | null;
}
export interface StateRoom {
  id: string;
  polygon: { x: number; y: number }[];
  level_id: string | null;
}
export interface StateOpening {
  id: string;
  kind: 'door' | 'window' | 'passage';
  /** The midpoint of the opening's gap (normalised). */
  x: number;
  y: number;
  level_id: string | null;
  /** The entity bound to the opening (its anchor_ref), if any. */
  entity_id: string | null;
}
/** A lamp object of the structure (T085): glows by its circuit's switch or its own entity - a lit lamp lights its room. */
export interface StateLamp {
  x: number;
  y: number;
  level_id: string | null;
  on: boolean;
}
/** The presence fade setting: off (the tint only while the sensor is on) or the window in minutes. */
export type PresenceFade = 'off' | number;

export interface RoomState {
  id: string;
  level_id: string | null;
  lit: boolean;
  /** A presence sensor of the room is on now. */
  presence: boolean;
  /** Seconds since the last motion ended (null while a sensor is on, or when no sensor ever reported). */
  presenceAge: number | null;
  /** The weight of the presence tint: 1 while on, stepping down over the window after the last motion, 0 after it
   * (and 0 whenever the fade is off and nothing is on). */
  presenceFade: number;
  /** The open openings on the room's boundary, sorted. */
  openings: string[];
  temperature: number | null;
  /** The entity the temperature came from. */
  temperatureSource: string | null;
  lock: string | null;
  alarm: string | null;
}
export interface LevelDots {
  /** The strongest presence fade of the level's rooms (and of its sensors outside any room). */
  presence: number;
  open: boolean;
  lit: boolean;
}
export interface RoomStateLayer {
  rooms: Record<string, RoomState>;
  /** Every open opening (sorted), whether or not a room claims it. */
  openOpenings: string[];
  levels: Record<string, LevelDots>;
}
export interface RoomStateInput {
  rooms: StateRoom[];
  entities: StateEntity[];
  openings: StateOpening[];
  lamps?: StateLamp[];
  /** The plan size in pixels (the aspect makes the tolerances isotropic). */
  size: [number, number];
  /** Milliseconds since the epoch. */
  now: number;
  fade: PresenceFade;
  /** Folds a null level id onto the floor's default level (studio-ops.defaultLevelId); identity when absent. */
  levelOf?: (id: string | null) => string;
}

/** The fade steps down in this many quantised steps over the window: the scene is rebuilt at most this often per
 * window, and the same `now` (to the step) gives the same description. */
export const PRESENCE_STEPS = 12;
export const DEFAULT_PRESENCE_FADE_MIN = 3;
/** An opening's gap midpoint this close to a room's boundary (plan-width units) belongs to the room. */
export const OPENING_ON_ROOM = 0.012;
/** A door / window sensor not bound to an opening claims the nearest opening within this distance (plan-width units). */
export const OPENING_NEAR = 0.02;
const PRESENCE_CLASSES: ReadonlySet<string> = new Set(['motion', 'occupancy', 'presence', 'moving']);
const OPENING_CLASSES: ReadonlySet<string> = new Set(['door', 'window', 'opening', 'garage_door', 'gate']);
const PRESENCE_WORDS = /motion|presence|occupancy|pir/;
const OPENING_WORDS = /door|window|gate|garage/;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A presence sensor: a binary_sensor with a presence device class (or a presence word in its id when it has none). */
export function isPresenceEntity(e: Pick<StateEntity, 'domain' | 'device_class' | 'id'>): boolean {
  if (e.domain !== 'binary_sensor') return false;
  return e.device_class ? PRESENCE_CLASSES.has(e.device_class) : PRESENCE_WORDS.test(e.id);
}
/** A door / window sensor: a binary_sensor with an opening device class (or an opening word in its id), a cover with
 * one, or a lock (Home Assistant's lock reports 'open' after lock.open). */
export function isOpeningEntity(e: Pick<StateEntity, 'domain' | 'device_class' | 'id'>): boolean {
  if (e.domain === 'lock') return true;
  if (e.domain === 'binary_sensor') return e.device_class ? OPENING_CLASSES.has(e.device_class) : OPENING_WORDS.test(e.id);
  if (e.domain === 'cover') return !!e.device_class && OPENING_CLASSES.has(e.device_class);
  return false;
}
/** A light: the light domain, or a switch anchored on the lights layer. */
export function isLightEntity(e: Pick<StateEntity, 'domain' | 'layer_id'>): boolean {
  return e.domain === 'light' || (e.domain === 'switch' && e.layer_id === 'lights');
}

/** The presence tint weight of one sensor: 1 while on; after it went off, the fade over the window in PRESENCE_STEPS
 * steps (ceil: the first step after the motion still shows the full tint); 0 past the window, with the fade off, or
 * without a last_changed. A last_changed in the future (clock skew) counts as now. */
export function presenceFade(state: string | null, lastChanged: string | null, now: number, fade: PresenceFade): number {
  if (state === 'on') return 1;
  if (state !== 'off' || fade === 'off' || !(fade > 0) || !lastChanged) return 0; // unknown / unavailable: nothing to fade from
  const t = Date.parse(lastChanged);
  if (!Number.isFinite(t)) return 0;
  const age = Math.max(0, now - t);
  const window = fade * 60_000;
  if (age >= window) return 0;
  return Math.ceil((1 - age / window) * PRESENCE_STEPS - 1e-9) / PRESENCE_STEPS; // the epsilon: 2/3 * 12 is 8.000…02 in floats
}

/** When the fade next steps down, in milliseconds from `now` (the screen's refresh cadence): the step length. */
export function presenceStepMs(fade: PresenceFade): number {
  return fade === 'off' || !(fade > 0) ? 0 : Math.max(1000, Math.round((fade * 60_000) / PRESENCE_STEPS));
}

/** The distance from a point to a polygon's boundary (0 inside), in plan-width units. */
function boundaryDistance(px: number, py: number, poly: { x: number; y: number }[], ky: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j].x;
    const ay = poly[j].y * ky;
    const bx = poly[i].x;
    const by = poly[i].y * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py * ky - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py * ky - (ay + dy * t)));
  }
  return best;
}

/** The room state layer of a floor for one instant (see the module note). Rooms with no entities get a quiet state;
 * an entity in no room still counts for its level's dots and for the open openings. */
export function roomStates(input: RoomStateInput): RoomStateLayer {
  const levelOf = input.levelOf ?? ((id: string | null) => id ?? '');
  const ky = input.size[0] > 0 && input.size[1] > 0 ? input.size[1] / input.size[0] : 1;
  const rooms = [...input.rooms].filter((r) => r.polygon.length >= 3).sort((a, b) => byId(a.id, b.id));
  const entities = [...input.entities].sort((a, b) => byId(a.id, b.id));
  const openings = [...input.openings].sort((a, b) => byId(a.id, b.id));
  const byEntity = new Map<string, StateOpening>();
  for (const o of openings) if (o.entity_id && !byEntity.has(o.entity_id)) byEntity.set(o.entity_id, o);

  // the open openings: a bound opening follows its entity; an unbound sensor claims the nearest opening on its level
  const open = new Set<string>();
  for (const e of entities) {
    if (!isOpeningEntity(e) || !isOpenState(e.state)) continue;
    const bound = byEntity.get(e.id);
    if (bound) {
      open.add(bound.id);
      continue;
    }
    let best: StateOpening | null = null;
    let bestD = OPENING_NEAR;
    for (const o of openings) {
      if (levelOf(o.level_id) !== levelOf(e.level_id)) continue;
      const d = Math.hypot(o.x - e.x, (o.y - e.y) * ky);
      if (d < bestD || (d === bestD && best && byId(o.id, best.id) < 0)) {
        best = o;
        bestD = d;
      }
    }
    if (best) open.add(best.id);
  }

  const levels: Record<string, LevelDots> = {};
  const dots = (level: string): LevelDots => (levels[level] ??= { presence: 0, open: false, lit: false });
  for (const o of openings) if (open.has(o.id)) dots(levelOf(o.level_id)).open = true;

  const out: Record<string, RoomState> = {};
  const claimed = new Set<string>();
  for (const r of rooms) {
    const level = levelOf(r.level_id);
    const inside = entities.filter((e) => levelOf(e.level_id) === level && pointInPolygon({ x: e.x, y: e.y }, r.polygon));
    for (const e of inside) claimed.add(e.id);
    const lampsOn = (input.lamps ?? []).some((l) => l.on && levelOf(l.level_id) === level && pointInPolygon({ x: l.x, y: l.y }, r.polygon));
    const lit = lampsOn || inside.some((e) => isLightEntity(e) && e.state === 'on');
    let presence = false;
    let fade = 0;
    let age: number | null = null;
    for (const e of inside) {
      if (!isPresenceEntity(e)) continue;
      if (e.state === 'on') presence = true;
      fade = Math.max(fade, presenceFade(e.state, e.last_changed, input.now, input.fade));
      if (e.state === 'off' && e.last_changed) {
        const t = Date.parse(e.last_changed);
        if (Number.isFinite(t)) {
          const s = Math.max(0, Math.round((input.now - t) / 1000));
          age = age === null ? s : Math.min(age, s);
        }
      }
    }
    if (presence) age = null;
    const climate = inside.filter((e) => e.domain === 'climate' && num(e.attributes?.current_temperature) !== null);
    const sensors = inside.filter((e) => e.domain === 'sensor' && e.device_class === 'temperature' && num(e.state) !== null);
    const src = climate[0] ?? sensors[0] ?? null;
    const temperature = src ? (src.domain === 'climate' ? num(src.attributes?.current_temperature) : num(src.state)) : null;
    const lock = inside.find((e) => e.domain === 'lock' && e.state !== null)?.state ?? null;
    const alarm = inside.find((e) => e.domain === 'alarm_control_panel' && e.state !== null)?.state ?? null;
    const mine = openings.filter((o) => open.has(o.id) && levelOf(o.level_id) === level && boundaryDistance(o.x, o.y, r.polygon, ky) <= OPENING_ON_ROOM).map((o) => o.id);
    out[r.id] = { id: r.id, level_id: r.level_id, lit, presence, presenceAge: age, presenceFade: fade, openings: mine, temperature: temperature === null ? null : Math.round(temperature * 10) / 10, temperatureSource: src?.id ?? null, lock, alarm };
    const d = dots(level);
    d.presence = Math.max(d.presence, fade);
    d.lit = d.lit || lit;
    d.open = d.open || mine.length > 0;
  }
  // a sensor in no room still lights its level's dot
  for (const e of entities) {
    if (claimed.has(e.id) || !isPresenceEntity(e)) continue;
    const d = dots(levelOf(e.level_id));
    d.presence = Math.max(d.presence, presenceFade(e.state, e.last_changed, input.now, input.fade));
  }
  return { rooms: out, openOpenings: [...open].sort(byId), levels };
}

/** The setting value as the model wants it: "off", or minutes (an unknown value gives the default). */
export function parsePresenceFade(value: unknown): PresenceFade {
  if (value === 'off') return 'off';
  const n = num(value);
  return n !== null && n > 0 ? n : DEFAULT_PRESENCE_FADE_MIN;
}

/** The temperature chip's text: one decimal at most, a degree sign, no trailing ".0". */
export function temperatureText(t: number): string {
  const r = Math.round(t * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}°`;
}
