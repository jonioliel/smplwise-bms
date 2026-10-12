/**
 * Pure logic of the native stations and doors screen (CR-036 slice S6): no DOM, no Lit, no network - the unit spec
 * (tests/unit-wiskey-stations.spec.ts) imports this module in Node. What lives here: the status words of a station, the
 * filters and the search, the counts, "seen" texts, the place tree (derived from Arx's own floors and areas), the announcement
 * targets, the read-only door program / code summaries, the call clock, the rights an operator's permissions give on this
 * screen, and the display policy (the administrator-changeable settings of the owner answers of 2026-10-12).
 */
import type { PanelState } from '../components/sw-state-panel';
import type { AccessStation, CallState, StationCodes, StationPrograms, StationProgram, WeekdayName, Period } from '../api/access-stations';
import type { DeviceTree } from '../api/devices';
import type { DisplayZone, IntercomFeedState, IntercomLock } from '../api/intercom';
import { fill, ws, type StationsText } from '../i18n/wiskey-stations';
import { offsetAt, UTC_ZONE } from './wiskey-format';

/** WisKey's own limit for an announcement, after collapsing whitespace (audio_tts.py). */
export const TTS_MAX = 500;
/** A call control's second tap must follow the first within this long ... */
export const ARM_MS = 4000;
/** ... and not sooner: a double-click / double-tap is one gesture, not a confirmation. */
export const ARM_MIN_MS = 500;
/** After a release with an unknown outcome, when the backend gave no `retry_after_s`: the longest the backend can hold the relay
 * (ha_client's 60 s call limit plus the 10 s hold after an unknown outcome). */
export const UNKNOWN_HOLD_FALLBACK_MS = 70_000;
/** The camera stills' own cadence (live-wall.ts re-busts its posters every 60 s, which is also the server cache's default). */
export const POSTER_MS = 60_000;
/** The reads' fallback poll while the change notices are down (WisKey's own panel polls `overview` every 30 s). */
export const POLL_MS = 30_000;

// ---------------------------------------------------------------- words and counts

export function plural(one: string, many: string, n: number): string {
  return n === 1 ? one : fill(many, { n });
}

/** "ב<name>" - with the maqaf before a name that does not start with a Hebrew letter ("ב־Main gate"). */
export function inPlace(name: string): string {
  const n = name.trim();
  return /^[֐-׿]/.test(n) ? `ב${n}` : `ב־${n}`;
}

export type StationStatus = 'offline' | 'ringing' | 'in_call' | 'ending' | 'online';

/** One word per station for the card's look: offline wins; an active call next; otherwise online. */
export function statusOf(s: Pick<AccessStation, 'online' | 'call_state'>): StationStatus {
  if (!s.online) return 'offline';
  if (s.call_state === 'ringing') return 'ringing';
  if (s.call_state === 'in_call') return 'in_call';
  if (s.call_state === 'ending') return 'ending';
  return 'online';
}

/** A call the operator may act on or at least sees: ringing or in a call (an offline station has none). */
export const isActiveCall = (s: Pick<AccessStation, 'online' | 'call_state'>): boolean => s.online && (s.call_state === 'ringing' || s.call_state === 'in_call');

/** The relays a release may name: only when WisKey says the station has an integrated lock. */
export const stationDoors = (s: Pick<AccessStation, 'lock_enabled' | 'locks'>): IntercomLock[] => (s.lock_enabled ? s.locks : []);

export interface Tally {
  total: number;
  online: number;
  active: number;
  ringing: number;
  doors: number;
}

export function tally(list: readonly Pick<AccessStation, 'online' | 'call_state' | 'lock_enabled' | 'locks'>[]): Tally {
  return {
    total: list.length,
    online: list.filter((s) => s.online).length,
    active: list.filter(isActiveCall).length,
    ringing: list.filter((s) => s.online && s.call_state === 'ringing').length,
    doors: list.reduce((n, s) => n + stationDoors(s).length, 0),
  };
}

export function subtitleOf(t: Tally, text: StationsText = ws()): string {
  if (t.total === 0) return text.stationsNone;
  return fill(text.subtitleCounts, { stations: plural(text.stationsOne, text.stationsMany, t.total), doors: plural(text.doorsOne, text.doorsMany, t.doors) });
}

// ---------------------------------------------------------------- filters and search

export type StationFilter = 'all' | 'online' | 'attention' | 'in_call';
export const STATION_FILTERS: readonly StationFilter[] = ['all', 'online', 'attention', 'in_call'];

/** Needs a look: offline, a sync that is waiting or failed (or unknown), or an error text the viewer may see. */
export function needsAttention(s: Pick<AccessStation, 'online' | 'sync_state' | 'errors'>): boolean {
  if (!s.online) return true;
  if (s.sync_state === 'pending' || s.sync_state === 'error' || s.sync_state === 'unknown') return true;
  return !!(s.errors && (s.errors.last_error || s.errors.scan_error));
}

export function matchesFilter(s: AccessStation, f: StationFilter): boolean {
  if (f === 'online') return s.online;
  if (f === 'attention') return needsAttention(s);
  if (f === 'in_call') return isActiveCall(s);
  return true;
}

export function matchesQuery(s: AccessStation, query: string, placeLabel = ''): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [s.name, placeLabel, s.technical?.model ?? ''].some((v) => v.toLocaleLowerCase().includes(q));
}

export function visibleStations(list: readonly AccessStation[], f: StationFilter, query: string, place: string, map: PlaceMap | null): AccessStation[] {
  return list.filter((s) => matchesFilter(s, f) && matchesQuery(s, query, placeLabelOf(s.id, map)) && inPlaceFilter(s.id, place, map));
}

// ---------------------------------------------------------------- the table's width tiers

/** A wide table scrolls inside its host, which hides exactly the columns at its end - so the table gives up its least needed
 * columns by the viewport instead: `full` (a wide desktop: every column), `medium` (a laptop: no door names, no model), `compact`
 * (a tablet: also no place, no call and no "last seen" column - a call that is on and the offline station's last sighting move under
 * its state). Who, whether it is up, a call that is on, the buttons and the sync state are in every tier. Measured with the
 * mock-up's stations: the full table needs about 1040 px of host. */
export type TableTier = 'full' | 'medium' | 'compact';
export const TABLE_COMPACT_MAX = 1100;
export const TABLE_MEDIUM_MAX = 1439;
export const tableTierOf = (viewport: number): TableTier => (viewport <= TABLE_COMPACT_MAX ? 'compact' : viewport <= TABLE_MEDIUM_MAX ? 'medium' : 'full');

// ---------------------------------------------------------------- "seen" and ages

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A short local stamp in `zone`: "HH:MM" for today, "yesterday HH:MM", else "DD.MM HH:MM". */
export function shortStamp(ms: number, nowMs: number, zone: DisplayZone = UTC_ZONE, text: StationsText = ws()): string {
  const local = (t: number) => new Date(t + offsetAt(t, zone) * 1000);
  const d = local(ms);
  const n = local(nowMs);
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  const day = (x: Date) => Math.floor(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) / 86_400_000);
  const dd = day(n) - day(d);
  if (dd === 0) return hm;
  if (dd === 1) return fill(text.seen.yesterday, { t: hm });
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)} ${hm}`;
}

const AWARE = /(Z|[+-][0-9]{2}:[0-9]{2})$/;

/** "now", "a minute ago" ... "yesterday 19:02" - the station's own clock zone for an older stamp. */
export function seenText(iso: string | null | undefined, nowMs: number, zone: DisplayZone | null, text: StationsText = ws()): string {
  const ms = iso && AWARE.test(iso) ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return text.seen.never;
  const diff = Math.max(0, nowMs - ms) / 1000;
  if (diff < 45) return text.seen.now;
  if (diff < 90) return text.seen.minute;
  if (diff < 3600) return fill(text.seen.minutes, { n: Math.round(diff / 60) });
  if (diff < 7200) return text.seen.hour;
  if (diff < 86_400) return fill(text.seen.hours, { n: Math.round(diff / 3600) });
  return shortStamp(ms, nowMs, zone ?? UTC_ZONE, text);
}

/** "4 min" / "2 hours" for the stale feed pill. */
export function ageText(iso: string | null | undefined, nowMs: number, text: StationsText = ws()): string {
  const ms = iso && AWARE.test(iso) ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return '';
  const s = Math.max(0, nowMs - ms) / 1000;
  if (s < 90) return fill(text.agoShort.seconds, { n: Math.max(1, Math.round(s)) });
  if (s < 5400) return fill(text.agoShort.minutes, { n: Math.round(s / 60) });
  if (s < 129_600) return fill(text.agoShort.hours, { n: Math.round(s / 3600) });
  return fill(text.agoShort.days, { n: Math.round(s / 86_400) });
}

/** "mm:ss" (hours folded in), the call clock's reading. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** The time a still was loaded, "HH:MM" in the browser's own clock (an observation of this screen, not WisKey's stamp). */
export function stillTime(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------------------------------------------------------------- the call clock

/** WisKey's `overview` carries no call start, so a duration counts from the first moment THIS screen saw the state (a reconnect
 * restarts it; a call already ringing when the screen opened shows the time since the screen saw it). */
export class CallClock {
  private since = new Map<string, { state: string; at: number }>();

  observe(stations: readonly Pick<AccessStation, 'id' | 'online' | 'call_state'>[], now: number): void {
    const seen = new Set<string>();
    for (const s of stations) {
      if (!isActiveCall(s)) continue;
      seen.add(s.id);
      const prev = this.since.get(s.id);
      if (!prev || prev.state !== s.call_state) this.since.set(s.id, { state: s.call_state, at: now });
    }
    for (const id of [...this.since.keys()]) if (!seen.has(id)) this.since.delete(id);
  }

  /** Whole seconds since the state was first seen, or null when the station has no active call. */
  seconds(id: string, now: number): number | null {
    const e = this.since.get(id);
    return e ? Math.max(0, Math.floor((now - e.at) / 1000)) : null;
  }

  get active(): boolean {
    return this.since.size > 0;
  }
}

// ---------------------------------------------------------------- places (derived from Arx's own floors and areas)

/** A place a station can be in: derived from the area of the station's camera entity (the Arx floors / areas tree), because the
 * authoritative station placement (CR-033 D2) is not part of this build. One function (`derivePlaces`) is the seam. */
export interface PlaceMap {
  floors: { id: string; name: string }[];
  areas: { id: string; name: string; floor: string | null }[];
  /** station id -> area id. A station absent here has no place. */
  byStation: Record<string, string>;
}

export function derivePlaces(
  stations: readonly Pick<AccessStation, 'id' | 'camera_entity'>[],
  tree: Pick<DeviceTree, 'floors'> | null | undefined,
  rows: readonly { entity_id: string; area_id: string | null }[] | null | undefined,
): PlaceMap | null {
  if (!tree || !rows) return null;
  const floors: PlaceMap['floors'] = [];
  const areas: PlaceMap['areas'] = [];
  for (const f of tree.floors ?? []) {
    const real = f.floor_id !== 'none';
    if (real) floors.push({ id: f.floor_id, name: f.name });
    for (const a of f.areas ?? []) areas.push({ id: a.area_id, name: a.name, floor: real ? f.floor_id : null });
  }
  const areaIds = new Set(areas.map((a) => a.id));
  const areaOf = new Map<string, string>();
  for (const r of rows) if (r.area_id && areaIds.has(r.area_id)) areaOf.set(r.entity_id, r.area_id);
  const byStation: Record<string, string> = {};
  for (const s of stations) {
    const a = s.camera_entity ? areaOf.get(s.camera_entity) : undefined;
    if (a) byStation[s.id] = a;
  }
  return Object.keys(byStation).length ? { floors, areas, byStation } : null;
}

const floorOfArea = (map: PlaceMap, areaId: string): string | null => map.areas.find((a) => a.id === areaId)?.floor ?? null;

/** "קומת קרקע · לובי" - the floor and the area of the station's place; '' when it has none. */
export function placeLabelOf(stationId: string, map: PlaceMap | null): string {
  if (!map) return '';
  const aid = map.byStation[stationId];
  const area = aid ? map.areas.find((a) => a.id === aid) : undefined;
  if (!area) return '';
  const floor = area.floor ? map.floors.find((f) => f.id === area.floor) : undefined;
  return floor ? `${floor.name} · ${area.name}` : area.name;
}

/** The place filter ids: 'all', `floor:<id>`, `area:<id>`, 'none' (a station with no place). */
export function inPlaceFilter(stationId: string, place: string, map: PlaceMap | null): boolean {
  if (place === 'all' || !map) return true;
  const aid = map.byStation[stationId];
  if (place === 'none') return !aid;
  if (!aid) return false;
  if (place.startsWith('area:')) return aid === place.slice(5);
  if (place.startsWith('floor:')) return floorOfArea(map, aid) === place.slice(6);
  return true;
}

export interface PlaceRow {
  id: string;
  kind: 'all' | 'floor' | 'area' | 'none';
  name: string;
  depth: 0 | 1;
  count: number;
  /** Every station there online / none / some. */
  dot: 'live' | 'off' | 'mixed' | null;
  open?: boolean;
}

const dotOf = (list: readonly Pick<AccessStation, 'online'>[]): PlaceRow['dot'] => (!list.length ? null : list.every((s) => s.online) ? 'live' : list.some((s) => s.online) ? 'mixed' : 'off');

/** The tree's rows: "all", then floors (collapsible) with their areas, then "no place". Places without a station are left out
 * (a scoped operator never sees a place with nothing of theirs in it). No rows at all when no station has a place. */
export function placeRows(stations: readonly Pick<AccessStation, 'id' | 'online'>[], map: PlaceMap | null, collapsed: ReadonlySet<string> = new Set(), text: StationsText = ws()): PlaceRow[] {
  if (!map || !stations.length) return [];
  const rows: PlaceRow[] = [{ id: 'all', kind: 'all', name: text.places.all, depth: 0, count: stations.length, dot: null }];
  const areaOf = (s: { id: string }) => map.byStation[s.id];
  const groups: { id: string; name: string; floor: string | null }[] = [...map.floors.map((f) => ({ id: f.id, name: f.name, floor: f.id })), { id: '', name: '', floor: null }];
  for (const g of groups) {
    const inFloor = stations.filter((s) => {
      const a = areaOf(s);
      return a !== undefined && floorOfArea(map, a) === g.floor;
    });
    if (!inFloor.length) continue;
    if (g.floor !== null) {
      const id = `floor:${g.floor}`;
      rows.push({ id, kind: 'floor', name: g.name, depth: 0, count: inFloor.length, dot: null, open: !collapsed.has(id) });
      if (collapsed.has(id)) continue;
    }
    for (const a of map.areas.filter((x) => x.floor === g.floor)) {
      const here = inFloor.filter((s) => areaOf(s) === a.id);
      if (here.length) rows.push({ id: `area:${a.id}`, kind: 'area', name: a.name, depth: g.floor === null ? 0 : 1, count: here.length, dot: dotOf(here) });
    }
  }
  const none = stations.filter((s) => !areaOf(s));
  if (none.length) rows.push({ id: 'none', kind: 'none', name: text.places.none, depth: 0, count: none.length, dot: dotOf(none) });
  return rows;
}

// ---------------------------------------------------------------- announcement targets

export interface TargetChoice {
  key: string;
  kind: 'station' | 'place' | 'all';
  label: string;
  stationIds: string[];
}

export type AnnounceScope = 'scope' | 'station';

/** The choices of the announcement dialog over the stations the caller sees (only online ones can speak): each station, the
 * places with more than one, and all of them - the last two only while the administrator allows more than one station (the
 * `access.announce_scope` setting; the owner's default allows them inside the operator's scope). The preselected station is first. */
export function announceChoices(online: readonly Pick<AccessStation, 'id' | 'name'>[], map: PlaceMap | null, scope: AnnounceScope, preselect?: string, text: StationsText = ws()): TargetChoice[] {
  const first = online.find((s) => s.id === preselect);
  const ordered = first ? [first, ...online.filter((s) => s.id !== first.id)] : [...online];
  const out: TargetChoice[] = ordered.map((s) => ({ key: `station:${s.id}`, kind: 'station', label: s.name, stationIds: [s.id] }));
  if (scope === 'station' || online.length < 2) return out;
  if (map) {
    const onlineIds = new Set(online.map((s) => s.id));
    for (const f of map.floors) {
      const ids = online.filter((s) => map.byStation[s.id] !== undefined && floorOfArea(map, map.byStation[s.id]) === f.id).map((s) => s.id);
      if (ids.length > 1) out.push({ key: `place:floor:${f.id}`, kind: 'place', label: fill(text.announceDlg.place, { name: f.name, n: ids.length }), stationIds: ids });
    }
    for (const a of map.areas) {
      const ids = Object.entries(map.byStation).filter(([sid, aid]) => aid === a.id && onlineIds.has(sid)).map(([sid]) => sid);
      if (ids.length > 1) out.push({ key: `place:area:${a.id}`, kind: 'place', label: fill(text.announceDlg.place, { name: a.name, n: ids.length }), stationIds: ids });
    }
  }
  out.push({ key: 'all', kind: 'all', label: fill(text.announceDlg.allStations, { n: online.length }), stationIds: online.map((s) => s.id) });
  return out;
}

export const collapseText = (message: string): string => message.split(/\s+/).filter(Boolean).join(' ');
export const ttsLength = (message: string): number => collapseText(message).length;
/** A guess of the spoken length: about 2.3 words a second, at least one second (Arx's own estimate; the engine decides). */
export function speechSeconds(message: string): number {
  const words = collapseText(message).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 2.3));
}

// ---------------------------------------------------------------- door settings (read only)

export const WEEK: readonly WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const periodsText = (p: readonly Period[] | undefined): string => (p ?? []).map((x) => `${x.start}–${x.end}`).join(', ');

/** The weekly windows of a program as short lines: consecutive days with the same windows are one range ("א׳–ה׳ 08:00–17:00"). */
export function weeklyLines(weekly: Partial<Record<WeekdayName, Period[]>> | null | undefined, text: StationsText = ws()): string[] {
  if (!weekly) return [];
  const per = WEEK.map((d) => periodsText(weekly[d]));
  if (per.every((p) => p === '')) return [];
  if (per.every((p) => p === per[0])) return [`${text.prog.allDays} ${per[0]}`];
  const out: string[] = [];
  let i = 0;
  while (i < per.length) {
    if (per[i] === '') {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < per.length && per[j + 1] === per[i]) j += 1;
    const from = text.days[WEEK[i]];
    const to = text.days[WEEK[j]];
    out.push(`${j === i ? from : `${from}–${to}`} ${per[i]}`);
    i = j + 1;
  }
  return out;
}

export interface ProgramView {
  /** The relay (physical index) this row is about. */
  door: number;
  name: string;
  /** No program at all for this door. */
  none: boolean;
  enabled: boolean;
  removing: boolean;
  /** Hebrew status word of the program's execution on the device ('' when there is no program). */
  status: string;
  hours: string[];
  holidays: number;
  error: boolean;
  /** The program has a policy whose windows the screen could not read: shown as "unknown". */
  unreadable: boolean;
}

export function doorName(lock: IntercomLock, text: StationsText = ws()): string {
  return lock.name?.trim() || `${text.door.defaultName} ${lock.physical_index}`;
}

/** One row per relay of the station: its program (view only) matched by the physical index. WisKey's shapes are W? until its W2
 * delivery, so everything is read defensively and an unmapped policy is "unknown", never invented. */
export function programViews(programs: StationPrograms | null | undefined, station: Pick<AccessStation, 'locks' | 'lock_enabled'>, text: StationsText = ws()): ProgramView[] {
  const list: StationProgram[] = programs?.programs ?? [];
  return stationDoors(station).map((lock) => {
    const p = list.find((x) => x.door === lock.physical_index);
    const base = { door: lock.physical_index, name: doorName(lock, text) };
    if (!p) return { ...base, none: true, enabled: false, removing: false, status: '', hours: [], holidays: 0, error: false, unreadable: false };
    const hours = weeklyLines(p.policy?.weekly, text);
    const state = p.execution?.status ?? 'unknown';
    return {
      ...base,
      none: false,
      enabled: !!p.enabled,
      removing: !!p.removing,
      status: text.prog.state[state] ?? text.prog.state.unknown,
      hours,
      holidays: p.policy?.holidays?.length ?? 0,
      error: !!p.error,
      unreadable: p.policy === null || p.policy === undefined,
    };
  });
}

/** Whether the station's public code is set - presence only, never a value: "set" / "not set" / "unknown". */
export function codesSummary(codes: StationCodes | null | undefined, text: StationsText = ws()): { label: string; state: 'set' | 'unset' | 'unknown'; slots: { label: string; state: 'set' | 'unset' | 'unknown' }[] } {
  if (!codes) return { label: text.prog.codeUnknown, state: 'unknown', slots: [] };
  const slot = (v: boolean | null | undefined): 'set' | 'unset' | 'unknown' => (v === true ? 'set' : v === false ? 'unset' : 'unknown');
  const slots = (codes.slots ?? []).map((s) => ({ label: fill(text.prog.codeSlot, { n: s.slot }), state: slot(s.configured) }));
  const state = codes.public_pin_state === 'configured' ? 'set' : codes.public_pin_state === 'absent' ? 'unset' : slots.some((s) => s.state === 'set') ? 'set' : slots.length && slots.every((s) => s.state === 'unset') ? 'unset' : 'unknown';
  const label = state === 'set' ? text.prog.codeConfigured : state === 'unset' ? text.prog.codeNotConfigured : text.prog.codeUnknown;
  return { label, state, slots };
}

// ---------------------------------------------------------------- rights and policy

/** The permissions' effect on this screen. TODAY the physical actions are gated by `access.release` at installation scope
 * (backend routers/access_control.py `_releaser_ro`): door release, call signal and the announcement all ride it, so the
 * controls follow it - a control the server would refuse is never offered. SLICE S11 moves the call and the announcement onto
 * `access.call` over the station chain (owner answer 6 of 2026-10-12: announcing is part of the call permission) and the doors
 * onto the CR-033 door authority; only this function changes then. */
export interface Rights {
  door: boolean;
  call: boolean;
  announce: boolean;
  talk: boolean;
}

export const NO_RIGHTS: Rights = { door: false, call: false, announce: false, talk: false };

export function rightsOf(has: (permission: string) => boolean, policy: StationsPolicy): Rights {
  const physical = has('access.release');
  return { door: physical, call: physical, announce: physical, talk: physical && policy.talk === 'classic' };
}

/** The administrator-changeable display decisions of the owner's answers of 2026-10-12 (product settings, the answer only sets the
 * default): who sees the incoming-call hint, whether the talk button is offered (in "talk in the classic panel" mode), whether an
 * announcement may target a place / all stations, and the quick phrases. The server's own filter still decides what data arrives. */
export interface StationsPolicy {
  /** `everyone`: the call hint shows on every station the viewer sees (answer 3); `call`: only for who may act on calls. */
  callHint: 'everyone' | 'call';
  /** `classic`: the talk button opens the classic panel (answer 8); `hidden`: no talk button. */
  talk: 'classic' | 'hidden';
  /** `scope`: "all stations" and a place are allowed inside the operator's scope (answer 7); `station`: one station only. */
  announceScope: AnnounceScope;
  /** Quick phrases (one per line in the setting); empty = the built-in ones. */
  phrases: string[];
}

export const POLICY_DEFAULTS: StationsPolicy = { callHint: 'everyone', talk: 'classic', announceScope: 'scope', phrases: [] };
export const POLICY_KEYS = { callHint: 'access.call_hint', talk: 'access.talk_button', announceScope: 'access.announce_scope', phrases: 'access.announce_phrases' } as const;
export const MAX_PHRASES = 8;
export const MAX_PHRASE_LENGTH = 160;

export function parsePolicy(settings: Record<string, unknown> | null | undefined): StationsPolicy {
  const get = (k: string): string => String(settings?.[k] ?? '');
  const phrases = get(POLICY_KEYS.phrases)
    .split(/\r?\n/)
    .map(collapseText)
    .filter((p) => p.length > 0 && p.length <= MAX_PHRASE_LENGTH)
    .slice(0, MAX_PHRASES);
  return {
    callHint: get(POLICY_KEYS.callHint) === 'call' ? 'call' : POLICY_DEFAULTS.callHint,
    talk: get(POLICY_KEYS.talk) === 'hidden' ? 'hidden' : POLICY_DEFAULTS.talk,
    announceScope: get(POLICY_KEYS.announceScope) === 'station' ? 'station' : POLICY_DEFAULTS.announceScope,
    phrases,
  };
}

export const phrasesOf = (policy: StationsPolicy, text: StationsText = ws()): readonly string[] => (policy.phrases.length ? policy.phrases : text.announceDlg.phraseList);

/** The call hint ("incoming call" / "in a call", no caller name) of a station card: for everyone who sees the station, or - when
 * the administrator narrowed it - for who may act on calls. */
export const showCallHint = (policy: StationsPolicy, rights: Rights): boolean => policy.callHint === 'everyone' || rights.call;

// ---------------------------------------------------------------- the classic panel (the iframe), the per-visit fallback

/** The link behind "talk in the classic panel": the embedded panel's entry center, forced for this visit even when the screen
 * is set to Arx (`?classic=1`, read by shell/nav.ts `wiskeyRoute`). It changes no setting. */
export const classicPanelHref = (): string => '#/wiskey/overview?classic=1';

// ---------------------------------------------------------------- feed states

export type FeedPanel = { panel: PanelState; heading: string; settings?: boolean };

/** The honest message for a feed state the screen cannot show stations in, without naming the platform. `ready` has none. */
export function feedPanel(state: Exclude<IntercomFeedState | 'unsupported', 'ready'>, text: StationsText = ws()): FeedPanel {
  switch (state) {
    case 'ha_not_configured':
      return { panel: 'stale', heading: text.states.notConfigured };
    case 'connecting':
      return { panel: 'loading', heading: text.states.connecting };
    case 'ha_unavailable':
      return { panel: 'stale', heading: text.states.unavailable };
    case 'not_installed':
      return { panel: 'empty', heading: text.states.notInstalled, settings: true };
    case 'forbidden':
      return { panel: 'forbidden', heading: text.states.denied };
    case 'unsupported':
      return { panel: 'empty', heading: text.states.unsupported };
    default:
      return { panel: 'error', heading: text.states.feedError };
  }
}

// ---------------------------------------------------------------- labels

export function callWord(state: CallState | string, text: StationsText = ws()): string {
  switch (state) {
    case 'ringing':
      return text.call.ringing;
    case 'in_call':
      return text.call.inCall;
    case 'ending':
      return text.call.ending;
    case 'idle':
      return text.call.idle;
    case 'unavailable':
      return text.call.unavailable;
    default:
      return text.status.unknown;
  }
}

export function syncWord(state: string, text: StationsText = ws()): string {
  return (text.sync as Record<string, string>)[state] ?? text.sync.unknown;
}

/** An announcement's progress in words (the POST reply, then `intercom_tts` notices): sent, preparing, playing, finished - and
 * "not verified" at the end, because nobody confirms the speaker was heard. A stop says why. */
export function ttsStateText(s: { state: string; reason: string | null }, text: StationsText = ws()): string {
  const t = text.announceDlg;
  switch (s.state) {
    case 'started':
      return t.progressStarted;
    case 'generating':
      return t.progressGenerating;
    case 'speaking':
      return t.progressSpeaking;
    case 'completed':
      return t.progressCompleted;
    default:
      return fill(t.progressClosed, { reason: (t.reasons as Record<string, string>)[s.reason ?? ''] ?? s.reason ?? '' });
  }
}

/** The sync pill's `sw-badge` kind: synced = live, waiting = stale, failed = error, offline, unknown. */
export function syncKind(state: string): 'live' | 'stale' | 'error' | 'offline' | 'unknown' {
  switch (state) {
    case 'synced':
      return 'live';
    case 'pending':
    case 'syncing':
      return 'stale';
    case 'error':
      return 'error';
    case 'offline':
      return 'offline';
    default:
      return 'unknown';
  }
}
