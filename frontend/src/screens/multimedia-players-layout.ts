/**
 * CR-016 (S2): the PURE part of the players and groups pages (no DOM, no network; unit-tested by
 * tests/unit-media-players-layout.spec.ts): the players tab's filters, how the layout of a tab is read and written (one layout
 * document with a `tabs` dimension), how the players are grouped into sections (floors, rooms, one list, "לא משויכים" last,
 * floors-less installations), the groups tab's helpers (kinds of group, live / running state of a saved group, outcomes by room,
 * the editor's candidates) and the settings screen's small parsers (ceiling, night window).
 *
 * The layout editor's operations are the CR-015 ones (./multimedia-layout.ts, `MediaLayout` in, `MediaLayout` out): a tab's
 * layout is turned into that shape (`tabView`), edited, and written back (`withTabView`), so order / pin / hide work exactly as
 * on the screens page. The wire shape of the `tabs` dimension is the one MEDIA_PLAYERS_API.md leaves open ("one layout document,
 * `tabs: {screens, players, groups}`"): `screens` stays the document's own top level (0.1.149 layouts keep working), the new tabs
 * are `tabs.players` / `tabs.groups` (see TabLayout).
 */
import type { CardGroup, GroupBy, MediaDevice, MediaLayout } from '../api/media-screens';
import { DEFAULT_CARD } from '../api/media-screens';
import {
  ALL_ROOMS_LABEL, GROUPABLE_KINDS, OUTCOME_FAILED, UNPLACED_LABEL, isPlaying, liveGroupKeys, matchesState,
  type GroupPreset, type GroupRecord, type MediaGroup, type MemberOutcome, type PlayerDevice, type PlayerStateFilter,
} from '../api/media-players';
import type { FloorRef } from './multimedia-layout';

// ------------------------------------------------------------------------------------------------ the layout of a tab

export type PlayerTab = 'players' | 'groups';

/** One tab's layout: how its cards are grouped, their order, the "מועדפים" row and which are hidden (only `on: false` is written). The server stores each
 * tab as a full layout (`MediaLayout` without `version`): it fills `floor_order` and every card's `size` / `phone_on` / `phone_size` on write, and the page reads
 * back what it needs (`on`); the floors' order of these tabs is the document's own `floor_order`. */
export interface TabLayout {
  group_by: GroupBy;
  order: string[];
  pinned: string[];
  cards: Record<string, { on: boolean }>;
  floor_order?: string[];
}
/** The layout document as 0.1.150 reads and writes it: the 0.1.149 document plus the `tabs` dimension. */
export type TabbedLayout = MediaLayout & { tabs?: Partial<Record<PlayerTab, TabLayout>> };

export const EMPTY_TAB: TabLayout = { group_by: 'floor', order: [], pinned: [], cards: {} };

/** A tab of the document, normalised (a missing tab is the default one). Never shares arrays with the document. */
export function tabOf(layout: Pick<TabbedLayout, 'tabs'> | null | undefined, tab: PlayerTab): TabLayout {
  const t = layout?.tabs?.[tab];
  return { group_by: t?.group_by ?? 'floor', order: [...(t?.order ?? [])], pinned: [...(t?.pinned ?? [])], cards: Object.fromEntries(Object.entries(t?.cards ?? {}).map(([k, c]) => [k, { on: c.on !== false }])) };
}

/** The tab as the CR-015 editor's `MediaLayout` (cards the tab does not name are shown). `floorOrder` is the order the floors follow. */
export function tabView(layout: Pick<TabbedLayout, 'tabs'> | null | undefined, tab: PlayerTab, floorOrder: readonly string[] = []): MediaLayout {
  const t = tabOf(layout, tab);
  return {
    version: 1, group_by: t.group_by, floor_order: [...floorOrder], pinned: t.pinned, order: t.order,
    cards: Object.fromEntries(Object.entries(t.cards).map(([k, c]) => [k, { ...DEFAULT_CARD, on: c.on }])),
  };
}

/** The document with the edited view written back as the tab (only hidden cards are stored; the rest of the document is untouched). */
export function withTabView(layout: TabbedLayout, tab: PlayerTab, view: MediaLayout): TabbedLayout {
  const cards: TabLayout['cards'] = {};
  for (const [k, c] of Object.entries(view.cards)) if (!c.on) cards[k] = { on: false };
  const next: TabLayout = { group_by: view.group_by, order: [...view.order], pinned: [...view.pinned], cards };
  return { ...layout, tabs: { ...layout.tabs, [tab]: next } };
}

/** The tab differs from the default one. */
export const tabIsDefault = (t: TabLayout): boolean => JSON.stringify(t) === JSON.stringify(EMPTY_TAB);

/** The editor's devices are the screens page's `MediaDevice`s as far as the layout operations care (key, name, floor, area). */
export const asLayoutDevices = (devices: readonly PlayerDevice[]): MediaDevice[] => devices as unknown as MediaDevice[];

// ------------------------------------------------------------------------------------------------ filters (the address)

export interface PlayerFilters {
  /** An HA floor id; `none` = the devices without a room; '' = all floors. */
  floor: string;
  /** A room id; `none` = "ללא חדר"; '' = all rooms. */
  area: string;
  q: string;
  state: '' | PlayerStateFilter;
}
export const PLAYER_NO_FILTER: PlayerFilters = { floor: '', area: '', q: '', state: '' };
export const PLAYER_STATE_FILTERS: { id: '' | PlayerStateFilter; label: string }[] = [
  { id: '', label: 'הכל' }, { id: 'playing', label: 'מנגנים' }, { id: 'off', label: 'שקטים' }, { id: 'unavailable', label: 'לא זמינים' },
];

export const playerFiltersActive = (f: PlayerFilters): boolean => !!(f.floor || f.area || f.q.trim() || f.state);

export function playerFiltersFromParams(p: URLSearchParams): PlayerFilters {
  const st = p.get('state');
  return { floor: p.get('floor') ?? '', area: p.get('area') ?? '', q: p.get('q') ?? '', state: st === 'playing' || st === 'off' || st === 'unavailable' ? st : '' };
}

/** The query the filters make (only what is set), merged into the route's other parameters by the caller. */
export function playerFiltersToParams(f: PlayerFilters, into: URLSearchParams = new URLSearchParams()): URLSearchParams {
  for (const k of ['floor', 'area', 'q', 'state'] as const) into.delete(k);
  if (f.floor) into.set('floor', f.floor);
  if (f.area) into.set('area', f.area);
  if (f.q.trim()) into.set('q', f.q.trim());
  if (f.state) into.set('state', f.state);
  return into;
}

export function matchesPlayerFilters(d: PlayerDevice, f: PlayerFilters): boolean {
  if (f.floor === UNPLACED_ID ? d.area_id !== null : f.floor === NOFLOOR_ID ? d.area_id === null || d.floor_id !== null : !!f.floor && d.floor_id !== f.floor) return false;
  if (f.area === UNPLACED_ID ? d.area_id !== null : !!f.area && d.area_id !== f.area) return false;
  if (!matchesState(d, f.state || null)) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !`${d.name} ${d.area_name ?? ''} ${d.floor_name ?? ''}`.toLowerCase().includes(q)) return false;
  return true;
}
export const filterPlayers = (devices: readonly PlayerDevice[], f: PlayerFilters): PlayerDevice[] => devices.filter((d) => matchesPlayerFilters(d, f));

export interface PlayerCounts {
  total: number;
  playing: number;
  unavailable: number;
}
export function playerCounts(devices: readonly PlayerDevice[]): PlayerCounts {
  return { total: devices.length, playing: devices.filter(isPlaying).length, unavailable: devices.filter((d) => d.live.power === 'unavailable').length };
}

/** The floors of the players (the layout's order, then first seen) for the floor menu; the unplaced are counted apart (the menu's last row). */
export function playerFloors(devices: readonly PlayerDevice[], floorOrder: readonly string[] = []): { floors: FloorRef[]; unplaced: number } {
  const map = new Map<string, FloorRef>();
  let unplaced = 0;
  for (const d of devices) {
    if (d.area_id === null) {
      unplaced += 1;
      continue;
    }
    const id = d.floor_id ?? NOFLOOR_ID;
    const f = map.get(id) ?? { id, name: d.floor_name ?? NO_FLOOR_LABEL, count: 0 };
    f.count += 1;
    map.set(id, f);
  }
  const rank = new Map(floorOrder.map((id, i) => [id, i]));
  const first = new Map([...map.keys()].map((id, i) => [id, i]));
  const floors = [...map.values()].sort((a, b) => {
    const ra = rank.get(a.id) ?? (a.id === NOFLOOR_ID ? 2e6 : 1e6);
    const rb = rank.get(b.id) ?? (b.id === NOFLOOR_ID ? 2e6 : 1e6);
    return ra - rb || (first.get(a.id) ?? 0) - (first.get(b.id) ?? 0);
  });
  return { floors, unplaced };
}

/** Whether the installation has floors at all (the server says so in `status.floors`; the devices say the same when it is absent). */
export const installationHasFloors = (status: { floors?: boolean } | null, devices: readonly PlayerDevice[]): boolean => status?.floors ?? devices.some((d) => d.floor_id !== null);

// ------------------------------------------------------------------------------------------------ sections

export interface PlayerGroup {
  /** `pinned`, a floor / room id, `all`, `nofloor`, or `none` (the unplaced bucket, always last). */
  id: string;
  label: string;
  devices: PlayerDevice[];
}
/** Section / filter ids: the unplaced bucket (no room) and the rooms that have no floor in an installation that has floors. */
export const UNPLACED_ID = 'none';
export const NOFLOOR_ID = 'nofloor';
export const PINNED_LABEL = 'מועדפים';
export const NO_FLOOR_LABEL = 'ללא קומה';
export const ALL_PLAYERS_LABEL = 'כל הנגנים';

/**
 * The players tab's sections: "מועדפים" first, then by floor / room / one list as the layout says, with "לא משויכים" (no room)
 * always last and out of the floors. An installation without floors groups by room (CR §7.1): `group_by: 'floor'` degrades to one
 * list "כל החדרים" (the room chips are the filter). Hidden cards are dropped; devices the layout does not know yet go last in their
 * group in the order the server listed them.
 */
export function resolvePlayerGroups(devices: readonly PlayerDevice[], view: MediaLayout, o: { floors: boolean; floorOrder?: readonly string[] }): PlayerGroup[] {
  const cfg = (k: string) => view.cards[k] ?? DEFAULT_CARD;
  const shown = devices.filter((d) => cfg(d.key).on);
  const rank = new Map(view.order.map((k, i) => [k, i]));
  // devices the layout does not name keep the server's order (the list the page was given)
  const seen = new Map(devices.map((d, i) => [d.key, i]));
  const byOrder = (a: PlayerDevice, b: PlayerDevice) => (rank.get(a.key) ?? 1e6) - (rank.get(b.key) ?? 1e6) || (seen.get(a.key) ?? 0) - (seen.get(b.key) ?? 0);
  const out: PlayerGroup[] = [];
  const pinned = view.pinned.map((k) => shown.find((d) => d.key === k)).filter((d): d is PlayerDevice => !!d);
  if (pinned.length) out.push({ id: 'pinned', label: PINNED_LABEL, devices: pinned });
  const rest = shown.filter((d) => !view.pinned.includes(d.key)).sort(byOrder);
  const by: GroupBy | 'all' = view.group_by === 'floor' && !o.floors ? 'all' : view.group_by;
  const placed = by === 'none' ? rest : rest.filter((d) => d.area_id !== null);
  const unplaced = by === 'none' ? [] : rest.filter((d) => d.area_id === null);
  if (by === 'none') {
    if (placed.length) out.push({ id: 'all', label: ALL_PLAYERS_LABEL, devices: placed });
  } else if (by === 'all') {
    if (placed.length) out.push({ id: 'all', label: ALL_ROOMS_LABEL, devices: placed });
  } else if (by === 'area') {
    const ids = [...new Set(placed.map((d) => d.area_id as string))];
    for (const id of ids) {
      const ds = placed.filter((d) => d.area_id === id);
      out.push({ id, label: ds[0].area_name ?? id, devices: ds });
    }
  } else {
    const ids = [...new Set(placed.map((d) => d.floor_id ?? NOFLOOR_ID))];
    const fr = new Map((o.floorOrder ?? view.floor_order).map((f, i) => [f, i]));
    ids.sort((a, b) => (fr.get(a) ?? (a === NOFLOOR_ID ? 2e6 : 1e6)) - (fr.get(b) ?? (b === NOFLOOR_ID ? 2e6 : 1e6)));
    for (const id of ids) {
      const ds = placed.filter((d) => (d.floor_id ?? NOFLOOR_ID) === id);
      out.push({ id, label: id === NOFLOOR_ID ? NO_FLOOR_LABEL : ds[0].floor_name ?? id, devices: ds });
    }
  }
  if (unplaced.length) out.push({ id: 'none', label: UNPLACED_LABEL, devices: unplaced });
  return out;
}

/** The sections as the screens page's `CardGroup`s (what the CR-015 editor lists, hidden cards included). */
export function editPlayerGroups(devices: readonly PlayerDevice[], view: MediaLayout, o: { floors: boolean; floorOrder?: readonly string[] }): PlayerGroup[] {
  const all: MediaLayout = { ...view, cards: Object.fromEntries(devices.map((d) => [d.key, { ...(view.cards[d.key] ?? DEFAULT_CARD), on: true }])) };
  return resolvePlayerGroups(devices, all, o);
}
export const asCardGroups = (g: readonly PlayerGroup[]): CardGroup[] => g.map((x) => ({ id: x.id, label: x.label, items: x.devices.map((d) => ({ device: d as unknown as MediaDevice, size: 'm' as const })) }));

/** Whether a section is a floor (it may offer "עצור מוזיקה") rather than a room, the unplaced bucket or a free list. */
export const isFloorSection = (g: Pick<PlayerGroup, 'id'>, groupBy: GroupBy, floors: boolean): boolean =>
  floors && groupBy === 'floor' && g.id !== 'pinned' && g.id !== 'all' && g.id !== UNPLACED_ID && g.id !== NOFLOOR_ID;

// ------------------------------------------------------------------------------------------------ the groups tab

export type GroupType = 'live' | 'static' | 'helper';

/** A group of `GET /multimedia/groups`: live (the leader's members), static (a device of kind `group`) or a helper shortcut (a
 * `group` helper entity: a fan-out with no grouping of its own, CR §5.3 - its device is not in the players list at all). */
export function groupTypeOf(g: Pick<MediaGroup, 'static' | 'leader_key'>, byKey: ReadonlyMap<string, Pick<PlayerDevice, 'kind'>>): GroupType {
  if (!g.static) return 'live';
  return byKey.get(g.leader_key)?.kind === 'group' ? 'static' : 'helper';
}
export function splitGroups(groups: readonly MediaGroup[], devices: readonly PlayerDevice[]): { live: MediaGroup[]; static: MediaGroup[]; helpers: MediaGroup[] } {
  const by = new Map(devices.map((d) => [d.key, d]));
  return {
    live: groups.filter((g) => groupTypeOf(g, by) === 'live'),
    static: groups.filter((g) => groupTypeOf(g, by) === 'static'),
    helpers: groups.filter((g) => groupTypeOf(g, by) === 'helper'),
  };
}

/** "קבוצה כזו כבר פועלת": the preset's leader leads a live group whose rooms are exactly the preset's. */
export function presetIsLive(p: Pick<GroupPreset, 'leader_key' | 'member_keys'>, devices: readonly PlayerDevice[]): boolean {
  const leader = devices.find((d) => d.key === p.leader_key);
  if (!leader || leader.live.group.role !== 'leader') return false;
  const live = new Set(liveGroupKeys(leader.live.group, leader.key));
  const want = new Set([p.leader_key, ...p.member_keys]);
  return live.size === want.size && [...want].every((k) => live.has(k));
}

/** The room names of a saved group, leader first. */
export function presetRooms(p: Pick<GroupPreset, 'leader_key' | 'member_keys'>, devices: readonly PlayerDevice[]): { key: string; room: string; missing: boolean }[] {
  const by = new Map(devices.map((d) => [d.key, d]));
  const keys = [...new Set([p.leader_key, ...p.member_keys])];
  return keys.map((k) => {
    const d = by.get(k);
    return { key: k, room: d ? d.area_name || d.name : 'לא מוגדר', missing: !d };
  });
}

/** The floors a saved group spans (devices without a floor do not count, like the party rule). */
export const presetFloors = (p: Pick<GroupPreset, 'leader_key' | 'member_keys'>, devices: readonly PlayerDevice[]): number =>
  new Set([p.leader_key, ...p.member_keys].map((k) => devices.find((d) => d.key === k)?.floor_id).filter((f): f is string => !!f)).size;

export interface RunSummary {
  done: boolean;
  /** Rooms that did not make it (not_joined / unknown / not_allowed), by name. */
  failed: { key: string; room: string; outcome: MemberOutcome }[];
  ok: { key: string; room: string }[];
}
/** A group record read as the groups page shows it: who joined, who did not, by room name ("פרגולה לא הצטרף"). */
export function summarizeRecord(rec: Pick<GroupRecord, 'status' | 'members'> | null): RunSummary {
  if (!rec) return { done: false, failed: [], ok: [] };
  const room = (m: GroupRecord['members'][number]) => m.area_name ?? m.device_key;
  return {
    done: rec.status === 'done',
    failed: rec.members.filter((m) => OUTCOME_FAILED.includes(m.outcome)).map((m) => ({ key: m.device_key, room: room(m), outcome: m.outcome })),
    ok: rec.members.filter((m) => !OUTCOME_FAILED.includes(m.outcome)).map((m) => ({ key: m.device_key, room: room(m) })),
  };
}

// ------------------------------------------------------------------------------------------------ the saved group's editor

export const PRESET_NAME_MAX = 40;
export const PRESET_MEMBERS_MAX = 16;

export interface PresetDraft {
  /** '' = a new group. */
  id: string;
  revision: number;
  name: string;
  leader_key: string;
  member_keys: string[];
  volumes: Record<string, number> | null;
}
export const NEW_PRESET: PresetDraft = { id: '', revision: 0, name: '', leader_key: '', member_keys: [], volumes: null };

/** What stops the draft from being saved (a short Hebrew line), or null. The server checks the same and more (layers, scope). */
export function presetDraftError(d: Pick<PresetDraft, 'name' | 'leader_key' | 'member_keys'>): string | null {
  const name = d.name.trim();
  if (!name) return 'חסר שם';
  if (name.length > PRESET_NAME_MAX) return `שם עד ${PRESET_NAME_MAX} תווים`;
  const all = new Set([d.leader_key, ...d.member_keys].filter(Boolean));
  if (all.size < 2) return 'בחרו לפחות שני חדרים';
  if (all.size > PRESET_MEMBERS_MAX) return `עד ${PRESET_MEMBERS_MAX} חדרים`;
  if (!d.leader_key) return 'בחרו מוביל';
  return null;
}

/** The rooms a saved group may hold: groupable, with live GROUPING in their last known mask. Once one is chosen only devices of the
 * SAME grouping layer stay selectable (never a mix, CR §5.3); an unavailable one stays selectable (its mask is the last good one). */
export function presetCandidates(devices: readonly PlayerDevice[], selected: readonly string[]): { device: PlayerDevice; disabled: boolean }[] {
  const layerOf = (k: string) => devices.find((d) => d.key === k)?.live.group.layer ?? null;
  const layer = selected.map(layerOf).find((l) => l !== null) ?? null;
  return devices
    .filter((d) => GROUPABLE_KINDS.includes(d.kind) && d.caps.group)
    .map((d) => ({ device: d, disabled: layer !== null && d.live.group.layer !== layer && !selected.includes(d.key) }));
}

/** The draft's volumes limited to its members (a removed room takes its volume with it). */
export function presetVolumes(d: Pick<PresetDraft, 'leader_key' | 'member_keys' | 'volumes'>): Record<string, number> | null {
  if (!d.volumes) return null;
  const keep = new Set([d.leader_key, ...d.member_keys]);
  const v = Object.fromEntries(Object.entries(d.volumes).filter(([k]) => keep.has(k)));
  return Object.keys(v).length ? v : null;
}

// ------------------------------------------------------------------------------------------------ settings parsers

/** A ceiling field: '' = none (no default exists, decision 7ב), a whole number 0-100, else `invalid`. */
export function parseCeiling(v: string): number | null | 'invalid' {
  const s = v.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : 'invalid';
}
/** A night window as the server takes it, or null. `from` and `to` are "HH:MM"; from == to is not a window. */
export function parseNight(from: string, to: string, max: string): { from: string; to: string; max: number } | null {
  const ok = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const m = parseCeiling(max);
  if (!ok(from) || !ok(to) || from === to || m === null || m === 'invalid') return null;
  return { from, to, max: m };
}
export const DEFAULT_NIGHT = { from: '22:00', to: '07:00', max: 20 };

/** Where the cap tick of a slider sits (percent of its track), or null without a ceiling. */
export const capPercent = (c: number | null): number | null => (c === null ? null : Math.max(0, Math.min(100, c)));
