/**
 * CR-TIMESCRUB101: the pure logic of the historical map's time scrub (no Lit, no DOM, no fetch; node specs pin it):
 *
 * - the layers of the legend, their order, their default switches (presence OFF, CR section 7) and the per-browser memory;
 * - the state of an entity at an instant from the range's change-points (`seriesStateAt`): the last point at or before the
 *   instant, KNOWN only outside a gap, when no gap lies between that point and the instant (never carried across a gap),
 *   and when either a later change is recorded (in the range or `bounded_after`) or the instant is within the forward-fill
 *   limit of the point; before the first point the range's `initial`; a bucketed point marks "changed during";
 * - the states the plan replays (`replayFromSnapshot` / `replayFromRange`), then `drawnStates`: only KNOWN states of
 *   ENABLED and PERMITTED layers - everything else is an explicit null (drawn unknown, never "off", never the last value);
 * - the lanes of the timeline (`laneOf`): the spans where a layer was active, the "changed during" buckets and the
 *   change marks, per window;
 * - the legend's texts (status, coverage) and the gap at an instant.
 */
import { isOpenState } from './coverage';
import { isLightEntity, isOpeningEntity, isPresenceEntity } from './room-state';
import { pointInPolygon } from '../api/zones';
import type { HistoryCoverage, HistoryGap, HistoryRange, HistorySnapshot, LayerStatus, RangeSeries } from '../api/history-scrub';

/** The HA-entity layers (the server classifies the floor's anchored entities; each entity is in exactly one). */
export const ENTITY_LAYERS = ['lights', 'presence', 'openings', 'temperature', 'devices', 'alarm'] as const;
export type EntityLayerId = (typeof ENTITY_LAYERS)[number];
/** Every layer of the legend, in the legend's order. */
export const LAYER_IDS = ['lights', 'presence', 'openings', 'temperature', 'devices', 'alarm', 'elevators', 'cameras', 'events'] as const;
export type LayerId = (typeof LAYER_IDS)[number];
/** The layers a range request can carry. */
export const RANGE_LAYERS = ['lights', 'presence', 'openings', 'temperature', 'devices', 'alarm', 'elevators'] as const;
export type RangeLayerId = (typeof RANGE_LAYERS)[number];

export const LAYER_NAME: Record<LayerId, string> = {
  lights: 'תאורה',
  presence: 'נוכחות',
  openings: 'דלתות וחלונות',
  temperature: 'טמפרטורה',
  devices: 'התקנים',
  alarm: 'אזעקה',
  elevators: 'מעליות',
  cameras: 'מצלמות',
  events: 'אירועים',
};
/** The legend dot / lane colour of each layer (the product tokens the mockup uses). */
export const LAYER_COLOR: Record<LayerId, string> = {
  lights: 'var(--sw-map-lit)',
  presence: 'var(--sw-map-presence)',
  openings: 'var(--sw-tl-door)',
  temperature: 'var(--sw-map-temp)',
  devices: 'var(--sw-obj-electrical)',
  alarm: 'var(--sw-obj-safety)',
  elevators: 'var(--sw-obj-security)',
  cameras: 'var(--sw-recorded)',
  events: 'var(--sw-tl-motion)',
};

// ---- the switches of the legend ----

export type LayerSwitches = Record<LayerId, boolean>;
export const LAYER_STORAGE_KEY = 'sw.history.layers';

/** Every layer on, except presence (sensitive: off until the viewer turns it on, CR section 7). */
export function defaultSwitches(): LayerSwitches {
  const out = {} as LayerSwitches;
  for (const id of LAYER_IDS) out[id] = id !== 'presence';
  return out;
}

/** The remembered switches (a JSON object of booleans); anything unreadable or missing falls back to the default. */
export function parseSwitches(raw: string | null | undefined): LayerSwitches {
  const out = defaultSwitches();
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    for (const id of LAYER_IDS) {
      const b = (v as Record<string, unknown>)[id];
      if (typeof b === 'boolean') out[id] = b;
    }
  } catch {
    /* a damaged value: the defaults */
  }
  return out;
}

export function serializeSwitches(s: LayerSwitches): string {
  const o: Record<string, boolean> = {};
  for (const id of LAYER_IDS) o[id] = !!s[id];
  return JSON.stringify(o);
}

// ---- the legend's texts ----

export type StatusLook = 'ok' | 'unk' | 'warn' | 'lock';
/** The status text of a layer row and its look. */
export function layerStatusText(status: LayerStatus | null | undefined): { text: string; look: StatusLook } {
  switch (status) {
    case 'ok':
      return { text: 'ידוע', look: 'ok' };
    case 'empty':
      return { text: 'אין בקומה', look: 'unk' };
    case 'not_recorded':
      return { text: 'לא מוקלט', look: 'unk' };
    case 'gap':
      return { text: 'פער בהקלטה', look: 'warn' };
    case 'not_permitted':
      return { text: 'לא מורשה', look: 'lock' };
    default:
      return { text: 'לא ידוע', look: 'unk' };
  }
}

/** Days in Hebrew: "יום אחד", "7 ימים", "30 יום" (2..10 take the plural, 11 and up the singular). */
export function daysText(n: number): string {
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return n >= 3 && n <= 10 ? `${n} ימים` : `${n} יום`;
}

/** The coverage after the layer's name ("· 30 יום"); empty when the retention is unknown. */
export function coverageText(retentionDays: number | null | undefined): string {
  return typeof retentionDays === 'number' && retentionDays > 0 ? `· ${daysText(retentionDays)}` : '';
}

// ---- gaps ----

export interface MsGap {
  from: number;
  to: number;
}
export function gapsMs(gaps: readonly HistoryGap[] | null | undefined): MsGap[] {
  return (gaps ?? []).map((g) => ({ from: Date.parse(g.from), to: Date.parse(g.to) })).filter((g) => Number.isFinite(g.from) && Number.isFinite(g.to) && g.to > g.from).sort((a, b) => a.from - b.from);
}
/** The gap that contains `t` (from inclusive, to exclusive), if any. */
export function gapAt(gaps: readonly HistoryGap[] | null | undefined, t: number): HistoryGap | null {
  for (const g of gaps ?? []) {
    const a = Date.parse(g.from);
    const b = Date.parse(g.to);
    if (t >= a && t < b) return g;
  }
  return null;
}
const gapBetween = (gaps: readonly MsGap[], a: number, b: number): boolean => gaps.some((g) => g.to > a && g.from <= b);

// ---- the state of one series at an instant ----

export interface SeriesContext {
  /** The range's own bounds (ms). */
  from: number;
  to: number;
  gaps: readonly MsGap[];
  forwardFillMaxS: number;
  /** null = exact change-points. */
  bucketS: number | null;
}
export interface ReplayState {
  state: string | null;
  known: boolean;
  /** The instant of the change the state comes from (null before the first point / unknown). */
  changedAt: string | null;
  /** A bucketed range: the instant lies in a bucket with several changes (drawn "changed during"). */
  changedDuring: boolean;
  /** Why the state is unknown ('gap', 'forward_fill_exceeded', 'before_history', 'not_recorded'). */
  reason: string | null;
}

const UNKNOWN = (reason: string): ReplayState => ({ state: null, known: false, changedAt: null, changedDuring: false, reason });

/** The index of the last point at or before `t` (-1 = none); the points are sorted by time. */
export function lastPointIndex(points: readonly [string, string | null, number][], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Date.parse(points[mid][0]) <= t) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

/** The state of a series at `t` (module note). */
export function seriesStateAt(s: RangeSeries, t: number, ctx: SeriesContext): ReplayState {
  if (ctx.gaps.some((g) => t >= g.from && t < g.to)) return UNKNOWN('gap');
  const i = lastPointIndex(s.points, t);
  const later = i + 1 < s.points.length || s.bounded_after;
  const ff = Math.max(0, ctx.forwardFillMaxS) * 1000;
  if (i < 0) {
    if (!s.initial.known) return UNKNOWN('before_history');
    if (gapBetween(ctx.gaps, ctx.from, t)) return UNKNOWN('gap');
    if (!later && t - ctx.from > ff) return UNKNOWN('forward_fill_exceeded');
    return { state: s.initial.state, known: true, changedAt: null, changedDuring: false, reason: null };
  }
  const [ts, state, n] = s.points[i];
  const pt = Date.parse(ts);
  if (gapBetween(ctx.gaps, pt, t)) return UNKNOWN('gap');
  if (!later && t - pt > ff) return UNKNOWN('forward_fill_exceeded');
  const changedDuring = ctx.bucketS !== null && n > 1 && t < pt + ctx.bucketS * 1000;
  return { state, known: true, changedAt: ts, changedDuring, reason: null };
}

// ---- the replay of a floor ----

export interface ReplayElevator {
  name: string;
  state: string | null;
  known: boolean;
}
export interface FloorReplay {
  /** Entity id -> its state at the instant (every entity the server classified into a permitted layer). */
  entities: Record<string, ReplayState & { layer: EntityLayerId }>;
  elevators: Record<string, ReplayElevator>;
  /** The status of each layer at the instant ('gap' when the instant is inside a gap of the local history). */
  status: Partial<Record<LayerId, LayerStatus>>;
  retention: Partial<Record<LayerId, number | null>>;
  coverage: HistoryCoverage | null;
  source: 'snapshot' | 'range';
}

/** The replay of a snapshot (the server's own `state_at` per entity). */
export function replayFromSnapshot(snap: HistorySnapshot): FloorReplay {
  const entities: FloorReplay['entities'] = {};
  const status: FloorReplay['status'] = {};
  const retention: FloorReplay['retention'] = {};
  for (const id of ENTITY_LAYERS) {
    const l = snap.layers[id];
    if (!l) continue;
    status[id] = l.status;
    retention[id] = l.retention_days;
    if (l.status === 'not_permitted') continue; // no data, whatever came back
    for (const [eid, e] of Object.entries(l.entities ?? {})) {
      entities[eid] = { state: e.known ? e.state : null, known: !!e.known && e.state !== null, changedAt: e.changed_at, changedDuring: false, reason: e.known ? null : e.reason, layer: id };
    }
  }
  const elevators: FloorReplay['elevators'] = {};
  const el = snap.layers.elevators;
  if (el) {
    status.elevators = el.status;
    retention.elevators = el.retention_days;
    if (el.status !== 'not_permitted') for (const [id, it] of Object.entries(el.items ?? {})) elevators[id] = { name: it.name, state: it.known ? it.state : null, known: !!it.known && it.state !== null };
  }
  if (snap.layers.cameras) status.cameras = snap.layers.cameras.status;
  if (snap.layers.events) {
    status.events = snap.layers.events.status;
    retention.events = snap.layers.events.retention_days;
  }
  return { entities, elevators, status, retention, coverage: snap.coverage ?? null, source: 'snapshot' };
}

/** The replay of `t` computed locally from a range (playback; never a request per frame). The camera / event statuses
 * come from `base` (the last snapshot), the range does not carry them. */
export function replayFromRange(range: HistoryRange, t: number, base?: FloorReplay | null): FloorReplay {
  const ctx: SeriesContext = { from: Date.parse(range.from), to: Date.parse(range.to), gaps: gapsMs(range.coverage?.gaps), forwardFillMaxS: range.coverage?.forward_fill_max_s ?? 86400, bucketS: range.bucket_s };
  const inGap = !!gapAt(range.coverage?.gaps, t);
  const entities: FloorReplay['entities'] = {};
  const status: FloorReplay['status'] = { ...(base?.status ?? {}) };
  const retention: FloorReplay['retention'] = { ...(base?.retention ?? {}) };
  for (const id of ENTITY_LAYERS) {
    const l = range.layers[id];
    if (!l) continue;
    status[id] = l.status === 'ok' && inGap ? 'gap' : l.status;
    retention[id] = l.retention_days;
    if (l.status === 'not_permitted') continue;
    for (const [eid, s] of Object.entries(l.entities ?? {})) entities[eid] = { ...seriesStateAt(s, t, ctx), layer: id };
  }
  const elevators: FloorReplay['elevators'] = {};
  const el = range.layers.elevators;
  if (el) {
    status.elevators = el.status === 'ok' && inGap ? 'gap' : el.status;
    retention.elevators = el.retention_days;
    if (el.status !== 'not_permitted') {
      for (const [id, it] of Object.entries(el.items ?? {})) {
        const r = seriesStateAt(it, t, ctx);
        elevators[id] = { name: it.name, state: r.known ? r.state : null, known: r.known };
      }
    }
  }
  return { entities, elevators, status, retention, coverage: range.coverage ?? null, source: 'range' };
}

/** The layer an anchored entity belongs to, mirroring the server's classification (used only for entities the replay did
 * not name, e.g. those of a locked layer, so their markers can be drawn per layer). */
export function classifyEntity(e: { id: string; domain: string; device_class: string | null; layer_id?: string | null }): EntityLayerId {
  if (isPresenceEntity(e)) return 'presence';
  if (isOpeningEntity(e)) return 'openings';
  if (isLightEntity(e)) return 'lights';
  if (e.domain === 'sensor' && e.device_class === 'temperature') return 'temperature';
  if (e.domain === 'alarm_control_panel') return 'alarm';
  return 'devices';
}

/** A layer draws data: switched on and not locked. */
export function layerDraws(id: LayerId, switches: LayerSwitches, status: Partial<Record<LayerId, LayerStatus>>): boolean {
  return !!switches[id] && status[id] !== 'not_permitted';
}

/** The states the plan draws: entity id -> state for KNOWN states of enabled, permitted layers; an explicit null for every
 * other id in `ids` (unknown contributes nothing; a switched-off layer draws nothing). */
export function drawnStates(replay: FloorReplay | null, switches: LayerSwitches, ids: readonly string[]): { states: Record<string, string | null>; lastChanged: Record<string, string | null> } {
  const states: Record<string, string | null> = {};
  const lastChanged: Record<string, string | null> = {};
  for (const id of [...ids].sort()) {
    const e = replay?.entities[id];
    const ok = !!e && e.known && layerDraws(e.layer, switches, replay?.status ?? {});
    states[id] = ok ? e.state : null;
    lastChanged[id] = ok ? e.changedAt : null;
  }
  return { states, lastChanged };
}

// ---- counts for the "at the instant" card ----

/** How many rooms have at least one entity with a drawn (known) state inside, of all rooms. */
export function roomsKnown(rooms: readonly { polygon: { x: number; y: number }[]; level_id?: string | null }[], entities: readonly { x: number; y: number; level_id?: string | null; state: string | null }[], levelOf: (id: string | null) => string = (id) => id ?? ''): { known: number; total: number } {
  const valid = rooms.filter((r) => r.polygon.length >= 3);
  let known = 0;
  for (const r of valid) {
    const lv = levelOf(r.level_id ?? null);
    if (entities.some((e) => e.state !== null && levelOf(e.level_id ?? null) === lv && pointInPolygon({ x: e.x, y: e.y }, r.polygon))) known++;
  }
  return { known, total: valid.length };
}

// ---- the lanes ----

export interface LaneSpan {
  /** ms */
  from: number;
  to: number;
  kind: 'on' | 'changed';
}
export interface Lane {
  id: LayerId;
  label: string;
  color: string;
  /** The layer is switched off or locked: drawn dimmed. */
  off: boolean;
  locked: boolean;
  spans: LaneSpan[];
  /** Instants of recorded changes (ms), at most one per pixel bucket of the caller's choosing. */
  marks: number[];
}

/** A state counts as "active" on its layer's lane: a light on, a sensor on, an opening open, a panel armed / triggered,
 * an elevator not in normal service. Devices and temperature have no active state: their lane shows changes only. */
export function activeState(layer: RangeLayerId, state: string | null): boolean {
  if (state === null) return false;
  switch (layer) {
    case 'lights':
    case 'presence':
      return state === 'on';
    case 'openings':
      return isOpenState(state) || state === 'unlocked';
    case 'alarm':
      return state.startsWith('armed') || state === 'triggered' || state === 'pending' || state === 'arming';
    case 'elevators':
      return state !== 'ok';
    default:
      return false;
  }
}

function union(spans: LaneSpan[]): LaneSpan[] {
  const out: LaneSpan[] = [];
  for (const kind of ['on', 'changed'] as const) {
    const list = spans.filter((s) => s.kind === kind).sort((a, b) => a.from - b.from);
    for (const s of list) {
      const last = out.length && out[out.length - 1].kind === kind ? out[out.length - 1] : null;
      if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
      else out.push({ ...s });
    }
  }
  return out;
}

/** The spans (active / changed during) and the change marks of one series inside [winFrom, winTo] (ms). Known states
 * only: a gap or an exceeded forward fill cuts a span. */
export function seriesSpans(layer: RangeLayerId, s: RangeSeries, winFrom: number, winTo: number, ctx: SeriesContext): { spans: LaneSpan[]; marks: number[] } {
  const spans: LaneSpan[] = [];
  const marks: number[] = [];
  // the boundaries where the state may change: the window start, every point, every gap edge, every forward-fill expiry
  const cuts = new Set<number>([winFrom, winTo]);
  const ff = Math.max(0, ctx.forwardFillMaxS) * 1000;
  for (const [ts, , n] of s.points) {
    const t = Date.parse(ts);
    if (t >= winFrom && t <= winTo) {
      cuts.add(t);
      if (n > 0) marks.push(t);
    }
    if (t + ff > winFrom && t + ff < winTo) cuts.add(t + ff);
    if (ctx.bucketS !== null && n > 1) {
      const a = Math.max(winFrom, t);
      const b = Math.min(winTo, t + ctx.bucketS * 1000);
      if (b > a) spans.push({ from: a, to: b, kind: 'changed' });
    }
  }
  if (ctx.from + ff > winFrom && ctx.from + ff < winTo) cuts.add(ctx.from + ff);
  for (const g of ctx.gaps) {
    if (g.from > winFrom && g.from < winTo) cuts.add(g.from);
    if (g.to > winFrom && g.to < winTo) cuts.add(g.to);
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b <= a) continue;
    const st = seriesStateAt(s, a, ctx);
    if (st.known && activeState(layer, st.state)) spans.push({ from: a, to: b, kind: 'on' });
  }
  return { spans, marks };
}

/** The lane of one layer of a range for the window [winFrom, winTo] (ms). */
export function laneOf(range: HistoryRange | null, layer: RangeLayerId, winFrom: number, winTo: number, switches: LayerSwitches, status: Partial<Record<LayerId, LayerStatus>>): Lane {
  const locked = status[layer] === 'not_permitted' || (!!range && (layer === 'elevators' ? range.layers.elevators : range.layers[layer])?.status === 'not_permitted');
  const lane: Lane = { id: layer, label: LAYER_NAME[layer], color: LAYER_COLOR[layer], off: !switches[layer] || locked, locked, spans: [], marks: [] };
  if (!range || locked) return lane;
  const ctx: SeriesContext = { from: Date.parse(range.from), to: Date.parse(range.to), gaps: gapsMs(range.coverage?.gaps), forwardFillMaxS: range.coverage?.forward_fill_max_s ?? 86400, bucketS: range.bucket_s };
  const series: RangeSeries[] = layer === 'elevators' ? Object.values(range.layers.elevators?.items ?? {}) : Object.values(range.layers[layer]?.entities ?? {});
  const all: LaneSpan[] = [];
  const marks: number[] = [];
  for (const s of series) {
    const r = seriesSpans(layer, s, winFrom, winTo, ctx);
    all.push(...r.spans);
    marks.push(...r.marks);
  }
  lane.spans = union(all);
  lane.marks = [...new Set(marks)].sort((a, b) => a - b);
  return lane;
}

/** The gaps clipped to a window (ms), for the hatched bands. */
export function gapsInWindow(gaps: readonly HistoryGap[] | null | undefined, winFrom: number, winTo: number): MsGap[] {
  return gapsMs(gaps).filter((g) => g.to > winFrom && g.from < winTo).map((g) => ({ from: Math.max(winFrom, g.from), to: Math.min(winTo, g.to) }));
}

// ---- playback ----

export const SPEEDS = [1, 10, 60, 600] as const;
export type Speed = (typeof SPEEDS)[number];

/** One playback step: `realMs` of wall time at `speed` (seconds of history per second), stopping at `endMs`. */
export function advance(t: number, realMs: number, speed: number, endMs: number): { t: number; ended: boolean } {
  const next = t + Math.max(0, realMs) * speed;
  return next >= endMs ? { t: endMs, ended: true } : { t: next, ended: false };
}
