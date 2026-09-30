/**
 * CR-015 addition A, the PURE part of the screens page (no DOM, no network; unit-tested by tests/unit-media-layout.spec.ts):
 * the page's filters, the layout editor's operations on a draft, and how a personal override is derived from a draft.
 * Ordering and grouping of the cards themselves is the S0 client's `resolveCards` / `effectiveLayout`; this file adds what the
 * page and its editor need around them.
 *
 * Model (MEDIA_API.md §2.4): the installation layout holds group_by, floor_order, pinned (the "מועדפים" top row), the global
 * order of device keys and per-card {on, size, phone_on, phone_size}; a personal override (screen.personalize only) holds
 * group_by, order and per-card on / size. Unknown keys (a device that is temporarily absent) are kept when a layout is written.
 */
import {
  DEFAULT_CARD, effectiveLayout, moveKey, resolveCards,
  type CardCfg, type CardGroup, type GroupBy, type MediaDevice, type MediaLayout, type MediaPersonal, type Size,
} from '../api/media-screens';

export type EditScope = 'all' | 'me';
export type StateFilter = 'all' | 'on' | 'off' | 'un';

export const SIZE_LABEL: Record<Size, string> = { s: 'קטן', m: 'רגיל', l: 'גדול' };
export const GROUP_LABEL: Record<GroupBy, string> = { floor: 'לפי קומה', area: 'לפי חדר', none: 'רציף' };
export const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: 'all', label: 'הכל' }, { id: 'on', label: 'פועלים' }, { id: 'off', label: 'כבויים' }, { id: 'un', label: 'לא זמינים' },
];
/** The most "מועדפים" the server takes (MEDIA_API.md §2.4). */
export const PINNED_MAX = 24;
export const NO_FLOOR = 'none';
/** The static demo's floor order (the MOCK adapter's three floors, top to bottom): in the demo there is no home screen to follow. */
export const DEMO_FLOOR_ORDER = ['g', 'u1', 'b'];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const byName = (a: MediaDevice, b: MediaDevice) => a.name.localeCompare(b.name, 'he');

// ------------------------------------------------------------------------------------------------ what the user sees

/** The layout the page draws: the installation's with the personal override on top. A personal on / off also decides the
 * phone (an explicit installation "phone_on" would otherwise still win there and the user's own choice would not show). */
export function effective(installation: MediaLayout, personal: MediaPersonal | null): MediaLayout {
  const eff = effectiveLayout(installation, personal);
  if (!personal) return eff;
  const cards = { ...eff.cards };
  for (const [key, p] of Object.entries(personal.cards)) if (p.on !== undefined && cards[key]) cards[key] = { ...cards[key], phone_on: null };
  return { ...eff, cards };
}

// ------------------------------------------------------------------------------------------------ filters

export interface Filters {
  /** An HA floor id, NO_FLOOR for the screens without one, '' = all floors. */
  floor: string;
  /** A room (area) id, '' = all rooms. */
  area: string;
  q: string;
  state: StateFilter;
}

export const NO_FILTER: Filters = { floor: '', area: '', q: '', state: 'all' };

export const filtersActive = (f: Filters): boolean => !!(f.floor || f.area || f.q.trim() || f.state !== 'all');

export function filtersFromParams(p: URLSearchParams): Filters {
  const st = p.get('state');
  return { floor: p.get('floor') ?? '', area: p.get('area') ?? '', q: p.get('q') ?? '', state: st === 'on' || st === 'off' || st === 'un' ? st : 'all' };
}

/** The query the filters make (only what is set), merged into the route's other parameters by the caller. */
export function filtersToParams(f: Filters, into: URLSearchParams = new URLSearchParams()): URLSearchParams {
  for (const k of ['floor', 'area', 'q', 'state'] as const) into.delete(k);
  if (f.floor) into.set('floor', f.floor);
  if (f.area) into.set('area', f.area);
  if (f.q.trim()) into.set('q', f.q.trim());
  if (f.state !== 'all') into.set('state', f.state);
  return into;
}

export const floorIdOf = (d: Pick<MediaDevice, 'floor_id'>): string => d.floor_id ?? NO_FLOOR;

export function stateOf(d: Pick<MediaDevice, 'live'>): Exclude<StateFilter, 'all'> {
  const p = d.live.power;
  if (p === 'on') return 'on';
  if (p === 'unavailable' || p === 'unknown') return 'un';
  return 'off'; // off, standby and the art mode
}

export function matches(d: MediaDevice, f: Filters): boolean {
  if (f.floor && floorIdOf(d) !== f.floor) return false;
  if (f.area && (d.area_id ?? '') !== f.area) return false;
  if (f.state !== 'all' && stateOf(d) !== f.state) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !`${d.name} ${d.area_name ?? ''} ${d.floor_name ?? ''}`.toLowerCase().includes(q)) return false;
  return true;
}

export const filterDevices = (devices: MediaDevice[], f: Filters): MediaDevice[] => devices.filter((d) => matches(d, f));

export interface Counts {
  total: number;
  on: number;
  off: number;
  un: number;
}

export function countsOf(devices: MediaDevice[]): Counts {
  const c: Counts = { total: devices.length, on: 0, off: 0, un: 0 };
  for (const d of devices) c[stateOf(d)] += 1;
  return c;
}

export interface FloorRef {
  id: string;
  name: string;
  count: number;
}

/** The floors of the screens in the order the layout gives (floor_order, then first seen, the floorless last). */
export function floorsOf(devices: MediaDevice[], layout: Pick<MediaLayout, 'floor_order'>): FloorRef[] {
  const map = new Map<string, FloorRef>();
  for (const d of devices) {
    const id = floorIdOf(d);
    const f = map.get(id) ?? { id, name: d.floor_name ?? 'ללא שיוך', count: 0 };
    f.count += 1;
    map.set(id, f);
  }
  const rank = new Map(layout.floor_order.map((id, i) => [id, i]));
  const first = new Map([...map.keys()].map((id, i) => [id, i]));
  return [...map.values()].sort((a, b) => {
    const ra = rank.get(a.id) ?? (a.id === NO_FLOOR ? 2e6 : 1e6);
    const rb = rank.get(b.id) ?? (b.id === NO_FLOOR ? 2e6 : 1e6);
    return ra - rb || (first.get(a.id) ?? 0) - (first.get(b.id) ?? 0);
  });
}

/** The rooms of the screens on one floor ('' = every floor), in order of first appearance. */
export function roomsOf(devices: MediaDevice[], floor: string): { id: string; name: string }[] {
  const out = new Map<string, string>();
  for (const d of devices) {
    if (floor && floorIdOf(d) !== floor) continue;
    if (d.area_id && !out.has(d.area_id)) out.set(d.area_id, d.area_name ?? d.area_id);
  }
  return [...out].map(([id, name]) => ({ id, name }));
}

// ------------------------------------------------------------------------------------------------ the editor's draft

/** The layout with every device present: a device the layout does not know yet joins at the end (by name) with the default card;
 * keys of devices that are not in the list are KEPT (a device may be temporarily absent; the server prunes them later). */
export function complete(layout: MediaLayout, devices: MediaDevice[]): MediaLayout {
  const known = new Set(layout.order);
  const fresh = devices.filter((d) => !known.has(d.key)).sort(byName).map((d) => d.key);
  const cards: Record<string, CardCfg> = { ...layout.cards };
  for (const d of devices) if (!cards[d.key]) cards[d.key] = { ...DEFAULT_CARD };
  return { ...layout, order: [...layout.order, ...fresh], pinned: [...layout.pinned], floor_order: [...layout.floor_order], cards };
}

/** The layout with the floors in the order that APPLIES: its own `floor_order`, else the home screen's (an empty `floor_order` means "follow the home screen", MEDIA_API.md §2.4). */
export const withFloorOrder = (layout: MediaLayout, home: string[]): MediaLayout => (layout.floor_order.length || !home.length ? layout : { ...layout, floor_order: [...home] });

/** What the editor starts from: the installation's layout for "לכולם", the user's effective layout for "רק אני" (floors in the order that applies). */
export function startDraft(scope: EditScope, installation: MediaLayout, personal: MediaPersonal | null, devices: MediaDevice[], home: string[] = []): MediaLayout {
  return withFloorOrder(complete(scope === 'all' ? installation : effective(installation, personal), devices), home);
}

export const cardOf = (layout: MediaLayout, key: string): CardCfg => layout.cards[key] ?? DEFAULT_CARD;

export function setCard(layout: MediaLayout, key: string, patch: Partial<CardCfg>): MediaLayout {
  return { ...layout, cards: { ...layout.cards, [key]: { ...cardOf(layout, key), ...patch } } };
}

export const setGroupBy = (layout: MediaLayout, groupBy: GroupBy): MediaLayout => ({ ...layout, group_by: groupBy });

export function togglePin(layout: MediaLayout, key: string): MediaLayout {
  if (layout.pinned.includes(key)) return { ...layout, pinned: layout.pinned.filter((k) => k !== key) };
  return layout.pinned.length >= PINNED_MAX ? layout : { ...layout, pinned: [...layout.pinned, key] };
}

/** Every device, hidden ones too, grouped as the page groups them (the editor lists what the layout can still change). */
export function editGroups(devices: MediaDevice[], layout: MediaLayout): CardGroup[] {
  const all: MediaLayout = { ...layout, cards: Object.fromEntries(devices.map((d) => [d.key, { ...cardOf(layout, d.key), on: true, phone_on: true }])) };
  return resolveCards(devices, all, false);
}

/** One step earlier (-1) or later (1) INSIDE the group the device is shown in (the "מועדפים" row is ordered by `pinned`, every
 * other group by the global `order`, where only the relative order of its own devices matters). Out of range: unchanged. */
export function moveInGroup(layout: MediaLayout, devices: MediaDevice[], key: string, dir: -1 | 1): MediaLayout {
  const group = editGroups(devices, layout).find((g) => g.items.some((i) => i.device.key === key));
  if (!group) return layout;
  const i = group.items.findIndex((x) => x.device.key === key);
  const j = i + dir;
  if (j < 0 || j >= group.items.length) return layout;
  return placeBefore(layout, devices, key, group.items[j].device.key, group.id === 'pinned');
}

/** A drag and drop: `key` takes the place of `onto` (same group). */
export function moveOnto(layout: MediaLayout, devices: MediaDevice[], key: string, onto: string): MediaLayout {
  if (key === onto) return layout;
  const groups = editGroups(devices, layout);
  const g = groups.find((x) => x.items.some((i) => i.device.key === key));
  if (!g || !g.items.some((i) => i.device.key === onto)) return layout;
  return placeBefore(layout, devices, key, onto, g.id === 'pinned');
}

function placeBefore(layout: MediaLayout, devices: MediaDevice[], key: string, neighbour: string, pinned: boolean): MediaLayout {
  if (pinned) return { ...layout, pinned: moveKey(layout.pinned, key, layout.pinned.indexOf(neighbour)) };
  const full = complete(layout, devices);
  return { ...full, order: moveKey(full.order, key, full.order.indexOf(neighbour)) };
}

/** The floors' order in the editor (installation only): `id` to position `to` in the list `ids` the editor shows. */
export function moveFloor(layout: MediaLayout, ids: string[], id: string, to: number): MediaLayout {
  return { ...layout, floor_order: moveKey(ids, id, to) };
}

// ------------------------------------------------------------------------------------------------ personal override

/** The personal override a draft makes over the installation layout: only what differs (group_by, order, per-card on / size);
 * null when nothing differs - saving null clears the override ("ברירת מחדל"). */
export function personalFrom(installation: MediaLayout, draft: MediaLayout, devices: MediaDevice[]): MediaPersonal | null {
  const base = complete(installation, devices);
  const d = complete(draft, devices);
  const cards: MediaPersonal['cards'] = {};
  for (const [key, c] of Object.entries(d.cards)) {
    const b = base.cards[key] ?? DEFAULT_CARD;
    const diff: { on?: boolean; size?: Size } = {};
    if (c.on !== b.on) diff.on = c.on;
    if (c.size !== b.size) diff.size = c.size;
    if (Object.keys(diff).length) cards[key] = diff;
  }
  const group_by = d.group_by !== base.group_by ? d.group_by : null;
  const order = same(d.order, base.order) ? null : d.order;
  if (!group_by && !order && !Object.keys(cards).length) return null;
  return { group_by, order, cards };
}

/** An unsaved change? (the draft against what it started from) */
export const isDirty = (base: MediaLayout, draft: MediaLayout): boolean => !same(base, draft);

/** The layout to send for the installation: the draft with the device list's completions. A floor order that is still exactly the home
 * screen's (and was empty) stays empty, so the screens keep following the home screen. */
export function installationPayload(draft: MediaLayout, devices: MediaDevice[], original: MediaLayout, home: string[]): MediaLayout {
  const full = complete(draft, devices);
  return !original.floor_order.length && same(full.floor_order, home) ? { ...full, floor_order: [] } : full;
}
