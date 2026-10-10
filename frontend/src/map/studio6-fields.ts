/**
 * Plan Studio 6, slice S0 (CR-029): the document 2.2 fields of the realistic level and the eye-level walk - the mirror of
 * the backend's services/plan_studio6.py (the same version rule, limits and enums) - and the pure edit operations the
 * editor and the walk use on them (set a material, the north, the saved walk positions). No DOM and no Lit: runs in node
 * (tests/unit-material-resolve.spec.ts, tests/unit-studio6-fields.spec.ts).
 *
 * Document 2.2 is written only when one of these fields is present (an empty walk_positions list is the same as none), so
 * every other document keeps its 2.0 / 2.1 version byte for byte.
 */
import type { GeometryDoc } from './geometry';
import type { GlassTint } from './glass-wall';

export const STUDIO6_SCHEMA_VERSION = '2.2' as const;
export const LIGHT_KINDS = ['ceiling', 'wall', 'spot', 'strip', 'floor', 'pendant'] as const;
export type LightKind = (typeof LIGHT_KINDS)[number];
export const COLOR_K_RANGE: readonly [number, number] = [1800, 6500];
export const LUMENS_RANGE: readonly [number, number] = [1, 20000];
export const BEAM_RANGE: readonly [number, number] = [1, 180];
export const MAX_WALK_POSITIONS = 50;
export const MAX_POSITION_NAME = 40;

/** A lamp's emission (objects of role light). Absent = the catalog item's, else 3000 K / 800 lm on the ceiling. */
export interface LampLight {
  kind: LightKind;
  color_k: number;
  lumens: number;
  beam_deg?: number;
}
/** A saved eye-level viewpoint (CR-029 section 4.4): plan space 0..1, the heading clockwise from plan up. */
export interface WalkPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  level_id: string;
  heading_deg: number;
  is_default?: boolean;
}
export type { GlassTint };

const ITEM_KEYS: Record<string, readonly string[]> = {
  walls: ['material_id'],
  openings: ['material_id', 'tint'],
  objects: ['material_id', 'light'],
  rooms: ['floor_material_id', 'ceiling_material_id', 'ceiling'],
  levels: ['floor_material_id', 'ceiling_material_id'],
};

/** Whether the document needs version 2.2 (plan_studio6.uses_studio6): any Studio 6 field present. Loose on purpose:
 * it reads a document mid-edit whatever its shape. */
export function usesStudio6(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Record<string, unknown>;
  if ((d.north_deg !== undefined && d.north_deg !== null) || (Array.isArray(d.walk_positions) && d.walk_positions.length > 0)) return true;
  for (const [coll, keys] of Object.entries(ITEM_KEYS)) {
    const items = d[coll];
    if (Array.isArray(items) && items.some((it) => !!it && typeof it === 'object' && keys.some((k) => (it as Record<string, unknown>)[k] !== undefined && (it as Record<string, unknown>)[k] !== null))) return true;
  }
  return false;
}

/** Fold a heading into [0, 360) at 0.001 degree (plan_studio6.normalize). */
export function foldHeading(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const h = Math.round((((deg % 360) + 360) % 360) * 1000) / 1000;
  return h >= 360 ? 0 : h + 0;
}

/** The document with the plan's north set (null removes it: plan up is north). */
export function setNorth(doc: GeometryDoc, deg: number | null): GeometryDoc {
  const out = { ...doc };
  if (deg === null) delete out.north_deg;
  else out.north_deg = foldHeading(deg);
  return out;
}

type MaterialHost = 'walls' | 'openings' | 'objects';
/** One item's material (null removes the field: the default by kind / catalog / role applies again). */
export function setItemMaterial(doc: GeometryDoc, coll: MaterialHost, id: string, materialId: string | null): GeometryDoc {
  const list = (doc[coll] as { id: string; material_id?: string }[]).map((it) => {
    if (it.id !== id) return it;
    const next = { ...it };
    if (materialId === null) delete next.material_id;
    else next.material_id = materialId;
    return next;
  });
  return { ...doc, [coll]: list } as GeometryDoc;
}

/** A room's or a level's floor / ceiling material, or a room's ceiling flag (true = the default, stored as absent). */
export function setSurface(doc: GeometryDoc, coll: 'rooms' | 'levels', id: string, key: 'floor_material_id' | 'ceiling_material_id' | 'ceiling', value: string | boolean | null): GeometryDoc {
  const list = (doc[coll] as unknown as Record<string, unknown>[]).map((it) => {
    if (it.id !== id) return it;
    const next = { ...it };
    if (value === null || (key === 'ceiling' && value === true)) delete next[key];
    else next[key] = value;
    return next;
  });
  return { ...doc, [coll]: list } as unknown as GeometryDoc;
}

/** Add (or replace by id) a saved walk position; `is_default` on one clears it on the others. At most MAX_WALK_POSITIONS. */
export function upsertWalkPosition(doc: GeometryDoc, p: WalkPosition): GeometryDoc {
  const list = [...(doc.walk_positions ?? [])];
  const clean: WalkPosition = { ...p, name: p.name.trim().slice(0, MAX_POSITION_NAME), x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), heading_deg: foldHeading(p.heading_deg) };
  if (!clean.is_default) delete clean.is_default;
  const at = list.findIndex((q) => q.id === p.id);
  if (at >= 0) list[at] = clean;
  else if (list.length < MAX_WALK_POSITIONS) list.push(clean);
  else return doc;
  const out = clean.is_default ? list.map((q) => (q.id === clean.id || !q.is_default ? q : (({ is_default: _d, ...rest }) => rest)(q))) : list;
  return { ...doc, walk_positions: out };
}

/** Remove a saved walk position; the list goes when it is empty (absent and empty are the same). */
export function removeWalkPosition(doc: GeometryDoc, id: string): GeometryDoc {
  const list = (doc.walk_positions ?? []).filter((q) => q.id !== id);
  const out: GeometryDoc = { ...doc, walk_positions: list };
  if (!list.length) delete out.walk_positions;
  return out;
}

/** Move a saved position one step up or down (the route order = the list order; position 1 is the first). */
export function moveWalkPosition(doc: GeometryDoc, id: string, delta: -1 | 1): GeometryDoc {
  const list = [...(doc.walk_positions ?? [])];
  const i = list.findIndex((q) => q.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return doc;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...doc, walk_positions: list };
}
