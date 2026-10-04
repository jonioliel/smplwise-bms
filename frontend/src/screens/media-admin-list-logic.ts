/**
 * The PURE part of the settings lists of screens and of speakers / players (הגדרות › מולטימדיה; no DOM, no network, no Lit; unit-tested by
 * tests/unit-media-admin-list.spec.ts): what a row shows (integrations, the platform's ids, status), the filters (integration multi-select,
 * area, type, approval, availability, free text that also matches ids and integration names), sorting, grouping with a count per group,
 * and the per-user memory of the last view (localStorage, never required: every read and write is guarded).
 * Settings screens may name the platform and show its identifiers (docs/design/UI_COPY_RULES.md); operator screens never do.
 */
import type { AdminDevice } from '../api/media-admin';
import { integrationName } from './media-integration-names';

export type SortKey = 'name' | 'type' | 'integration' | 'area' | 'id' | 'status';
export type GroupKey = 'none' | 'integration' | 'area' | 'type';
export type TypeBucket = 'screen' | 'speaker' | 'other';
export type ApprovalFilter = 'all' | 'approved' | 'pending';
export type AvailFilter = 'all' | 'available' | 'unavailable';

export interface ListView {
  q: string;
  integrations: string[];
  /** '' = every area; NO_AREA = devices without one. */
  area: string;
  type: '' | TypeBucket;
  approval: ApprovalFilter;
  avail: AvailFilter;
  sort: SortKey;
  dir: 'asc' | 'desc';
  group: GroupKey;
  /** Group ids folded by the user. */
  collapsed: string[];
  /** The user's column choices (only the ones that differ from the default); a missing key means the per-width default. */
  cols: ColPrefs;
}

/** The optional columns (name, the edit key, approval are always there). `room` shows "floor › room" until `floor` has a column of its own. */
export type ColKey = 'type' | 'integration' | 'entityId' | 'deviceId' | 'room' | 'floor' | 'status' | 'connections';
export type ColPrefs = Partial<Record<ColKey, boolean>>;
export const COL_KEYS: ColKey[] = ['type', 'integration', 'entityId', 'deviceId', 'room', 'floor', 'status', 'connections'];
export const COL_LABEL: Record<ColKey, string> = { type: 'סוג', integration: 'אינטגרציה', entityId: 'מזהה ישות', deviceId: 'מזהה התקן', room: 'חדר', floor: 'קומה', status: 'מצב', connections: 'חיבורים' };
/** Table widths: `wide` above 1280 px, `md` (tablet) from 861 to 1280 px; at 860 px and below the rows are cards and every column choice is ignored. */
export type Bp = 'wide' | 'md';
export const BREAKPOINT_MD = 1280;
export const BREAKPOINT_PHONE = 860;

/** Today's behaviour: everything shows, except the separate floor column, and the room on a tablet width. */
export function defaultVisible(k: ColKey, bp: Bp): boolean {
  if (k === 'floor') return false;
  if (k === 'room') return bp === 'wide';
  return true;
}

export function colVisible(prefs: ColPrefs, k: ColKey, bp: Bp): boolean {
  const p = prefs[k];
  return typeof p === 'boolean' ? p : defaultVisible(k, bp);
}

/** The class a cell of this column carries: hw = hidden above 1280 px, hm = hidden from 861 to 1280 px (the card layout ignores both). */
export function hideClass(prefs: ColPrefs, k: ColKey): string {
  return [colVisible(prefs, k, 'wide') ? '' : 'hw', colVisible(prefs, k, 'md') ? '' : 'hm'].filter(Boolean).join(' ');
}

const W: Record<Bp, Record<string, string>> = {
  wide: { x: 'var(--hit)', name: 'minmax(150px, 1.5fr)', type: '96px', integration: '130px', id: 'minmax(200px, 1.9fr)', floor: '110px', room: 'minmax(110px, 1fr)', status: '90px', ap: '64px', connections: '110px' },
  md: { x: 'var(--hit)', name: 'minmax(130px, 1.4fr)', type: '84px', integration: '110px', id: 'minmax(170px, 1.7fr)', floor: '100px', room: 'minmax(100px, 1fr)', status: '80px', ap: '60px', connections: '104px' },
};

/** The grid template of one width for the user's choices (the id column exists while either id shows). */
export function gridColumns(prefs: ColPrefs, bp: Bp): string {
  const on = (k: ColKey) => colVisible(prefs, k, bp);
  const w = W[bp];
  const parts = [w.x, w.name];
  if (on('type')) parts.push(w.type);
  if (on('integration')) parts.push(w.integration);
  if (on('entityId') || on('deviceId')) parts.push(w.id);
  if (on('floor')) parts.push(w.floor);
  if (on('room')) parts.push(w.room);
  if (on('status')) parts.push(w.status);
  parts.push(w.ap);
  if (on('connections')) parts.push(w.connections);
  return parts.join(' ');
}

/** The classes the table carries so the room cell drops its "floor ›" prefix at the widths where the floor has its own column. */
export function floorSplitClass(prefs: ColPrefs): string {
  return [colVisible(prefs, 'floor', 'wide') ? 'fl-w' : '', colVisible(prefs, 'floor', 'md') ? 'fl-m' : ''].filter(Boolean).join(' ');
}

/** A choice is stored only when it differs from the default at the width the user is looking at; choosing the default again forgets it. */
export function setColPref(prefs: ColPrefs, k: ColKey, on: boolean, bp: Bp): ColPrefs {
  const next = { ...prefs };
  if (on === defaultVisible(k, bp)) delete next[k];
  else next[k] = on;
  return next;
}

export const hasColPrefs = (prefs: ColPrefs): boolean => Object.keys(prefs).length > 0;

export const NO_AREA = '__none__';
export const NO_INTEGRATION = '__none__';
export const DEFAULT_VIEW: ListView = { q: '', integrations: [], area: '', type: '', approval: 'all', avail: 'all', sort: 'name', dir: 'asc', group: 'none', collapsed: [], cols: {} };
export const SORT_KEYS: SortKey[] = ['name', 'type', 'integration', 'area', 'id', 'status'];
export const GROUP_KEYS: GroupKey[] = ['none', 'integration', 'area', 'type'];

/** What a row needs beyond the device itself; `live` is the players' richer status (the live power), absent for screens. */
export interface RowFacts {
  integrations: string[];
  primary: string;
  entityId: string;
  deviceId: string;
  area: string;
  areaKey: string;
  type: TypeBucket;
  /** true / false, or null when nothing is known (a device without any state). */
  available: boolean | null;
}

export type LiveAvail = (key: string) => boolean | null;

export function typeBucket(kind: string): TypeBucket {
  return kind === 'screen' ? 'screen' : kind === 'speaker' ? 'speaker' : 'other';
}

const ROLE_RANK: Record<string, number> = { vendor: 0 };

/** The registry platforms of every endpoint (hidden duplicates included), the vendor's first, no repeats; the server's `integrations` is used when it sent one. */
export function integrationsOf(d: AdminDevice): string[] {
  const eps = [...d.endpoints].sort((a, b) => Number(a.hidden) - Number(b.hidden) || (ROLE_RANK[a.role] ?? 1) - (ROLE_RANK[b.role] ?? 1));
  const fromEndpoints = eps.map((e) => e.platform).filter(Boolean);
  const server = d.integrations ?? [];
  return [...new Set([...fromEndpoints, ...server])];
}

export function entityIdOf(d: AdminDevice): string {
  return d.anchor_entity_id || d.endpoints[0]?.endpoint_id.replace(/^ha:/, '') || '';
}

export function factsOf(d: AdminDevice, live?: LiveAvail): RowFacts {
  const integrations = integrationsOf(d);
  const area = d.area_name ?? '';
  const l = live ? live(d.key) : null;
  return {
    integrations,
    primary: integrations[0] ?? '',
    entityId: entityIdOf(d),
    deviceId: d.ha_device_id ?? '',
    area,
    areaKey: area || NO_AREA,
    type: typeBucket(d.kind),
    available: l !== null ? l : typeof d.available === 'boolean' ? d.available : null,
  };
}

const norm = (s: string) => s.toLocaleLowerCase('he').normalize('NFKC');

/** Free text: every word must appear in the name, the area, the floor, the entity id, the device id, an endpoint id or an integration name. */
export function matchesText(d: AdminDevice, f: RowFacts, q: string): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([d.name, d.area_name ?? '', d.floor_name ?? '', f.entityId, f.deviceId, ...d.endpoints.map((e) => e.endpoint_id), ...f.integrations, ...f.integrations.map(integrationName)].join('\n'));
  return words.every((w) => hay.includes(w));
}

export function matches(d: AdminDevice, f: RowFacts, v: ListView): boolean {
  if (v.integrations.length && !(v.integrations.includes(NO_INTEGRATION) && !f.integrations.length) && !f.integrations.some((i) => v.integrations.includes(i))) return false;
  if (v.area && f.areaKey !== v.area) return false;
  if (v.type && f.type !== v.type) return false;
  if (v.approval === 'approved' && !d.approved) return false;
  if (v.approval === 'pending' && d.approved) return false;
  if (v.avail === 'available' && f.available !== true) return false;
  if (v.avail === 'unavailable' && f.available !== false) return false;
  return matchesText(d, f, v.q);
}

const cmpStr = (a: string, b: string) => a.localeCompare(b, 'he', { numeric: true, sensitivity: 'base' });
/** An empty value always sorts after a filled one, whichever the direction. */
const withEmptyLast = (a: string, b: string, dir: 1 | -1) => (a === '' && b !== '' ? 1 : b === '' && a !== '' ? -1 : dir * cmpStr(a, b));
const availRank = (a: boolean | null) => (a === true ? 0 : a === false ? 1 : 2);

function sortValue(d: AdminDevice, f: RowFacts, k: SortKey): string {
  switch (k) {
    case 'name': return d.name;
    case 'type': return f.type + ':' + d.kind;
    case 'integration': return integrationName(f.primary);
    case 'area': return f.area;
    case 'id': return f.entityId;
    case 'status': return String(availRank(f.available));
  }
}

export interface Row { d: AdminDevice; f: RowFacts }
export interface Group { id: string; label: string; rows: Row[] }

export function sortRows(rows: Row[], k: SortKey, dir: 'asc' | 'desc'): Row[] {
  const s = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => withEmptyLast(sortValue(a.d, a.f, k), sortValue(b.d, b.f, k), s) || cmpStr(a.d.name, b.d.name) || cmpStr(a.d.key, b.d.key));
}

function groupOf(r: Row, g: GroupKey, typeLabel: (b: TypeBucket) => string, none: { area: string; integration: string }): { id: string; label: string } {
  if (g === 'integration') return { id: r.f.primary || NO_INTEGRATION, label: integrationName(r.f.primary) || none.integration };
  if (g === 'area') return { id: r.f.areaKey, label: r.f.area || none.area };
  return { id: r.f.type, label: typeLabel(r.f.type) };
}

export const TYPE_LABEL: Record<TypeBucket, string> = { screen: 'מסכים', speaker: 'רמקולים ונגנים', other: 'אחר' };

/** The filtered, sorted rows, in groups (one anonymous group when `group` is none). Group order follows the same direction as the sort key when it is the group key, else ascending, "no value" last. */
export function buildView(devices: AdminDevice[], v: ListView, live?: LiveAvail): { groups: Group[]; shown: number; total: number } {
  const rows: Row[] = devices.map((d) => ({ d, f: factsOf(d, live) }));
  const kept = sortRows(rows.filter((r) => matches(r.d, r.f, v)), v.sort, v.dir);
  if (v.group === 'none') return { groups: [{ id: '', label: '', rows: kept }], shown: kept.length, total: rows.length };
  const map = new Map<string, Group>();
  for (const r of kept) {
    const g = groupOf(r, v.group, (b) => TYPE_LABEL[b], { area: 'ללא חדר', integration: 'ללא אינטגרציה' });
    if (!map.has(g.id)) map.set(g.id, { ...g, rows: [] });
    map.get(g.id)!.rows.push(r);
  }
  const dir = v.sort === v.group || (v.sort === 'integration' && v.group === 'integration') ? (v.dir === 'asc' ? 1 : -1) : 1;
  const groups = [...map.values()].sort((a, b) => (a.id === NO_AREA || a.id === NO_INTEGRATION ? 1 : b.id === NO_AREA || b.id === NO_INTEGRATION ? -1 : dir * cmpStr(a.label, b.label)));
  return { groups, shown: kept.length, total: rows.length };
}

/** The choices of the filters, from what the list actually holds (with counts). */
export function optionsOf(devices: AdminDevice[], live?: LiveAvail): { integrations: { id: string; count: number }[]; areas: { id: string; label: string; count: number }[]; types: TypeBucket[] } {
  const ints = new Map<string, number>();
  const areas = new Map<string, { label: string; count: number }>();
  const types = new Set<TypeBucket>();
  for (const d of devices) {
    const f = factsOf(d, live);
    for (const i of f.integrations.length ? f.integrations : [NO_INTEGRATION]) ints.set(i, (ints.get(i) ?? 0) + 1);
    const a = areas.get(f.areaKey) ?? { label: f.area || 'ללא חדר', count: 0 };
    a.count += 1;
    areas.set(f.areaKey, a);
    types.add(f.type);
  }
  return {
    integrations: [...ints].map(([id, count]) => ({ id, count })).sort((a, b) => (a.id === NO_INTEGRATION ? 1 : b.id === NO_INTEGRATION ? -1 : cmpStr(a.id, b.id))),
    areas: [...areas].map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.id === NO_AREA ? 1 : b.id === NO_AREA ? -1 : cmpStr(a.label, b.label))),
    types: (['screen', 'speaker', 'other'] as TypeBucket[]).filter((t) => types.has(t)),
  };
}

/** True when the view differs from the default in a way that hides rows (the "clear" button's condition; sort and group do not count). */
export function isFiltered(v: ListView): boolean {
  return !!(v.q.trim() || v.integrations.length || v.area || v.type || v.approval !== 'all' || v.avail !== 'all');
}

// ------------------------------------------------------------------------------------------------ memory (localStorage, never required)

const KEY = 'sw.media-admin.view.';

function parseCols(x: unknown): ColPrefs {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const out: ColPrefs = {};
  for (const k of COL_KEYS) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return out;
}

/** Coerces anything stored (old version, hand-edited, another type) to a valid view. */
export function parseView(raw: unknown): ListView {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);
  const pick = <T extends string>(x: unknown, all: readonly T[], d: T): T => (typeof x === 'string' && (all as readonly string[]).includes(x) ? (x as T) : d);
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string').slice(0, 100) : []);
  return {
    q: str(o.q).slice(0, 100),
    integrations: strs(o.integrations),
    area: str(o.area),
    type: pick(o.type, ['', 'screen', 'speaker', 'other'] as const, ''),
    approval: pick(o.approval, ['all', 'approved', 'pending'] as const, 'all'),
    avail: pick(o.avail, ['all', 'available', 'unavailable'] as const, 'all'),
    sort: pick(o.sort, SORT_KEYS, 'name'),
    dir: pick(o.dir, ['asc', 'desc'] as const, 'asc'),
    group: pick(o.group, GROUP_KEYS, 'none'),
    collapsed: strs(o.collapsed),
    cols: parseCols(o.cols),
  };
}

const storeKey = (scope: string, user: string) => `${KEY}${scope}.${user || 'anon'}`;

export function loadView(scope: string, user: string, store?: Pick<Storage, 'getItem'>): ListView {
  try {
    const s = store ?? localStorage;
    const raw = s.getItem(storeKey(scope, user));
    return raw ? parseView(JSON.parse(raw)) : { ...DEFAULT_VIEW };
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

/** The free text is not remembered (a stale search that hides rows on the next visit is a trap); everything else is. */
export function saveView(scope: string, user: string, v: ListView, store?: Pick<Storage, 'setItem'>): void {
  try {
    (store ?? localStorage).setItem(storeKey(scope, user), JSON.stringify({ ...v, q: '' }));
  } catch {
    /* storage unavailable: the view simply is not remembered */
  }
}
