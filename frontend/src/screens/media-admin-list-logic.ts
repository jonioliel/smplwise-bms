/**
 * The PURE part of the settings lists of screens and of speakers / players (הגדרות › מולטימדיה; no DOM, no network, no Lit; unit-tested by
 * tests/unit-media-admin-list.spec.ts): what a row shows (integrations, the platform's ids, status), the filters (integration multi-select,
 * area, type, approval, availability, free text that also matches ids and integration names), sorting, grouping with a count per group,
 * and the per-user memory of the last view (localStorage, never required: every read and write is guarded).
 * Settings screens may name the platform and show its identifiers (docs/design/UI_COPY_RULES.md); operator screens never do.
 */
import type { AdminDevice } from '../api/media-admin';

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
}

export const NO_AREA = '__none__';
export const NO_INTEGRATION = '__none__';
export const DEFAULT_VIEW: ListView = { q: '', integrations: [], area: '', type: '', approval: 'all', avail: 'all', sort: 'name', dir: 'asc', group: 'none', collapsed: [] };
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
  const hay = norm([d.name, d.area_name ?? '', d.floor_name ?? '', f.entityId, f.deviceId, ...d.endpoints.map((e) => e.endpoint_id), ...f.integrations].join('\n'));
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
    case 'integration': return f.primary;
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
  if (g === 'integration') return { id: r.f.primary || NO_INTEGRATION, label: r.f.primary || none.integration };
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
