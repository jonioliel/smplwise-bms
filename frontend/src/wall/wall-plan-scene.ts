/**
 * Plan Studio 6, slice S5-B (CR-030 section 4.1, docs/changes/CR-029-ST7-S5B-NOTES.md): what the map band of a wall display knows
 * and draws. Pure functions over the floor's map bundle and its structure document.
 *
 * A wall user holds `map.read` and `video.live` only (the `kiosk` role): the bundle brings the structure, the zones, the stills and the
 * CIRCUIT switches of the floor - not entity states. So the wall knows which circuits are on (a lit lamp is a circuit member), and
 * from that which rooms are lit; it knows nothing of doors, presence or temperatures, and draws none. A switch that is not fresh is
 * unknown and lights nothing (the state layer's rule: stale is not on).
 */
import type { MapBundle } from '../api/maps';
import type { GeometryDoc } from '../map/geometry';
import { buildScene, type Catalog3DLookup, type SceneDescription } from '../map/scene-builder';
import type { CatalogMaterialLookup } from '../map/material-resolve';
import { roomStates, type RoomStateLayer, type StateLamp } from '../map/room-state';
import { defaultLevelId } from '../map/studio-ops';

/** circuit id -> 'on' / 'off' / ..., or null when the switch is not fresh. */
export function wallCircuitStates(b: Pick<MapBundle, 'circuitStates'>): Record<string, string | null> {
  return Object.fromEntries(Object.entries(b.circuitStates).map(([id, c]) => [id, c.fresh === false ? null : c.state]));
}

/** The lamps of the structure that glow by their circuit: position, level and whether the circuit is on now. */
export function wallLamps(doc: GeometryDoc, circuits: Record<string, string | null>): StateLamp[] {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const out: StateLamp[] = [];
  for (const k of doc.circuits) {
    const on = circuits[k.id] === 'on';
    for (const m of k.member_ids) {
      const o = byId.get(m);
      if (o) out.push({ x: o.position[0], y: o.position[1], level_id: o.level_id, on });
    }
  }
  return out;
}

/** The room state layer a wall can know: lit rooms from the circuits (null: the floor has no zones, or no structure yet). */
export function wallRoomStates(b: Pick<MapBundle, 'zones' | 'width' | 'height' | 'scaleMPerPx' | 'levels' | 'circuitStates'>, doc: GeometryDoc | null, now: number): RoomStateLayer | null {
  if (!doc || !b.zones.length) return null;
  const fallback = defaultLevelId(doc);
  const rooms = b.zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: z.level_id ?? null }));
  return roomStates({ rooms, entities: [], openings: [], lamps: wallLamps(doc, wallCircuitStates(b)), size: [b.width, b.height], scaleMPerPx: b.scaleMPerPx, now, fade: 'off', levelOf: (id) => id ?? fallback });
}

/** The level a wall shows: the floor's default level when it has several (one level at a time keeps the picture readable), else all. */
export function wallLevel(b: Pick<MapBundle, 'levels'>): string | null {
  if (b.levels.length < 2) return null;
  return b.levels.find((l) => l.is_default)?.id ?? b.levels[0].id;
}

export interface WallSceneParts {
  bundle: MapBundle;
  geometry: GeometryDoc | null;
  catalog3d: Catalog3DLookup | null;
  materials: CatalogMaterialLookup | null;
}

/** The scene of the map band: structure, objects, connectors and rooms of one level, lamps glowing by their circuits, the lit rooms of
 * the state layer; no cameras, no entity pins (nothing on the wall is operated). `realistic` adds the level-3 part when the element
 * draws it. null without a structure document. */
export function wallScene(p: WallSceneParts, o: { level: string | null; realistic: boolean; layer: RoomStateLayer | null }): SceneDescription | null {
  const { bundle: b, geometry: doc } = p;
  if (!doc) return null;
  return buildScene({
    doc, width: b.width, height: b.height, anchors: [], entityStates: {}, circuitStates: wallCircuitStates(b), catalog: p.catalog3d,
    zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })),
    level: o.level, layers: { structure: true, objects: true, connectors: true, zones: true, cameras: false, entities: false },
    roomStates: o.layer, realistic: o.realistic, materialsCatalog: p.materials,
  });
}
