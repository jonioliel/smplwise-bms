/**
 * Plan Studio 3D (T087, design 10.2 and 10.5): the deterministic scene description. The document, the live anchors and
 * states, the library and the zones go in; a sorted, JSON-serialisable list of parts comes out - boxes, cylinders,
 * prisms, sprites and lights with positions and sizes in metres, colours as design-token names and the id of the item
 * they stand for. No three.js here: scene-three.ts realises the description, unit-scene-builder.spec.ts pins it
 * (contracts/fixtures/plan_geometry/sample-v2.scene.json) and sw-floor-iso draws the building page from the same list.
 * Axes (design 17.1): x east = plan x, z south = plan y, y up; metres from the document's effective scale (the estimate
 * when uncalibrated, flagged). Rotation [pitch about x, yaw about y, 0] in degrees, yaw first (Euler order YXZ).
 * Ruling R-P4-T4-1: one convention for cameras - the forward is -z of the part, the description carries pitch = -tilt,
 * so applying the Euler as it stands looks DOWN by the tilt; consumers derive the view direction from the same Euler.
 */
import { buildPrimitives, DEFAULT_WALL_THICKNESS_M, effectiveScale, MAX_TRIBUNE_ROWS, type CatalogLookup, type ConnectorPrim, type DoorPrim, type GeometryDoc, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall, type ObjectPrim, type ObjectShape, type Pt, type Primitive, type WallPrim, type WindowPrim } from './geometry';
import { defaultLevelId } from './studio-ops';
import { blockingSegments, clipCoverage, isOpenState, type Seg } from './coverage';
import { anchor3d } from './anchor-3d';
import type { MeshPart } from '../api/plan-catalog';

export type { MeshPart };
export type PartKind = 'floor' | 'room' | 'label' | 'wall' | 'lintel' | 'sill' | 'head' | 'door' | 'window' | 'object' | 'connector' | 'camera' | 'cone' | 'entity' | 'glow';
export type PartShape = 'box' | 'cylinder' | 'prism' | 'sprite' | 'light';
export type Vec3 = [number, number, number];

export interface ScenePart {
  id: string;
  kind: PartKind;
  shape: PartShape;
  /** The centre of a box / cylinder / sprite / light; the origin of a prism (its polygon is relative, on the floor). */
  position: Vec3;
  /** box: [w, h, d]; cylinder: [diameter, h, diameter]; prism: [0, h, 0]; sprite: [w, h, 0]; light: [distance, 0, 0]. */
  size: Vec3;
  /** [pitch about x, yaw about y, 0] in degrees, Euler order YXZ. A box along +x turned by yaw -deg(atan2(dz, dx))
   * points along (dx, dz). A camera (forward -z) at bearing b with tilt t carries [-t, -b, 0]: a positive pitch would
   * lift -z up, so the negative one looks down by t (ruling R-P4-T4-1); no consumer applies a second sign. */
  rotation: Vec3;
  /** A token name without the --sw- prefix (map-structure, obj-light, accent, ...): scene-three reads the value. */
  color: string;
  opacity: number;
  /** Parts that share a group become one InstancedMesh (box / cylinder only). */
  group: string | null;
  level_id: string | null;
  /** A prism's outline in metres [x, z] relative to its position. An extruded_polygon object reads its
   * params.polygon as local metres (x right, z down the plan) around the footprint centre, turned by its rotation; a
   * cone's outline is the clipped coverage relative to the camera. */
  polygon?: [number, number][];
  text?: string;
  userData: { id: string; kind: string };
}

export interface SceneAnchor {
  id: string;
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  x: number;
  y: number;
  rotation: number;
  fov: number | null;
  /** Fraction of the plan width (the anchor's coverage_radius); null = the canvas default cone. */
  radius: number | null;
  polygon: [number, number][] | null;
  level_id: string | null;
  layer_id: string;
  label: string;
  state: string | null;
  /** Cameras: the recorder's status; null = unknown. */
  online: boolean | null;
  mount_height_m: number | null;
  tilt_deg: number | null;
}
export interface SceneZone {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  level_id?: string | null;
}
export interface SceneLayers {
  structure: boolean;
  objects: boolean;
  connectors: boolean;
  cameras: boolean;
  entities: boolean;
  zones: boolean;
}
export interface Catalog3D {
  shape: ObjectShape;
  color_token: string;
  role: string;
  mesh: MeshPart[] | null;
}
export type Catalog3DLookup = (itemId: string) => Catalog3D | undefined;
export interface SceneInput {
  doc: GeometryDoc;
  width: number;
  height: number;
  anchors: SceneAnchor[];
  entityStates: Record<string, string | null>;
  circuitStates: Record<string, string | null>;
  catalog?: Catalog3DLookup | null;
  zones?: SceneZone[];
  /** One level only (null / absent = every level). Connectors always show. */
  level?: string | null;
  /** True keeps every camera and entity in the scene regardless of `level` (walls, objects and zones still cull to
   * it). For a screen with no level chips to recover a hidden anchor with (the history map, the event page): 2D
   * never hides anchors either, and the event's own camera must not disappear from "מבט מהמצלמה" (owner review,
   * 0.1.89 fix). The live map and the editor leave this unset: their chips make the cull recoverable. */
  anchorsEveryLevel?: boolean;
  layers?: Partial<SceneLayers>;
  coneRadiusPx?: number;
}
export interface SceneDescription {
  version: 'scene-1';
  units: 'm';
  estimated: boolean;
  scale_m_per_px: number;
  size: [number, number];
  centre: Vec3;
  levels: { id: string; elevation_m: number; ceiling_height_m: number }[];
  parts: ScenePart[];
  groups: Record<string, number>;
  stats: { parts: number; instanced: number; groups: number; walls: number; objects: number; cameras: number; entities: number };
}
export interface IsoFace {
  points: [number, number][];
  face: 'plate' | 'side' | 'top';
  color: string;
  opacity: number;
}
export interface IsoScene {
  faces: IsoFace[];
  levels: number;
}

export const DEFAULT_LAYERS: SceneLayers = { structure: true, objects: true, connectors: true, cameras: true, entities: true, zones: true };
/** The canvas default cone radius in plan pixels (sw-plan-canvas coneRadius). */
export const DEFAULT_CONE_RADIUS_PX = 140;
export const STATE_HE: Record<string, string> = { on: 'דולק', off: 'כבוי', open: 'פתוח', opening: 'נפתח', closed: 'סגור', closing: 'נסגר', locked: 'נעול', unlocked: 'לא נעול', unavailable: 'לא זמין', unknown: 'לא ידוע' };

const FLOOR_PLATE_M = 0.05;
const ROOM_TINT_M = 0.01;
const LABEL_HEIGHT_M = 0.1;
const LEAF_THICKNESS_M = 0.04;
const GLASS_THICKNESS_M = 0.02;
const DOOR_OPEN_DEG = 80;
const CAMERA_BODY: Vec3 = [0.12, 0.1, 0.24];
const STEP_RISE_M = 0.17;
const RAMP_STEP_M = 0.5;
const GLOW_DISTANCE_M = 6;
const MIN_STEP_M = 0.05;
const LEVEL_PAD_M = 0.5;

/** Half-up to 0.1 mm, the r2 rule of the primitives one digit further (metres, not pixels). */
export const r4 = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4;
const v3 = (a: number, b: number, c: number): Vec3 => [r4(a), r4(b), r4(c)];
const deg = (rad: number): number => (rad * 180) / Math.PI;
const rad = (d: number): number => (d * Math.PI) / 180;
const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const groupKey = (shape: PartShape, color: string, opacity: number): string => `${shape}|${color}|${opacity}`;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A low wall and a railing read lighter than the structure; its lintels, sills and heads take the same token. */
const wallColor = (w: GeomWall): string => (w.kind === 'railing' || w.kind === 'low' ? 'map-wall' : 'map-structure');
/** The yaw of a symmetric box lying along the unit direction (dx, dz), folded into (-90, 90] (a box turned by 180 deg is
 * the same box, so a closed leaf carries its wall's yaw whichever jamb it hangs on). */
function leafYaw(dx: number, dz: number): number {
  let y = -deg(Math.atan2(dz, dx));
  if (y > 90 + 1e-9) y -= 180;
  else if (y <= -90 + 1e-9) y += 180;
  return y;
}

/** A local offset (x right, z down the plan) turned by the yaw the part carries (the same mapping three applies). */
function turned(x: number, z: number, yawDeg: number): [number, number] {
  const t = rad(yawDeg);
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}

/** Area-weighted centroid (the vertex mean for a degenerate ring) - the same maths as sw-plan-canvas.polygonCentroid. */
function centroid(poly: { x: number; y: number }[]): { x: number; y: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((t, p) => t + p.x, 0) / n, y: poly.reduce((t, p) => t + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

class Builder {
  readonly parts: ScenePart[] = [];
  readonly scale: number;
  readonly estimated: boolean;
  readonly levels: GeomLevel[];
  readonly defaultLevel: GeomLevel;
  readonly layers: SceneLayers;
  readonly catalogLookup: CatalogLookup | undefined;
  private segCache = new Map<string, Seg[]>();

  constructor(readonly input: SceneInput) {
    const { scale, estimated } = effectiveScale(input.doc);
    this.scale = scale;
    this.estimated = estimated;
    this.levels = input.doc.levels.length ? [...input.doc.levels].sort(byId) : [{ id: defaultLevelId(input.doc), name: '', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }];
    this.defaultLevel = this.levels.find((l) => l.id === defaultLevelId(input.doc)) ?? this.levels[0];
    this.layers = { ...DEFAULT_LAYERS, ...(input.layers ?? {}) };
    const cat = input.catalog;
    this.catalogLookup = cat ? (id) => { const c = cat(id); return c ? { shape: c.shape, icon: 'box', color_token: c.color_token } : undefined; } : undefined;
  }

  /** Plan pixels to metres. */
  m(px: number): number {
    return px * this.scale;
  }
  level(id: string | null | undefined): GeomLevel {
    return (id ? this.levels.find((l) => l.id === id) : undefined) ?? this.defaultLevel;
  }
  shown(levelId: string | null | undefined): boolean {
    const want = this.input.level ?? null;
    return want === null || this.level(levelId).id === want;
  }
  add(p: ScenePart): void {
    this.parts.push({ ...p, position: v3(...p.position), size: v3(...p.size), rotation: v3(...p.rotation), polygon: p.polygon?.map(([x, z]): [number, number] => [r4(x), r4(z)]) });
  }
  box(id: string, kind: PartKind, userData: ScenePart['userData'], centre: Vec3, size: Vec3, yaw: number, color: string, levelId: string | null, opacity = 1, pitch = 0, instanced = true): void {
    this.add({ id, kind, shape: 'box', position: centre, size, rotation: [pitch, yaw, 0], color, opacity, group: instanced ? groupKey('box', color, opacity) : null, level_id: levelId, userData });
  }
  /** A wall's height: its own, else up to the ceiling of its level from its base. */
  wallHeight(w: GeomWall, lv: GeomLevel): number {
    return isNum(w.height_m) && w.height_m > 0 ? w.height_m : Math.max(MIN_STEP_M, lv.ceiling_height_m - (w.base_z_m || 0));
  }

  /** The leaves of a door as the 2D draws them (geometry.ts door(), missing swing = right): none - no leaf; sliding -
   * one leaf on a track 0.12 of the width off the wall on the left-normal side, over the gap when closed and slid one
   * width toward its hinge jamb when open; double - two half leaves hinged at both jambs ("door:<id>#0" at the start,
   * "#1" at the end) opening to the left normal, or to the right normal when the hinge field says end (the same
   * field picks the track side of a sliding door); left / right - one leaf at its hinge jamb opening to that normal. An
   * open leaf stands DOOR_OPEN_DEG off the wall, a closed one lies in the gap. */
  private leaves(o: GeomOpening, g0: [number, number], g1: [number, number], len: number, open: boolean, base: number, levelId: string, ud: ScenePart['userData']): void {
    const swing = o.swing || 'right';
    if (swing === 'none') return;
    const d: [number, number] = [(g1[0] - g0[0]) / len, (g1[1] - g0[1]) / len];
    const nl: [number, number] = [d[1], -d[0]];
    const nr: [number, number] = [-d[1], d[0]];
    const y = base + o.height_m / 2;
    const hingeAtStart = (o.hinge || 'start') === 'start';
    const leaf = (id: string, from: [number, number], dir: [number, number], length: number): void =>
      this.box(id, 'door', ud, [from[0] + (dir[0] * length) / 2, y, from[1] + (dir[1] * length) / 2], [length, o.height_m, LEAF_THICKNESS_M], leafYaw(dir[0], dir[1]), 'accent', levelId, 0.9, 0, false);
    const swung = (closed: [number, number], n: [number, number]): [number, number] => {
      if (!open) return closed;
      const c = Math.cos(rad(DOOR_OPEN_DEG));
      const s = Math.sin(rad(DOOR_OPEN_DEG));
      return [closed[0] * c + n[0] * s, closed[1] * c + n[1] * s];
    };
    const side = hingeAtStart ? nl : nr; // double / sliding: the hinge field picks the side of the wall (geometry.ts door())
    if (swing === 'sliding') {
      const k = 0.12 * len;
      const shift = open ? (hingeAtStart ? -len : len) : 0;
      leaf(`door:${o.id}`, [g0[0] + side[0] * k + d[0] * shift, g0[1] + side[1] * k + d[1] * shift], d, len);
      return;
    }
    if (swing === 'double') {
      leaf(`door:${o.id}#0`, g0, swung(d, side), len / 2);
      leaf(`door:${o.id}#1`, g1, swung([-d[0], -d[1]], side), len / 2);
      return;
    }
    const n = swing === 'left' ? nl : nr;
    leaf(`door:${o.id}`, hingeAtStart ? g0 : g1, swung(hingeAtStart ? d : [-d[0], -d[1]], n), len);
  }

  /** The blocking segments of one level, built once per scene (the door states are fixed for one call) and shared by
   * every camera on it; each cone is then one clipCoverage call, never coveragePolygon (which rebuilds the primitives). */
  segments(levelId: string): Seg[] {
    let s = this.segCache.get(levelId);
    if (!s) {
      s = blockingSegments(this.input.doc, this.input.width, this.input.height, levelId, this.input.entityStates, this.catalogLookup);
      this.segCache.set(levelId, s);
    }
    return s;
  }

  /** The extent of what sits on a level (walls, objects, zones), in metres, padded; null when the level is empty. */
  private bounds(levelId: string): [number, number, number, number] | null {
    const { doc, width, height, zones } = this.input;
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    const take = (x: number, y: number) => {
      minX = Math.min(minX, x * width);
      maxX = Math.max(maxX, x * width);
      minZ = Math.min(minZ, y * height);
      maxZ = Math.max(maxZ, y * height);
    };
    for (const w of doc.walls) if (this.level(w.level_id).id === levelId) for (const p of w.polyline) take(p[0], p[1]);
    for (const o of doc.objects) if (this.level(o.level_id).id === levelId) take(o.position[0], o.position[1]);
    for (const lb of doc.labels) if (this.level(lb.level_id).id === levelId) take(lb.position[0], lb.position[1]);
    for (const c of doc.connectors) if (this.level(c.level_from).id === levelId || (c.level_to && this.level(c.level_to).id === levelId)) for (const p of c.polyline) take(p[0], p[1]);
    for (const z of zones ?? []) if (this.level(z.level_id).id === levelId) for (const p of z.polygon) take(p.x, p.y);
    if (!Number.isFinite(minX)) return null;
    return [this.m(minX) - LEVEL_PAD_M, this.m(minZ) - LEVEL_PAD_M, this.m(maxX) + LEVEL_PAD_M, this.m(maxZ) + LEVEL_PAD_M];
  }

  floors(): void {
    if (!this.layers.structure) return;
    const W = this.m(this.input.width);
    const D = this.m(this.input.height);
    for (const lv of this.levels) {
      if (!this.shown(lv.id)) continue;
      const box = lv.id === this.defaultLevel.id ? ([0, 0, W, D] as [number, number, number, number]) : this.bounds(lv.id);
      if (!box) continue;
      const [x0, z0, x1, z1] = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(W, box[2]), Math.min(D, box[3])];
      this.box(`floor:${lv.id}`, 'floor', { id: lv.id, kind: 'level' }, [(x0 + x1) / 2, lv.elevation_m - FLOOR_PLATE_M / 2, (z0 + z1) / 2], [x1 - x0, FLOOR_PLATE_M, z1 - z0], 0, 'map-bg', lv.id, 1, 0, false);
    }
  }

  rooms(): void {
    if (!this.layers.zones) return;
    const { width, height } = this.input;
    for (const z of [...(this.input.zones ?? [])].sort(byId)) {
      if (z.polygon.length < 3 || !this.shown(z.level_id)) continue;
      const lv = this.level(z.level_id);
      this.add({ id: `room:${z.id}`, kind: 'room', shape: 'prism', position: [0, lv.elevation_m, 0], size: [0, ROOM_TINT_M, 0], rotation: [0, 0, 0], color: 'accent', opacity: 0.1, group: null, level_id: lv.id,
        polygon: z.polygon.map((p): [number, number] => [this.m(p.x * width), this.m(p.y * height)]), userData: { id: z.id, kind: 'zone' } });
      if (z.name) {
        const c = centroid(z.polygon);
        this.add({ id: `room:${z.id}#label`, kind: 'label', shape: 'sprite', position: [this.m(c.x * width), lv.elevation_m + LABEL_HEIGHT_M, this.m(c.y * height)], size: [Math.max(1, 0.2 * z.name.length), 0.4, 0], rotation: [0, 0, 0],
          color: 'text-3', opacity: 1, group: null, level_id: lv.id, text: z.name, userData: { id: z.id, kind: 'zone' } });
      }
    }
  }

  structure(prims: Primitive[]): void {
    if (!this.layers.structure) return;
    const { doc } = this.input;
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    const openings = new Map(doc.openings.map((o) => [o.id, o]));
    for (const p of prims) {
      if (p.kind !== 'wall') continue;
      const w = walls.get(p.id);
      if (!w) continue;
      const lv = this.level(w.level_id);
      const h = this.wallHeight(w, lv);
      const base = lv.elevation_m + (w.base_z_m || 0);
      const t = this.m(p.width);
      const color = wallColor(w);
      const last = p.points.length - 1;
      for (let i = 1; i <= last; i++) {
        let [ax, az] = [this.m(p.points[i - 1][0]), this.m(p.points[i - 1][1])];
        let [bx, bz] = [this.m(p.points[i][0]), this.m(p.points[i][1])];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) continue;
        // a run meeting another run of the same part at a bend grows by half the thickness there (free ends already
        // carry their cap from the primitives), so the outer corner of every bend is filled: the runs overlap inside
        const [ux, uz] = [(bx - ax) / len, (bz - az) / len];
        if (i > 1) [ax, az] = [ax - (ux * t) / 2, az - (uz * t) / 2];
        if (i < last) [bx, bz] = [bx + (ux * t) / 2, bz + (uz * t) / 2];
        // one box per straight segment of the cut wall part: "wall:<id>#<part>" and "wall:<id>#<part>.<segment>" for a bend
        this.box(`wall:${w.id}#${(p as WallPrim).part}${i > 1 ? `.${i - 1}` : ''}`, 'wall', { id: w.id, kind: 'wall' }, [(ax + bx) / 2, base + h / 2, (az + bz) / 2], [Math.hypot(bx - ax, bz - az), h, t], -deg(Math.atan2(uz, ux)), color, lv.id);
      }
    }
    for (const p of prims) {
      if (p.kind !== 'door' && p.kind !== 'window') continue;
      const o = openings.get(p.id);
      const w = o ? walls.get(o.wall_id) : undefined;
      if (!o || !w) continue;
      const lv = this.level(w.level_id);
      const wallH = this.wallHeight(w, lv);
      const base = lv.elevation_m + (w.base_z_m || 0);
      const t = w.thickness_m || DEFAULT_WALL_THICKNESS_M;
      const color = wallColor(w);
      const gap = (p as DoorPrim | WindowPrim).gap;
      const g0: [number, number] = [this.m(gap[0][0]), this.m(gap[0][1])];
      const g1: [number, number] = [this.m(gap[1][0]), this.m(gap[1][1])];
      const len = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
      if (len < 1e-4) continue;
      const yaw = -deg(Math.atan2(g1[1] - g0[1], g1[0] - g0[0]));
      const cx = (g0[0] + g1[0]) / 2;
      const cz = (g0[1] + g1[1]) / 2;
      const ud = { id: o.id, kind: 'opening' };
      if (p.kind === 'door') {
        const lintel = wallH - o.height_m;
        if (lintel > 0.01) this.box(`lintel:${o.id}`, 'lintel', ud, [cx, base + o.height_m + lintel / 2, cz], [len, lintel, t], yaw, color, lv.id);
        const ref = o.anchor_ref;
        const open = !!ref && ref.resource_type === 'ha_entity' && isOpenState(this.input.entityStates[ref.resource_id]);
        this.leaves(o, g0, g1, len, open, base, lv.id, ud);
      } else {
        if (o.sill_m > 0.01) this.box(`sill:${o.id}`, 'sill', ud, [cx, base + o.sill_m / 2, cz], [len, o.sill_m, t], yaw, color, lv.id);
        const head = wallH - (o.sill_m + o.height_m);
        if (head > 0.01) this.box(`head:${o.id}`, 'head', ud, [cx, base + o.sill_m + o.height_m + head / 2, cz], [len, head, t], yaw, color, lv.id);
        this.box(`window:${o.id}`, 'window', ud, [cx, base + o.sill_m + o.height_m / 2, cz], [len, o.height_m, GLASS_THICKNESS_M], yaw, 'map-glass', lv.id, 0.35, 0, false);
      }
    }
    for (const lb of [...doc.labels].sort(byId)) {
      if (!this.shown(lb.level_id)) continue;
      const lv = this.level(lb.level_id);
      const text = String(lb.text ?? '');
      if (!text) continue;
      this.add({ id: `label:${lb.id}`, kind: 'label', shape: 'sprite', position: [this.m(lb.position[0] * this.input.width), lv.elevation_m + LABEL_HEIGHT_M, this.m(lb.position[1] * this.input.height)], size: [Math.max(1, 0.2 * text.length), 0.4, 0],
        rotation: [0, 0, 0], color: 'map-label', opacity: 1, group: null, level_id: lv.id, text, userData: { id: lb.id, kind: 'label' } });
    }
  }

  objects(prims: Primitive[]): void {
    if (!this.layers.objects) return;
    const { doc, catalog, entityStates, circuitStates } = this.input;
    const objects = new Map(doc.objects.map((o) => [o.id, o]));
    for (const p of prims) {
      if (p.kind !== 'object') continue;
      const o = objects.get(p.id);
      if (!o) continue;
      const item = catalog?.(o.item_id);
      const lv = this.level(o.level_id);
      const hM = o.size?.h_m || 0.05;
      const zBase = (o.z_m || 0) >= 0 ? o.z_m || 0 : lv.ceiling_height_m + o.z_m;
      const y0 = lv.elevation_m + zBase;
      const cx = this.m(p.cx);
      const cz = this.m(p.cy);
      const w = this.m(p.w);
      const d = this.m(p.h);
      const yaw = -p.rotation;
      const entityId = p.anchor?.startsWith('ha_entity:') ? p.anchor.slice('ha_entity:'.length) : null;
      const on = (p.circuit_id !== null && circuitStates[p.circuit_id] === 'on') || (entityId !== null && entityStates[entityId] === 'on');
      const lamp = item?.role === 'light' || p.color === 'light';
      const color = on && lamp ? 'map-glow' : `obj-${p.color}`;
      const ud = { id: o.id, kind: 'object' };
      this.objectParts(o, p, item, cx, cz, w, d, hM, y0, yaw, color, lv.id, ud);
      if (on && lamp) this.add({ id: `obj:${o.id}#glow`, kind: 'glow', shape: 'light', position: [cx, y0 + hM / 2, cz], size: [GLOW_DISTANCE_M, 0, 0], rotation: [0, 0, 0], color: 'map-glow', opacity: 1, group: null, level_id: lv.id, userData: ud });
    }
  }

  private objectParts(o: GeomObject, p: ObjectPrim, item: Catalog3D | undefined, cx: number, cz: number, w: number, d: number, hM: number, y0: number, yaw: number, color: string, levelId: string, ud: ScenePart['userData']): void {
    const shape = p.shape;
    if (shape === 'stepped') {
      const rowsRaw = o.params?.rows;
      const rows = isNum(rowsRaw) && Number.isInteger(rowsRaw) && rowsRaw >= 2 ? Math.min(rowsRaw, MAX_TRIBUNE_ROWS) : 4;
      const stepRaw = o.params?.step_height_m;
      const stepH = isNum(stepRaw) && stepRaw > 0 ? stepRaw : hM / rows;
      const rowD = d / rows;
      // a tribune whose connects_levels names a lower level descends into it: the rows stand on that level's floor and
      // share the height difference evenly, so the top row meets the floor the tribune is placed on
      const link = o.params?.connects_levels;
      const lower = typeof link === 'string' ? this.levels.find((l) => l.id === link && l.elevation_m < y0 - 1e-9) : undefined;
      const floor = lower ? lower.elevation_m : y0;
      for (let i = 0; i < rows; i++) {
        const [ox, oz] = turned(0, -d / 2 + (i + 0.5) * rowD, yaw);
        const h = lower ? ((y0 - lower.elevation_m) * (i + 1)) / rows : Math.min(hM, stepH * (i + 1));
        this.box(`obj:${o.id}#${i}`, 'object', ud, [cx + ox, floor + h / 2, cz + oz], [w, h, rowD], yaw, color, levelId, 1, 0, false);
      }
      return;
    }
    if (shape === 'composite' && item?.mesh && item.mesh.length) {
      item.mesh.forEach((m, i) => {
        const [ox, oz] = turned(m.offset[0], m.offset[2], yaw);
        const c = m.color_token ? `obj-${m.color_token}` : color;
        this.add({ id: `obj:${o.id}#${i}`, kind: 'object', shape: m.shape, position: [cx + ox, y0 + m.offset[1], cz + oz], size: [m.size[0], m.size[1], m.size[2]], rotation: [0, yaw, 0], color: c, opacity: 1, group: groupKey(m.shape, c, 1), level_id: levelId, userData: ud });
      });
      return;
    }
    if (shape === 'extruded_polygon') {
      const raw = o.params?.polygon;
      const poly = Array.isArray(raw) ? raw.filter((q): q is [number, number] => Array.isArray(q) && q.length === 2 && isNum(q[0]) && isNum(q[1])) : [];
      if (poly.length >= 3) {
        this.add({ id: `obj:${o.id}`, kind: 'object', shape: 'prism', position: [cx, y0, cz], size: [0, hM, 0], rotation: [0, 0, 0], color, opacity: 1, group: null, level_id: levelId, polygon: poly.map((q) => turned(q[0], q[1], yaw)), userData: ud });
        return;
      }
    }
    const s: PartShape = shape === 'cylinder' ? 'cylinder' : 'box';
    this.add({ id: `obj:${o.id}`, kind: 'object', shape: s, position: [cx, y0 + hM / 2, cz], size: s === 'cylinder' ? [Math.max(w, d), hM, Math.max(w, d)] : [w, hM, d], rotation: [0, yaw, 0], color, opacity: 1, group: groupKey(s, color, 1), level_id: levelId, userData: ud });
  }

  connectors(prims: Primitive[]): void {
    if (!this.layers.connectors) return;
    for (const p of prims) {
      if (p.kind !== 'connector' || (p as ConnectorPrim).ckind === 'tribune') continue;
      const c = p as ConnectorPrim;
      const from = this.level(c.level_from);
      const to = c.level_to ? this.level(c.level_to) : null;
      const e0 = from.elevation_m;
      const e1 = to ? to.elevation_m : from.elevation_m + from.ceiling_height_m;
      const [ax, az] = [this.m(c.points[0][0]), this.m(c.points[0][1])];
      const [bx, bz] = [this.m(c.points[c.points.length - 1][0]), this.m(c.points[c.points.length - 1][1])];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-4) continue;
      const yaw = -deg(Math.atan2(bz - az, bx - ax));
      const width = this.m(c.width);
      const ud = { id: c.id, kind: 'connector' };
      const rise = e1 - e0;
      if (c.ckind === 'elevator') {
        const lower = Math.min(e0, e1);
        const upper = to && to.elevation_m > from.elevation_m ? to : from;
        const top = upper.elevation_m + upper.ceiling_height_m; // the shaft reaches the ceiling of the upper level
        this.box(`conn:${c.id}`, 'connector', ud, [(ax + bx) / 2, (lower + top) / 2, (az + bz) / 2], [L, top - lower, width], yaw, 'obj-circulation', from.id, 0.3, 0, false);
        continue;
      }
      const n = c.ckind === 'ramp' ? Math.max(6, Math.round(L / RAMP_STEP_M)) : Math.max(3, Math.round(Math.abs(rise) / STEP_RISE_M));
      const lower = Math.min(e0, e1);
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const h = Math.max(MIN_STEP_M, rise >= 0 ? (Math.abs(rise) * (i + 1)) / n : (Math.abs(rise) * (n - i)) / n);
        this.box(`conn:${c.id}#${i}`, 'connector', ud, [ax + (bx - ax) * f, lower + h / 2, az + (bz - az) * f], [L / n, h, width], yaw, 'obj-circulation', from.id);
      }
    }
  }

  anchors(): void {
    const { anchors, doc, width, height, coneRadiusPx } = this.input;
    const bodies = new Set(doc.objects.filter((o) => o.anchor_ref?.resource_id).map((o) => `${o.anchor_ref!.resource_type}:${o.anchor_ref!.resource_id}`));
    for (const a of [...anchors].sort(byId)) {
      if (!this.input.anchorsEveryLevel && !this.shown(a.level_id)) continue;
      const lv = this.level(a.level_id);
      const { mount_height_m: mount, tilt_deg: tilt } = anchor3d(a);
      const px = a.x * width;
      const py = a.y * height;
      const x = this.m(px);
      const z = this.m(py);
      if (a.resource_type === 'camera') {
        if (!this.layers.cameras) continue;
        const color = a.online === false ? 'offline' : 'accent';
        const ud = { id: a.id, kind: 'camera' };
        this.box(`cam:${a.id}`, 'camera', ud, [x, lv.elevation_m + mount, z], CAMERA_BODY, -a.rotation, color, lv.id, 1, -tilt, false); // R-P4-T4-1: pitch = -tilt looks down
        if (a.fov && a.fov > 0) {
          const radiusPx = a.radius ? Math.max(12, a.radius * width) : coneRadiusPx ?? DEFAULT_CONE_RADIUS_PX;
          const pts: Pt[] = a.polygon && a.polygon.length >= 3 ? a.polygon.map(([qx, qy]) => [qx * width, qy * height]) : clipCoverage([px, py], a.rotation, a.fov, radiusPx, this.segments(a.level_id ?? defaultLevelId(doc))); // the level key of the 2D cone
          this.add({ id: `cam:${a.id}#cone`, kind: 'cone', shape: 'prism', position: [x, lv.elevation_m, z], size: [0, mount, 0], rotation: [0, 0, 0], color, opacity: 0.12, group: null, level_id: lv.id, polygon: pts.map((q): [number, number] => [this.m(q[0] - px), this.m(q[1] - py)]), userData: ud });
        }
        continue;
      }
      if (!this.layers.entities || bodies.has(`ha_entity:${a.resource_id}`)) continue;
      // the live state of the entity wins over the one stored with the anchor, so the sprite and the door leaf agree
      const state = Object.prototype.hasOwnProperty.call(this.input.entityStates, a.resource_id) ? this.input.entityStates[a.resource_id] : a.state;
      const color = state === null || state === 'unavailable' || state === 'unknown' ? 'stale' : isOpenState(state) ? 'live' : 'text-3';
      const text = `${a.label}${state && STATE_HE[state] ? ` · ${STATE_HE[state]}` : ''}`;
      const ud = { id: a.id, kind: 'entity' };
      this.add({ id: `ent:${a.id}`, kind: 'entity', shape: 'sprite', position: [x, lv.elevation_m + mount + 0.25, z], size: [Math.max(1.2, 0.18 * text.length), 0.36, 0], rotation: [0, 0, 0], color, opacity: 1, group: null, level_id: lv.id, text, userData: ud });
      if (a.layer_id === 'lights' && state === 'on') this.add({ id: `ent:${a.id}#glow`, kind: 'glow', shape: 'light', position: [x, lv.elevation_m + mount, z], size: [GLOW_DISTANCE_M, 0, 0], rotation: [0, 0, 0], color: 'map-glow', opacity: 1, group: null, level_id: lv.id, userData: ud });
    }
  }

  finish(): SceneDescription {
    this.parts.sort(byId);
    const groups: Record<string, number> = {};
    let instanced = 0;
    for (const p of this.parts) {
      if (!p.group) continue;
      groups[p.group] = (groups[p.group] ?? 0) + 1;
      instanced++;
    }
    const count = (k: PartKind) => this.parts.filter((p) => p.kind === k).length;
    const W = r4(this.m(this.input.width));
    const D = r4(this.m(this.input.height));
    return {
      version: 'scene-1', units: 'm', estimated: this.estimated, scale_m_per_px: this.scale, size: [W, D], centre: v3(W / 2, 0, D / 2),
      levels: this.levels.filter((l) => this.shown(l.id)).map((l) => ({ id: l.id, elevation_m: l.elevation_m, ceiling_height_m: l.ceiling_height_m })),
      parts: this.parts, groups,
      stats: { parts: this.parts.length, instanced, groups: Object.keys(groups).length, walls: count('wall'), objects: count('object'), cameras: count('camera'), entities: count('entity') },
    };
  }
}

/** The description of one floor: the same document, anchors, states, library and zones always give the same JSON. */
export function buildScene(input: SceneInput): SceneDescription {
  const b = new Builder(input);
  const prims = buildPrimitives(input.doc, input.width, input.height, input.level ?? null, b.catalogLookup);
  b.floors();
  b.rooms();
  b.structure(prims);
  b.objects(prims);
  b.connectors(prims);
  b.anchors();
  return b.finish();
}

// ---------------------------------------------------------------- the building page (SC03)

/** The thumbnail box of the building page (0 0 120 72): a true isometric with the classic 30 deg axes (ground x and z
 * foreshortened alike, sqrt(3):1 between their horizontal and vertical screen components, the camera's elevation
 * 35.26 deg) and one scale for every axis. A unit square (u, v in 0..1) spans 100 x 57.7 thumbnail units around the
 * centre (60, 6 + 28.9); sw-floor-iso's demo slab uses the same points. */
export const ISO_THUMB = { cx: 60, top: 6, half: 50, rise: 50 / Math.sqrt(3) } as const;
export function isoPoint(u: number, v: number): { x: number; y: number } {
  return { x: ISO_THUMB.cx + (u - v) * ISO_THUMB.half, y: ISO_THUMB.top + (u + v) * ISO_THUMB.rise };
}
/** The most faces one floor's thumbnail draws; beyond it the smallest wall boxes (by footprint) are skipped. */
export const ISO_FACE_CAP = 600;
const ISO_KINDS: readonly PartKind[] = ['floor', 'wall'];

/** The isometric thumbnail of the building page from the same description: the floor plates and the wall boxes
 * (lintels, sills, heads, connectors, objects and anchors are left out), one metre scale for x, y and z (the longer
 * side of the plan spans the unit square, the plan centred on it), levels painted bottom to top by elevation (a higher
 * level's plate covers the walls below it), inside a level the plate first and then the boxes far to near, each box's
 * sides before its top. At most ISO_FACE_CAP faces: the plates always, then the walls by footprint, largest first. */
export function isoProjection(desc: SceneDescription): IsoScene {
  const [W, D] = desc.size;
  const M = Math.max(W, D, 1e-6);
  const unit = Math.hypot(ISO_THUMB.half, ISO_THUMB.rise) / M; // thumbnail units per metre along every axis
  const proj = (x: number, y: number, z: number): [number, number] => {
    const p = isoPoint((x - W / 2) / M + 0.5, (z - D / 2) / M + 0.5);
    return [Math.round(p.x * 10) / 10, Math.round((p.y - y * unit) * 10) / 10];
  };
  const levels = [...desc.levels].sort((a, b) => a.elevation_m - b.elevation_m || (a.id < b.id ? -1 : 1));
  const rank = new Map(levels.map((l, i) => [l.id, i]));
  const levelOf = (p: ScenePart) => (p.level_id !== null && rank.has(p.level_id) ? rank.get(p.level_id)! : 0);
  const boxes = desc.parts.filter((p) => p.shape === 'box' && ISO_KINDS.includes(p.kind));
  const plates = boxes.filter((p) => p.kind === 'floor');
  const walls = boxes.filter((p) => p.kind !== 'floor');
  const room = Math.max(0, Math.floor((ISO_FACE_CAP - plates.length) / 5)); // a wall box draws four sides and a top
  const kept = walls.length > room ? [...walls].sort((a, b) => b.size[0] * b.size[2] - a.size[0] * a.size[2] || (a.id < b.id ? -1 : 1)).slice(0, room) : walls;
  const faces: { level: number; depth: number; order: number; face: IsoFace }[] = [];
  let n = 0;
  for (const p of [...plates, ...kept]) {
    const [cx, cy, cz] = p.position;
    const [w, h, d] = p.size;
    const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => { const [ox, oz] = turned((sx * w) / 2, (sz * d) / 2, p.rotation[1]); return [cx + ox, cz + oz] as [number, number]; });
    const level = levelOf(p);
    const top = cy + h / 2;
    const bottom = cy - h / 2;
    if (p.kind === 'floor') {
      faces.push({ level, depth: -1e9 + n++, order: 0, face: { points: corners.map(([x, z]) => proj(x, top, z)), face: 'plate', color: p.color, opacity: p.opacity } });
      continue;
    }
    const depth = cx + cz;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      faces.push({ level, depth, order: 1, face: { points: [proj(a[0], bottom, a[1]), proj(b[0], bottom, b[1]), proj(b[0], top, b[1]), proj(a[0], top, a[1])], face: 'side', color: p.color, opacity: p.opacity } });
    }
    faces.push({ level, depth, order: 2, face: { points: corners.map(([x, z]) => proj(x, top, z)), face: 'top', color: p.color, opacity: p.opacity } });
  }
  faces.sort((a, b) => a.level - b.level || a.depth - b.depth || a.order - b.order);
  return { faces: faces.map((f) => f.face), levels: desc.levels.length };
}

/** The building page's thumbnail cache without the versions no longer listed. The listed versions bound it (one entry
 * per listed floor at most); no count cap, which would evict a floor still on screen and fetch it again in a loop. */
export function keepIsos<T>(cache: Map<string, T>, listed: Iterable<string>): Map<string, T> {
  const live = new Set(listed);
  return new Map([...cache].filter(([k]) => live.has(k)));
}
