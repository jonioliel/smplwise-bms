/**
 * Plan Studio 6, slice S0 (CR-029 section 5.2 / 6): the material resolver - the material of every surface the realistic
 * level draws and every lamp's light, from the document and the library. The mirror of the backend's
 * plan_studio6.resolve; contracts/fixtures/plan_geometry/sample-v22.materials.json pins both (unit-material-resolve.spec.ts,
 * test_plan_studio6.py). Pure and deterministic: own field > catalog item > rule by kind / tags / role > fallback; an
 * unknown id resolves to the default and is listed in `warnings` (never an error - an older library still opens a newer
 * document). Levels 1-2 never call it: their look is the token colours and does not move.
 */
import library from './materials.json' with { type: 'json' };
import type { GeometryDoc } from './geometry';
import { LIGHT_KINDS, type LampLight, COLOR_K_RANGE, LUMENS_RANGE, BEAM_RANGE } from './studio6-fields';

export type VisualStyle = 'light' | 'dark';
export interface MaterialDef {
  id: string;
  group: string;
  he: string;
  tile_m: number;
  tint: Record<VisualStyle, string>;
  roughness: number;
  metalness: number;
  normal: number;
  set: string | null;
  glass?: { opacity: number };
  aliases: string[];
}
export interface CatalogMaterialInfo {
  role?: string;
  material_id?: string;
  light?: Partial<LampLight>;
}
export type CatalogMaterialLookup = (itemId: string) => CatalogMaterialInfo | undefined;
export interface ResolvedMaterials {
  library_version: string;
  levels: Record<string, { floor: string; ceiling: string }>;
  rooms: Record<string, { floor: string; ceiling: string; has_ceiling: boolean }>;
  walls: Record<string, string>;
  openings: Record<string, string | null>;
  objects: Record<string, string>;
  lights: Record<string, LampLight>;
  warnings: { path: string; id: string; material_id: string }[];
}

export const MATERIALS: readonly MaterialDef[] = (library as { materials: MaterialDef[] }).materials;
export const LIBRARY_VERSION: string = (library as { library_version: string }).library_version;
const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));
const ALIASES = new Map(MATERIALS.flatMap((m) => m.aliases.map((a) => [a, m.id] as [string, string])));

const WALL_DEFAULT: Record<string, string> = { exterior: 'plaster_exterior', glass: 'glass', railing: 'metal_dark' };
const WALL_FALLBACK = 'plaster_white';
const OPENING_DEFAULT: Record<string, string> = { door: 'door_wood', window: 'glass' };
const LEVEL_FLOOR = 'concrete';
const LEVEL_CEILING = 'plaster_ceiling';
const ROLE_MATERIAL: Record<string, string> = {
  furniture: 'wood_light', kitchen: 'wood_light', sanitary: 'tiles_white', office: 'plastic', light: 'metal_dark', electrical: 'metal_light', safety: 'metal_light',
  medical: 'metal_light', sport: 'metal_dark', structure: 'concrete', circulation: 'concrete', security: 'metal_dark', outdoor: 'concrete',
};
const OBJECT_FALLBACK = 'plastic';
export const LIGHT_DEFAULT: LampLight = { kind: 'ceiling', color_k: 3000, lumens: 800 };
/** A room's floor by its tags: the first rule whose keyword is inside a tag (lower-cased); none = its level's floor. */
export const ROOM_FLOOR_RULES: readonly [string, readonly string[]][] = [
  ['tiles_grey', ['bath', 'toilet', 'shower', 'sanitary', 'wc', 'kitchen', 'אמבטיה', 'שירותים', 'מקלחת', 'רחצה', 'מטבח']],
  ['floor_sport', ['sport', 'gym', 'court', 'ספורט', 'כושר', 'מגרש']],
  ['asphalt', ['parking', 'road', 'חניה', 'חנייה', 'כביש']],
  ['grass', ['garden', 'lawn', 'yard', 'גינה', 'דשא', 'חצר']],
  ['carpet', ['office', 'meeting', 'משרד', 'ישיבות']],
  ['oak', ['residential', 'living', 'bedroom', 'apartment', 'מגורים', 'סלון', 'חדר שינה', 'דירה']],
];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The library id a material id names (itself or through an alias), or null when unknown. */
export function canonicalMaterial(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  if (BY_ID.has(id)) return id;
  return ALIASES.get(id) ?? null;
}

/** The library entry of an id (after canonicalMaterial), for the renderer (S1): tint per style, tile, roughness... */
export function materialDef(id: string | null | undefined): MaterialDef | undefined {
  const c = canonicalMaterial(id);
  return c ? BY_ID.get(c) : undefined;
}

function roomFloorByTags(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  const folded = tags.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase());
  for (const [material, words] of ROOM_FLOOR_RULES) if (folded.some((t) => words.some((w) => t.includes(w)))) return material;
  return null;
}

const clampInt = (v: number, [lo, hi]: readonly [number, number]): number => Math.trunc(Math.min(hi, Math.max(lo, v)));

/** The resolved lamp light (own > catalog item > default; values clamped into their ranges, kinds outside the list = ceiling). */
export function resolveLight(own: Partial<LampLight> | null | undefined, item: Partial<LampLight> | null | undefined): LampLight {
  const src = own && typeof own === 'object' ? own : item && typeof item === 'object' ? item : LIGHT_DEFAULT;
  const out: LampLight = {
    kind: (LIGHT_KINDS as readonly string[]).includes(src.kind as string) ? (src.kind as LampLight['kind']) : LIGHT_DEFAULT.kind,
    color_k: isNum(src.color_k) ? clampInt(src.color_k, COLOR_K_RANGE) : LIGHT_DEFAULT.color_k,
    lumens: isNum(src.lumens) ? clampInt(src.lumens, LUMENS_RANGE) : LIGHT_DEFAULT.lumens,
  };
  if (isNum(src.beam_deg)) out.beam_deg = clampInt(src.beam_deg, BEAM_RANGE);
  return out;
}

/** Every material of the document (see the module note). `catalog` answers the item's role, material and light. */
export function resolveMaterials(doc: Pick<GeometryDoc, 'levels' | 'rooms' | 'walls' | 'openings' | 'objects'>, catalog: CatalogMaterialLookup = () => undefined): ResolvedMaterials {
  const warnings: ResolvedMaterials['warnings'] = [];
  const own = (coll: string, it: { id: string } & Record<string, unknown>, key: string): string | null => {
    const v = it[key];
    if (v === undefined || v === null) return null;
    const c = canonicalMaterial(v);
    if (c === null) warnings.push({ path: `${coll}.${key}`, id: String(it.id), material_id: String(v) });
    return c;
  };
  const itemsOf = <T,>(raw: T[] | undefined): (T & { id: string } & Record<string, unknown>)[] =>
    (Array.isArray(raw) ? raw : []).filter((i): i is T & { id: string } & Record<string, unknown> => !!i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string').sort((a, b) => cmp(a.id, b.id));

  const levels: ResolvedMaterials['levels'] = {};
  let defaultLevel: string | null = null;
  for (const lv of itemsOf(doc.levels)) {
    levels[lv.id] = { floor: own('levels', lv, 'floor_material_id') ?? LEVEL_FLOOR, ceiling: own('levels', lv, 'ceiling_material_id') ?? LEVEL_CEILING };
    if (lv.is_default === true && defaultLevel === null) defaultLevel = lv.id;
  }
  const fallbackLevel = { floor: LEVEL_FLOOR, ceiling: LEVEL_CEILING };
  const rooms: ResolvedMaterials['rooms'] = {};
  for (const r of itemsOf(doc.rooms)) {
    const lv = levels[(r.level_id as string | null | undefined) || defaultLevel || ''] ?? fallbackLevel;
    rooms[r.id] = { floor: own('rooms', r, 'floor_material_id') ?? roomFloorByTags(r.tags) ?? lv.floor, ceiling: own('rooms', r, 'ceiling_material_id') ?? lv.ceiling, has_ceiling: r.ceiling !== false };
  }
  const walls: ResolvedMaterials['walls'] = {};
  for (const w of itemsOf(doc.walls)) walls[w.id] = own('walls', w, 'material_id') ?? WALL_DEFAULT[String(w.kind)] ?? WALL_FALLBACK;
  const openings: ResolvedMaterials['openings'] = {};
  for (const o of itemsOf(doc.openings)) {
    const def = o.kind === 'window' ? (o.tint === 'frosted' ? 'glass_frosted' : 'glass') : OPENING_DEFAULT[String(o.kind)] ?? null;
    openings[o.id] = own('openings', o, 'material_id') ?? def;
  }
  const objects: ResolvedMaterials['objects'] = {};
  const lights: ResolvedMaterials['lights'] = {};
  for (const o of itemsOf(doc.objects)) {
    const item = (typeof o.item_id === 'string' ? catalog(o.item_id) : undefined) ?? {};
    objects[o.id] = own('objects', o, 'material_id') ?? canonicalMaterial(item.material_id) ?? ROLE_MATERIAL[String(item.role)] ?? OBJECT_FALLBACK;
    if (item.role === 'light') lights[o.id] = resolveLight(o.light as Partial<LampLight> | undefined, item.light);
  }
  warnings.sort((a, b) => cmp(a.path, b.path) || cmp(a.id, b.id) || cmp(a.material_id, b.material_id));
  return { library_version: LIBRARY_VERSION, levels, rooms, walls, openings, objects, lights, warnings };
}
