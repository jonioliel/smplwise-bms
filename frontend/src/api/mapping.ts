/**
 * MAPPING-ASSIST-2330: the mapping assistant's routes (backend routers/home_mapping.py) and the static demo's in-memory stand-in (`?mb=1`).
 * Every route needs site.content.configure on the site; the multi-building switch needs it on every site. Nothing reaches the home system.
 */
import { get, post, put } from './client';
import { isApi } from './session';
import { productSettings } from './prefs';
import { demoMapping } from './mapping-demo';
import { emptyState, MAPPING_SETTINGS_DEFAULT, settingsOf, stateOf, type CurrentLinks, type HaLabel, type MapItem, type MappingSettings, type MappingState, type OurFloor, type Plan } from './mapping-engine';

export interface MappingVersion {
  number: number;
  kind: 'apply' | 'confirm' | 'auto' | 'restore';
  restored_from: number | null;
  created_at: string;
  by: string;
  summary: Record<string, unknown>;
  note: string;
  current: boolean;
}

export interface MappingBuilding {
  id: string;
  name: string;
  is_shared: boolean;
  floors: { id: string; name: string; level: number }[];
}

export interface MappingRead {
  site: { id: string; name: string };
  state: unknown;
  revision: number;
  settings: MappingSettings;
  multi_building: boolean;
  can_toggle: boolean;
  /** Round 14 (owner 02.11): "הרשאת בניין לפי" - what a building-scoped role binding reaches while the multi-building switch is on. */
  building_reach?: BuildingReach;
  /** Only an administrator of roles (rbac.roles.manage across the installation) changes it. */
  can_set_reach?: boolean;
  versions: MappingVersion[];
  seen: string[] | null;
  items: {
    floors: { id: string; name: string; level: number | null }[];
    /** `labels`: the area's label NAMES (HA-LABELS-SYNC-2351, synced read-only from the home system). */
    areas: { id: string; name: string; floor_id: string | null; labels?: string[] }[];
    /** HA-LABELS-SYNC-2351: the home system's label registry (absent on a server before 2.35.1). */
    labels?: HaLabel[];
    /** When the label registry was last listed; null = never (an old core, or not synced yet). */
    labels_synced_at?: string | null;
  };
  buildings: MappingBuilding[];
  links: Required<CurrentLinks>;
}

/** What the screens work with: the raw answer plus the engine's shapes. */
export interface MappingData extends MappingRead {
  parsed: MappingState;
  mapItems: MapItem[];
  ourFloors: OurFloor[];
  /** The label registry, or null when it was never listed (then "בתווית" cannot be judged on this site). */
  haLabels: HaLabel[] | null;
}

export function toData(r: MappingRead): MappingData {
  const mapItems: MapItem[] = [
    ...r.items.floors.map((f) => ({ id: f.id, kind: 'floor' as const, name: f.name, level: f.level })),
    ...r.items.areas.map((a) => ({ id: a.id, kind: 'area' as const, name: a.name, floorId: a.floor_id, labels: a.labels ?? [] })),
  ];
  const ourFloors = r.buildings.flatMap((b) => b.floors.map((f) => ({ id: f.id, building_id: b.id, name: f.name, level: f.level })));
  const haLabels = r.items.labels && r.items.labels_synced_at ? r.items.labels : null;
  return { ...r, settings: settingsOf(r.settings), parsed: r.state ? stateOf(r.state) : emptyState(), mapItems, ourFloors, haLabels };
}

// ------------------------------------------------------------------------------------------------------------------------------- demo
// The static demo keeps one site in memory so the whole flow (apply, versions, rollback, the switch) can be walked without a server.

interface DemoStore {
  read: MappingRead;
  versions: { v: MappingVersion; state: unknown; links: Required<CurrentLinks>; items: string[] }[];
}
let demo: DemoStore | null = null;

function demoStore(): DemoStore {
  if (demo) return demo;
  const d = demoMapping();
  const p = new URLSearchParams(location.search);
  const read: MappingRead = {
    site: { id: 'site1', name: 'מתחם הגפן' },
    state: null,
    revision: 0,
    settings: { ...MAPPING_SETTINGS_DEFAULT },
    multi_building: !!p.get('mb') && p.get('mb') !== 'off',
    can_toggle: true,
    building_reach: 'map_and_mapping',
    can_set_reach: true,
    versions: [],
    seen: null,
    items: {
      floors: d.items.filter((x) => x.kind === 'floor').map((x) => ({ id: x.id, name: x.name, level: x.level ?? null })),
      areas: d.items.filter((x) => x.kind === 'area').map((x) => ({ id: x.id, name: x.name, floor_id: x.floorId ?? null, labels: x.labels ?? [] })),
      labels: demoLabels(d.items),
      labels_synced_at: '2026-10-31T17:00:00Z',
    },
    buildings: d.buildings.map((b) => ({ id: b.id, name: b.name, is_shared: !!b.shared, floors: d.floors.filter((f) => f.building_id === b.id).map((f) => ({ id: f.id, name: f.name, level: f.level })) })),
    links: { floors: [], areas: [], buildings: [] },
  };
  demo = { read, versions: [] };
  // `?mbmap=applied`: a site mapped once already, with two names new since (the health card)
  if (p.get('mbmap') === 'applied') demoSeedApplied(demo);
  return demo;
}

/** The demo's label registry, as the sync would mirror it: every label its areas carry, with the count. */
function demoLabels(items: MapItem[]): HaLabel[] {
  const n = new Map<string, number>();
  for (const it of items) for (const l of new Set(it.labels ?? [])) n.set(l, (n.get(l) ?? 0) + 1);
  return [...n].map(([name, areas], i) => ({ id: `demo_label_${i + 1}`, name, color: null, icon: null, areas }));
}

/** The evidence's "after apply" state: version 1 saw every name but two. */
function demoSeedApplied(s: DemoStore) {
  const all = [...s.read.items.floors.map((f) => `f:${f.id}`), ...s.read.items.areas.map((a) => `a:${a.id}`)];
  const fresh = new Set(['a:ha112', 'a:ha139', 'a:ha140']);
  const seen = all.filter((k) => !fresh.has(k));
  const v: MappingVersion = { number: 1, kind: 'apply', restored_from: null, created_at: '2026-10-31T17:40:00Z', by: 'דנה', summary: { floor_rows: 24, manual: 7 }, note: '', current: true };
  s.versions.push({ v, state: { ...emptyState(), tokens: { מ: { t: 'b', id: 'bS' } } }, links: s.read.links, items: seen });
  s.read.state = s.versions[0].state;
  s.read.seen = seen;
  s.read.versions = [v];
  s.read.revision = 1;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ------------------------------------------------------------------------------------------------------------------------------- routes

export async function loadMapping(siteId: string): Promise<MappingData> {
  if (!isApi()) return toData(clone(demoStore().read));
  return toData(await get<MappingRead>(`sites/${encodeURIComponent(siteId)}/mapping`));
}

export async function saveState(siteId: string, state: MappingState, revision: number): Promise<{ revision: number }> {
  if (!isApi()) {
    const s = demoStore();
    s.read.state = clone(state);
    s.read.revision += 1;
    return { revision: s.read.revision };
  }
  return put<{ revision: number }>(`sites/${encodeURIComponent(siteId)}/mapping/state`, { state, revision });
}

export async function saveSettings(siteId: string, change: Partial<MappingSettings>): Promise<{ settings: MappingSettings }> {
  if (!isApi()) {
    const s = demoStore();
    s.read.settings = { ...s.read.settings, ...change };
    return { settings: s.read.settings };
  }
  return put<{ settings: MappingSettings }>(`sites/${encodeURIComponent(siteId)}/mapping/settings`, change);
}

/** Round 14 (owner 02.11): map placement only, or map placement + the home's area mapping (the default). */
export type BuildingReach = 'map_and_mapping' | 'map';
export const BUILDING_REACH_CHOICES: readonly BuildingReach[] = ['map_and_mapping', 'map'];
export const BUILDING_REACH_TEXT: Record<BuildingReach, string> = { map_and_mapping: 'מפה + מיפוי אזורים', map: 'מיקום במפה' };

export async function setBuildingReach(mode: BuildingReach): Promise<{ mode: BuildingReach }> {
  if (!isApi()) {
    demoStore().read.building_reach = mode;
    return { mode };
  }
  return put<{ mode: BuildingReach }>('home/building-reach', { mode });
}

export async function setMultiBuilding(enabled: boolean): Promise<{ enabled: boolean }> {
  if (!isApi()) {
    demoStore().read.multi_building = enabled;
    window.dispatchEvent(new CustomEvent('sw-multi-building', { detail: { enabled } }));
    return { enabled };
  }
  const r = await put<{ enabled: boolean }>('home/multi-building', { enabled });
  window.dispatchEvent(new CustomEvent('sw-multi-building', { detail: r }));
  return r;
}

export interface ApplyResult {
  version: number;
  revision: number;
  created: { buildings: { id: string; name: string }[]; floors: { id: string; name: string; building_id: string }[] };
}

export async function applyMapping(siteId: string, body: { state: MappingState; revision?: number; plan: Plan; kind?: 'apply' | 'confirm' | 'auto'; note?: string; summary?: Record<string, unknown> }): Promise<ApplyResult> {
  if (!isApi()) return demoApply(body);
  return post<ApplyResult>(`sites/${encodeURIComponent(siteId)}/mapping/apply`, body);
}

export async function restoreVersion(siteId: string, n: number): Promise<{ version: number }> {
  if (!isApi()) {
    const s = demoStore();
    const v = s.versions.find((x) => x.v.number === n);
    if (!v) throw new Error('not found');
    return demoRecord(s, 'restore', v.state, v.links, v.items, { restored_from: n }, n);
  }
  return post<{ version: number }>(`sites/${encodeURIComponent(siteId)}/mapping/versions/${n}/restore`);
}

function demoRecord(s: DemoStore, kind: MappingVersion['kind'], state: unknown, links: Required<CurrentLinks>, items: string[], summary: Record<string, unknown>, from: number | null = null) {
  for (const x of s.versions) x.v.current = false;
  const number = s.versions.length + 1;
  const v: MappingVersion = { number, kind, restored_from: from, created_at: new Date().toISOString(), by: 'הדגמה', summary, note: '', current: true };
  s.versions.unshift({ v, state: clone(state), links: clone(links), items });
  s.read.versions = s.versions.map((x) => x.v);
  s.read.state = clone(state);
  s.read.links = clone(links);
  s.read.seen = items;
  s.read.revision += 1;
  return { version: number, revision: s.read.revision };
}

function demoApply(body: { state: MappingState; plan: Plan; kind?: 'apply' | 'confirm' | 'auto'; summary?: Record<string, unknown> }): ApplyResult {
  const s = demoStore();
  const bref = new Map<string, string>();
  const created: ApplyResult['created'] = { buildings: [], floors: [] };
  for (const nb of body.plan.new_buildings) {
    const id = `demo_b_${s.read.buildings.length + 1}`;
    s.read.buildings.push({ id, name: nb.name, is_shared: false, floors: [] });
    bref.set(`new:${nb.key}`, id);
    created.buildings.push({ id, name: nb.name });
  }
  const fref = new Map<string, string>();
  for (const nf of body.plan.new_floors) {
    const b = bref.get(nf.building) ?? nf.building;
    const id = `demo_f_${Math.random().toString(36).slice(2, 8)}`;
    s.read.buildings.find((x) => x.id === b)?.floors.push({ id, name: nf.name, level: nf.level });
    fref.set(`new:${nf.key}`, id);
    created.floors.push({ id, name: nf.name, building_id: b });
  }
  const links = clone(s.read.links);
  const fr = (r: string) => fref.get(r) ?? r;
  for (const f of body.plan.floors) {
    links.floors = links.floors.filter((x) => x.ha_floor_id !== f.ha_floor_id);
    if (f.floor) links.floors.push({ ha_floor_id: f.ha_floor_id, floor_id: fr(f.floor) });
  }
  for (const a of body.plan.areas) {
    if (a.floor === 'auto') links.areas = links.areas.filter((x) => x.area_id !== a.area_id);
    else if (a.floor !== 'keep') {
      links.areas = links.areas.filter((x) => x.area_id !== a.area_id);
      links.areas.push({ area_id: a.area_id, floor_id: a.floor === null ? null : fr(a.floor) });
    }
    links.buildings = links.buildings.filter((x) => x.area_id !== a.area_id);
    if (a.building) links.buildings.push({ area_id: a.area_id, building_id: bref.get(a.building) ?? a.building });
  }
  const items = body.kind && body.kind !== 'apply' ? [...new Set([...(s.read.seen ?? []), ...body.plan.items])] : body.plan.items;
  const r = demoRecord(s, body.kind ?? 'apply', body.state, links, items, { ...(body.summary ?? {}), floor_rows: body.plan.floors.length });
  return { ...r, created };
}

/** The multi-building view of the home screen (owner 31.10: OFF by default). The static demo: on with `?mb=1` / `?mb=alarm`, off with `?mb=off`. */
export async function multiBuildingOn(): Promise<boolean> {
  if (!isApi()) {
    const mb = new URLSearchParams(location.search).get('mb');
    return demo ? demo.read.multi_building : !!mb && mb !== 'off';
  }
  try {
    return ((await productSettings()) as unknown as Record<string, unknown>)['home.multi_building'] === 'on';
  } catch {
    return false;
  }
}

/** Test seam: forget the demo store (unit specs run the module more than once). */
export function resetDemoMapping() {
  demo = null;
}
