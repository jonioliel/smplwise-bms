/**
 * Plan Studio 6, slice S1 (CR-029 section 3.1, LOOK_SPEC sections 2, 5, 6, 13): the realistic level's part of the scene
 * description - deterministic, three-free, JSON-serialisable, built only when SceneInput.realistic is set (levels 1-2
 * never see it, so their descriptions and baselines do not move). scene-real.ts realises it.
 *
 * What it carries, next to the unchanged `parts`:
 * - `materials` / `radius`: the library material and the bevel radius of every base part the realistic level draws (the
 *   resolver's answer per wall, opening, object, level; LOOK_SPEC section 6 bevel rule: none under 0.12 m, else a few cm);
 * - `parts`: the detail geometry families (skirting, door frames and casings, handles on the leaves, window frames, sills,
 *   mullions and transoms, the procedural furniture families - sofa, chair, table, desk, cabinet, bed, plant, tree - and
 *   the lamp bodies with their bulbs). A family part `owner`s the base part it replaces (`replaced`), so a model drawn
 *   for the object hides both;
 * - `floors`: one plate per room in the room's floor material; `caps`: the section-cut poche - each wall footprint at the
 *   cut height (elevation + ceiling x 0.6) of its level; `models`: the kit model per object of a mapped item (drawn only
 *   in the `models` furniture mode, a per-item fallback to the families otherwise); `lamps`: every lamp's bulb point,
 *   kind, colour temperature, lumens and state; `shutters`: a roller shutter per window bound to a cover entity, down by
 *   its state; `rooms`: each room's daylight factor (glazed area / floor area x 5).
 * Rounded to 0.1 mm like every part; sorted by id.
 */
import type { GeomLevel, GeomOpening, GeomWall, GeometryDoc, Primitive, DoorPrim, WindowPrim } from './geometry';
import { resolveMaterials, type CatalogMaterialLookup, type ResolvedMaterials } from './material-resolve';
import { MODEL_MAP } from './plan3d-assets';
import { daylightFactor } from './look-style';
import type { ScenePart, SceneInput, Vec3 } from './scene-builder';

export type RealShape = 'box' | 'rbox' | 'cyl' | 'sphere';
export interface RealPart {
  id: string;
  /** The base part this part belongs to: picking reports its item, a door leaf carries it as it swings, a model replaces it. */
  owner: string;
  userData: { id: string; kind: string };
  level_id: string | null;
  shape: RealShape;
  /** Centre; box / rbox [w, h, d]; cyl [diameter, h, diameter] (bottom diameter, `taper` = top / bottom); sphere [d, d, d]. */
  position: Vec3;
  size: Vec3;
  rotation: Vec3;
  material: string;
  radius?: number;
  taper?: number;
  /** A lamp's light-emitting face: emissive in the lamp's colour temperature while the lamp is on. */
  bulb?: string;
  shadow: boolean;
}
export interface RealFloor {
  id: string;
  zone: string;
  level_id: string;
  y: number;
  polygon: [number, number][];
  material: string;
}
export interface RealCap {
  id: string;
  level_id: string;
  y: number;
  polygon: [number, number][];
}
export interface RealModel {
  id: string;
  owner: string;
  item: string;
  level_id: string;
  /** Floor centre of the authored box. */
  position: Vec3;
  /** [w, h, d] of one module (a tiled run: of each module). */
  size: Vec3;
  yaw: number;
  /** Module centres along the run (one entry for a single model). */
  tiles: Vec3[];
}
export interface RealLamp {
  id: string;
  owner: string;
  level_id: string;
  position: Vec3;
  kind: string;
  color_k: number;
  lumens: number;
  beam_deg?: number;
  on: boolean;
}
export interface RealShutter {
  id: string;
  entity: string;
  level_id: string;
  /** Top centre of the slat curtain (just under the housing), outside the wall. */
  position: Vec3;
  width: number;
  height: number;
  yaw: number;
  /** 0 = up (open) .. 1 = down (closed); a stale or unknown state is up (never animated). */
  down: number;
}
export interface RealWorld {
  version: 'real-1';
  library_version: string;
  north_deg: number;
  materials: Record<string, string>;
  radius: Record<string, number>;
  replaced: string[];
  parts: RealPart[];
  floors: RealFloor[];
  caps: RealCap[];
  models: RealModel[];
  lamps: RealLamp[];
  shutters: RealShutter[];
  rooms: Record<string, { daylight: number }>;
  warnings: ResolvedMaterials['warnings'];
}

/** What the builder hands over (scene-builder.ts Builder): its metre conversion, levels and wall heights. */
export interface RealContext {
  input: SceneInput;
  parts: ScenePart[];
  prims: Primitive[];
  m: (px: number) => number;
  level: (id: string | null | undefined) => GeomLevel;
  shown: (levelId: string | null | undefined) => boolean;
  wallHeight: (w: GeomWall, lv: GeomLevel) => number;
}

const r4 = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4;
const v3 = (a: number, b: number, c: number): Vec3 => [r4(a), r4(b), r4(c)];
const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;
const cmp = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** A local offset (x right, z down the plan) turned by a yaw (the mapping three applies to the parts). */
function turned(x: number, z: number, yawDeg: number): [number, number] {
  const t = rad(yawDeg);
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}
/** LOOK_SPEC section 6: no bevel under 0.12 m; furniture bodies 2-6 cm by their smallest side. */
export function bevelRadius(w: number, h: number, d: number): number {
  const s = Math.min(w, h, d);
  if (s < 0.12) return 0;
  return r4(Math.min(0.05, Math.max(0.012, s * 0.06)));
}
const SKIRTING_H = 0.08;
const SKIRTING_T = 0.012;
const DOOR_FRAME = 0.05;
const CASING_W = 0.07;
const CASING_PROUD = 0.012;
const WIN_FRAME = 0.06;
const SILL_T = 0.03;
const HANDLE_Y = 1.02;
const SHUTTER_BOX = 0.22;

/** Builds the realistic part (module note). */
export function buildReal(ctx: RealContext, catalog: CatalogMaterialLookup): RealWorld {
  const { input } = ctx;
  const doc: GeometryDoc = input.doc;
  const resolved = resolveMaterials(doc, catalog);
  const out: RealWorld = { version: 'real-1', library_version: resolved.library_version, north_deg: typeof doc.north_deg === 'number' && Number.isFinite(doc.north_deg) ? doc.north_deg : 0, materials: {}, radius: {}, replaced: [], parts: [], floors: [], caps: [], models: [], lamps: [], shutters: [], rooms: {}, warnings: resolved.warnings };
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const openings = new Map(doc.openings.map((o) => [o.id, o]));
  const objects = new Map(doc.objects.map((o) => [o.id, o]));
  const add = (p: Omit<RealPart, 'position' | 'size' | 'rotation'> & { position: number[]; size: number[]; rotation?: number[] }): void => {
    const rot = p.rotation ?? [0, 0, 0];
    out.parts.push({ ...p, position: v3(p.position[0], p.position[1], p.position[2]), size: v3(p.size[0], p.size[1], p.size[2]), rotation: v3(rot[0], rot[1], rot[2]) });
  };

  // ---- materials and bevels of the base parts
  const levelFloor = (id: string | null) => resolved.levels[id ?? '']?.floor ?? 'concrete';
  for (const p of ctx.parts) {
    const ud = p.userData;
    let mat: string | null = null;
    if (p.kind === 'floor') mat = levelFloor(p.level_id);
    else if (p.kind === 'wall' || p.kind === 'lintel' || p.kind === 'sill' || p.kind === 'head') {
      if (ud.kind === 'wall') {
        const w = walls.get(ud.id);
        const wm = resolved.walls[ud.id] ?? 'plaster_white';
        // a window wall's frame (posts, rails, sills, heads, mullions) is metal; its own material is the glass
        mat = w?.kind === 'glass' || p.id.startsWith('glazing:') ? 'metal_dark' : wm;
      } else if (ud.kind === 'opening') {
        const o = openings.get(ud.id);
        mat = (o && resolved.walls[o.wall_id]) || 'plaster_white';
      } else mat = 'plaster_white'; // a shared volume's outline
    } else if (p.kind === 'door') mat = resolved.openings[ud.id] ?? 'door_wood';
    else if (p.kind === 'window') mat = ud.kind === 'opening' ? resolved.openings[ud.id] ?? 'glass' : 'glass';
    else if (p.kind === 'object') mat = resolved.objects[ud.id] ?? 'plastic';
    else if (p.kind === 'connector') mat = p.opacity < 1 ? 'glass' : 'concrete';
    else if (p.kind === 'camera') mat = 'metal_light';
    if (mat) out.materials[p.id] = mat;
    if (p.kind === 'door' && p.shape === 'box') out.radius[p.id] = 0.006;
    else if (p.kind === 'object' && p.shape === 'box') {
      const r = bevelRadius(p.size[0], p.size[1], p.size[2]);
      if (r > 0) out.radius[p.id] = r;
    }
  }

  // ---- skirting along the interior faces of walls standing on their floor, and the section caps
  for (const p of ctx.parts) {
    if (p.kind !== 'wall' || p.shape !== 'box' || p.userData.kind !== 'wall' || p.id.startsWith('glazing:')) continue;
    const w = walls.get(p.userData.id);
    if (!w || w.kind === 'railing' || w.kind === 'low' || w.kind === 'glass' || (w.base_z_m || 0) > 0.01) continue;
    const lv = ctx.level(w.level_id);
    const [len, h, t] = p.size;
    const yaw = p.rotation[1];
    const floorY = lv.elevation_m;
    if (len > 0.3 && w.kind !== 'exterior') {
      for (const s of [-1, 1]) {
        const [ox, oz] = turned(0, s * (t / 2 + SKIRTING_T / 2), yaw);
        add({ id: `${p.id}~sk${s < 0 ? 'a' : 'b'}`, owner: p.id, userData: p.userData, level_id: p.level_id, shape: 'box', position: [p.position[0] + ox, floorY + SKIRTING_H / 2, p.position[2] + oz], size: [len, SKIRTING_H, SKIRTING_T], rotation: [0, yaw, 0], material: 'plaster_ceiling', shadow: false });
      }
    }
    const cutY = floorY + lv.ceiling_height_m * 0.6;
    if (h >= lv.ceiling_height_m * 0.5 && p.position[1] + h / 2 > cutY + 0.01 && p.position[1] - h / 2 < cutY) {
      const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]): [number, number] => { const [ox, oz] = turned((sx * len) / 2, (sz * t) / 2, yaw); return [r4(p.position[0] + ox), r4(p.position[2] + oz)]; });
      out.caps.push({ id: `cap:${p.id}`, level_id: p.level_id ?? lv.id, y: r4(cutY), polygon: corners });
    }
  }

  // ---- doors (frame, casings, handles on the leaves) and windows (frame, sill, mullions, transom, shutters)
  const extent = sceneCentre(ctx);
  for (const pr of ctx.prims) {
    if (pr.kind !== 'door' && pr.kind !== 'window') continue;
    const o = openings.get(pr.id);
    const w = o ? walls.get(o.wall_id) : undefined;
    if (!o || !w || !ctx.shown(w.level_id)) continue;
    const lv = ctx.level(w.level_id);
    const base = lv.elevation_m + (w.base_z_m || 0);
    const gap = (pr as DoorPrim | WindowPrim).gap;
    const g0: [number, number] = [ctx.m(gap[0][0]), ctx.m(gap[0][1])];
    const g1: [number, number] = [ctx.m(gap[1][0]), ctx.m(gap[1][1])];
    const len = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
    if (len < 0.05) continue;
    const d: [number, number] = [(g1[0] - g0[0]) / len, (g1[1] - g0[1]) / len];
    const yaw = -deg(Math.atan2(d[1], d[0]));
    const c: [number, number] = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
    const t = w.thickness_m || 0.15;
    const ud = { id: o.id, kind: 'opening' };
    const at = (along: number): [number, number] => [c[0] + d[0] * along, c[1] + d[1] * along];
    if (pr.kind === 'door') doorDetails(o, ud, g0, g1, d, len, yaw, c, t, base, lv, add, ctx, at);
    else windowDetails(o, w, ud, d, len, yaw, c, t, base, lv, add, at, out, input, extent);
  }

  // ---- objects: models, procedural families, lamps
  const byObject = new Map<string, ScenePart[]>();
  for (const p of ctx.parts) if (p.kind === 'object' && p.userData.kind === 'object') byObject.set(p.userData.id, [...(byObject.get(p.userData.id) ?? []), p]);
  const glowing = new Set(ctx.parts.filter((p) => p.kind === 'glow' && p.userData.kind === 'object').map((p) => p.userData.id));
  for (const [oid, ps] of [...byObject].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const o = objects.get(oid);
    if (!o || ps.length !== 1) continue; // tribunes (several rows) and polygons keep their base parts
    const p = ps[0];
    if (p.shape !== 'box' && p.shape !== 'cylinder') continue;
    const item = catalog(o.item_id) ?? {};
    const mat = out.materials[p.id] ?? 'plastic';
    if (item.role === 'light' || resolved.lights[oid]) {
      lampFamily(o, p, resolved, glowing.has(oid), add, out);
      continue;
    }
    const model = MODEL_MAP[o.item_id];
    if (model && p.shape === 'box') {
      const [w, h, dd] = p.size;
      const yawM = p.rotation[1];
      const bottom = p.position[1] - h / 2;
      const tiles: Vec3[] = [];
      if (model.tile_m) {
        const n = Math.max(1, Math.round(w / model.tile_m));
        for (let i = 0; i < n; i++) { const [ox, oz] = turned(-w / 2 + ((i + 0.5) * w) / n, 0, yawM); tiles.push(v3(p.position[0] + ox, bottom, p.position[2] + oz)); }
        out.models.push({ id: `model:${oid}`, owner: p.id, item: o.item_id, level_id: p.level_id ?? '', position: v3(p.position[0], bottom, p.position[2]), size: v3(w / n, h, dd), yaw: r4(yawM), tiles });
      } else out.models.push({ id: `model:${oid}`, owner: p.id, item: o.item_id, level_id: p.level_id ?? '', position: v3(p.position[0], bottom, p.position[2]), size: v3(w, h, dd), yaw: r4(yawM), tiles: [v3(p.position[0], bottom, p.position[2])] });
    }
    if (furnitureFamily(o.item_id, p, mat, add)) out.replaced.push(p.id);
  }
  // lamps whose base part is replaced by their family
  for (const l of out.lamps) out.replaced.push(l.owner);

  // ---- room floors and daylight
  const windowPrims = new Map(ctx.prims.filter((q): q is WindowPrim => q.kind === 'window').map((q) => [q.id, q]));
  for (const z of [...(input.zones ?? [])].sort(cmp)) {
    if (z.polygon.length < 3 || !ctx.shown(z.level_id)) continue;
    const lv = ctx.level(z.level_id);
    const poly = z.polygon.map((q): [number, number] => [r4(ctx.m(q.x * input.width)), r4(ctx.m(q.y * input.height))]);
    const room = resolved.rooms[z.id];
    out.floors.push({ id: `rfloor:${z.id}`, zone: z.id, level_id: lv.id, y: r4(lv.elevation_m), polygon: poly, material: room?.floor ?? levelFloor(lv.id) });
    let glass = 0;
    for (const o of doc.openings) {
      if (o.kind !== 'window') continue;
      const w = walls.get(o.wall_id);
      if (!w || ctx.level(w.level_id).id !== lv.id) continue;
      const pr = windowPrims.get(o.id);
      if (!pr) continue;
      const a = [ctx.m(pr.gap[0][0]), ctx.m(pr.gap[0][1])];
      const b = [ctx.m(pr.gap[1][0]), ctx.m(pr.gap[1][1])];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      if (inside(mx + n[0] * 0.3, mz + n[1] * 0.3, poly) || inside(mx - n[0] * 0.3, mz - n[1] * 0.3, poly)) glass += o.width_m * o.height_m;
    }
    out.rooms[z.id] = { daylight: r4(daylightFactor(glass, Math.abs(area(poly)))) };
  }

  out.parts.sort(cmp);
  out.floors.sort(cmp);
  out.caps.sort(cmp);
  out.models.sort(cmp);
  out.lamps.sort(cmp);
  out.shutters.sort(cmp);
  out.replaced = [...new Set(out.replaced)].sort();
  return out;
}

function area(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i]; const q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
function inside(x: number, z: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) hit = !hit;
  }
  return hit;
}
function sceneCentre(ctx: RealContext): [number, number] {
  const fl = ctx.parts.filter((p) => p.kind === 'wall');
  if (!fl.length) return [ctx.m(ctx.input.width) / 2, ctx.m(ctx.input.height) / 2];
  const xs = fl.map((p) => p.position[0]);
  const zs = fl.map((p) => p.position[2]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

type Add = (p: Omit<RealPart, 'position' | 'size' | 'rotation'> & { position: number[]; size: number[]; rotation?: number[] }) => void;

function doorDetails(o: GeomOpening, ud: { id: string; kind: string }, g0: [number, number], g1: [number, number], _d: [number, number], len: number, yaw: number, c: [number, number], t: number, base: number, lv: GeomLevel, add: Add, ctx: RealContext, at: (a: number) => [number, number]): void {
  const h = o.height_m;
  const lvId = lv.id;
  const frame = 'wood_dark';
  const owner = `lintel:${o.id}`;
  // the frame: two jambs and a head inside the gap, the wall's depth + 2 cm
  for (const [k, along] of [['j0', -len / 2 + DOOR_FRAME / 2], ['j1', len / 2 - DOOR_FRAME / 2]] as const) {
    const [x, z] = at(along);
    add({ id: `door:${o.id}~frame.${k}`, owner, userData: ud, level_id: lvId, shape: 'box', position: [x, base + h / 2, z], size: [DOOR_FRAME, h, t + 0.02], rotation: [0, yaw, 0], material: frame, shadow: true });
  }
  add({ id: `door:${o.id}~frame.head`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], base + h - DOOR_FRAME / 2, c[1]], size: [len, DOOR_FRAME, t + 0.02], rotation: [0, yaw, 0], material: frame, shadow: true });
  // the casing (architrave) proud of the wall on both faces: 7 cm wide, 12 mm proud
  const cd = t + 2 * CASING_PROUD;
  for (const [k, along] of [['c0', -len / 2 - CASING_W / 2], ['c1', len / 2 + CASING_W / 2]] as const) {
    const [x, z] = at(along);
    add({ id: `door:${o.id}~casing.${k}`, owner, userData: ud, level_id: lvId, shape: 'box', position: [x, base + (h + CASING_W) / 2, z], size: [CASING_W, h + CASING_W, cd], rotation: [0, yaw, 0], material: frame, shadow: false });
  }
  add({ id: `door:${o.id}~casing.head`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], base + h + CASING_W / 2, c[1]], size: [len + 2 * CASING_W, CASING_W, cd], rotation: [0, yaw, 0], material: frame, shadow: false });
  // the handles: a rose and a lever on both faces of every swinging leaf, 12 cm from its free end (they ride with the leaf)
  const swing = o.swing || 'right';
  if (swing === 'none' || swing === 'sliding') return;
  const leaves = ctx.parts.filter((p) => p.kind === 'door' && p.userData.id === o.id && p.shape === 'box');
  const hingeAtStart = (o.hinge || 'start') === 'start';
  for (const leaf of leaves) {
    const [L, , T] = leaf.size;
    const u = turned(1, 0, leaf.rotation[1]); // the leaf's own +x on the floor
    const e1: [number, number] = [leaf.position[0] - (u[0] * L) / 2, leaf.position[2] - (u[1] * L) / 2];
    const e2: [number, number] = [leaf.position[0] + (u[0] * L) / 2, leaf.position[2] + (u[1] * L) / 2];
    const hinge: [number, number] = leaf.id.endsWith('#1') ? g1 : leaf.id.endsWith('#0') ? g0 : hingeAtStart ? g0 : g1;
    const free = Math.hypot(e1[0] - hinge[0], e1[1] - hinge[1]) > Math.hypot(e2[0] - hinge[0], e2[1] - hinge[1]) ? e1 : e2;
    const toHinge: [number, number] = [hinge[0] - free[0], hinge[1] - free[1]];
    const tl = Math.hypot(toHinge[0], toHinge[1]) || 1;
    const hx = free[0] + (toHinge[0] / tl) * 0.12;
    const hz = free[1] + (toHinge[1] / tl) * 0.12;
    const nrm = turned(0, 1, leaf.rotation[1]);
    for (const s of [-1, 1]) {
      const off = s * (T / 2 + 0.006);
      add({ id: `${leaf.id}~rose${s < 0 ? 'a' : 'b'}`, owner: leaf.id, userData: leaf.userData, level_id: leaf.level_id, shape: 'cyl', position: [hx + nrm[0] * off, base + HANDLE_Y, hz + nrm[1] * off], size: [0.05, 0.012, 0.05], rotation: [90, leaf.rotation[1], 0], material: 'metal_light', shadow: false });
      const lo = s * (T / 2 + 0.035);
      add({ id: `${leaf.id}~lever${s < 0 ? 'a' : 'b'}`, owner: leaf.id, userData: leaf.userData, level_id: leaf.level_id, shape: 'box', position: [hx + nrm[0] * lo - (toHinge[0] / tl) * 0.05, base + HANDLE_Y, hz + nrm[1] * lo - (toHinge[1] / tl) * 0.05], size: [0.12, 0.018, 0.018], rotation: [0, leaf.rotation[1], 0], material: 'metal_light', shadow: false });
    }
  }
}

function windowDetails(o: GeomOpening, _w: GeomWall, ud: { id: string; kind: string }, d: [number, number], len: number, yaw: number, c: [number, number], t: number, base: number, lv: GeomLevel, add: Add, at: (a: number) => [number, number], out: RealWorld, input: SceneInput, centre: [number, number]): void {
  const lvId = lv.id;
  const y0 = base + o.sill_m;
  const h = o.height_m;
  const owner = `window:${o.id}`;
  const fd = t * 0.9;
  for (const [k, along] of [['j0', -len / 2 + WIN_FRAME / 2], ['j1', len / 2 - WIN_FRAME / 2]] as const) {
    const [x, z] = at(along);
    add({ id: `window:${o.id}~frame.${k}`, owner, userData: ud, level_id: lvId, shape: 'box', position: [x, y0 + h / 2, z], size: [WIN_FRAME, h, fd], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
  }
  add({ id: `window:${o.id}~frame.head`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], y0 + h - WIN_FRAME / 2, c[1]], size: [len, WIN_FRAME, fd], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
  add({ id: `window:${o.id}~frame.foot`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], y0 + WIN_FRAME / 2, c[1]], size: [len, WIN_FRAME, fd], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
  // the interior sill 3 cm proud of both faces
  if (o.sill_m > 0.05) add({ id: `window:${o.id}~sill`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], y0 - SILL_T / 2, c[1]], size: [len + 0.14, SILL_T, t + 0.06], rotation: [0, yaw, 0], material: 'tiles_white', shadow: true });
  // mullions above 1.0 m width (two above 2.0 m), a transom at 68 % above 1.6 m height
  const inner = h - 2 * WIN_FRAME;
  const mullions = len > 2.0 ? [-len / 6, len / 6] : len > 1.0 ? [0] : [];
  mullions.forEach((a, i) => { const [x, z] = at(a); add({ id: `window:${o.id}~mullion.${i}`, owner, userData: ud, level_id: lvId, shape: 'box', position: [x, y0 + h / 2, z], size: [0.04, inner, t * 0.6], rotation: [0, yaw, 0], material: 'metal_light', shadow: true }); });
  if (h > 1.6) add({ id: `window:${o.id}~transom`, owner, userData: ud, level_id: lvId, shape: 'box', position: [c[0], y0 + h * 0.68, c[1]], size: [len - 2 * WIN_FRAME, 0.04, t * 0.6], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
  // a roller shutter on the outside of a window bound to a cover entity: down by its state, never by a stale one
  const ref = o.anchor_ref;
  if (ref && ref.resource_type === 'ha_entity' && ref.resource_id.startsWith('cover.')) {
    const st = input.entityStates[ref.resource_id];
    const down = st === 'closed' ? 1 : st === 'closing' || st === 'opening' ? 0.5 : 0;
    const nrm: [number, number] = [-d[1], d[0]];
    const toCentre = (centre[0] - c[0]) * nrm[0] + (centre[1] - c[1]) * nrm[1];
    const s = toCentre > 0 ? -1 : 1; // the side away from the plan's middle (the outside)
    const top = y0 + h;
    out.shutters.push({ id: `shutter:${o.id}`, entity: ref.resource_id, level_id: lvId, position: v3(c[0] + nrm[0] * s * (t / 2 + 0.06), top, c[1] + nrm[1] * s * (t / 2 + 0.06)), width: r4(len + 0.04), height: r4(h), yaw: r4(yaw), down });
    add({ id: `window:${o.id}~shutterbox`, owner, userData: ud, level_id: lvId, shape: 'rbox', radius: 0.02, position: [c[0] + nrm[0] * s * (t / 2 + 0.09), top + SHUTTER_BOX / 2, c[1] + nrm[1] * s * (t / 2 + 0.09)], size: [len + 0.1, SHUTTER_BOX, 0.18], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
  }
}

/** A lamp object (role light): its body family and its bulb, and the lamp row (the pool's candidates). */
function lampFamily(o: GeometryDoc['objects'][number], p: ScenePart, resolved: ResolvedMaterials, on: boolean, add: Add, out: RealWorld): void {
  const light = resolved.lights[o.id] ?? { kind: 'ceiling', color_k: 3000, lumens: 800 };
  const [w, h, dd] = p.size;
  const [cx, cy, cz] = p.position;
  const bottom = cy - h / 2;
  const top = cy + h / 2;
  const ud = p.userData;
  const lv = p.level_id;
  const yaw = p.rotation[1];
  const dia = Math.max(w, dd);
  const body = 'metal_dark';
  let bulb: Vec3 = v3(cx, bottom, cz);
  const id = `obj:${o.id}`;
  if (light.kind === 'pendant') {
    // cord + rose to the ceiling, a tapered shade, the bulb inside it
    const shadeH = Math.min(h, Math.max(0.12, dia * 0.6));
    add({ id: `${id}~cord`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, top - (h - shadeH) / 2, cz], size: [0.012, Math.max(0.02, h - shadeH), 0.012], material: body, shadow: false });
    add({ id: `${id}~shade`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', taper: 0.45, position: [cx, bottom + shadeH / 2, cz], size: [dia, shadeH, dia], material: body, shadow: true });
    add({ id: `${id}~bulb`, owner: p.id, userData: ud, level_id: lv, shape: 'sphere', position: [cx, bottom + shadeH * 0.25, cz], size: [0.1, 0.1, 0.1], material: 'plastic', bulb: o.id, shadow: false });
    bulb = v3(cx, bottom + shadeH * 0.25, cz);
  } else if (light.kind === 'floor') {
    const headH = Math.min(0.35, h * 0.12);
    add({ id: `${id}~base`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, bottom + 0.015, cz], size: [Math.max(0.2, dia * 1.4), 0.03, Math.max(0.2, dia * 1.4)], material: body, shadow: true });
    add({ id: `${id}~pole`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, bottom + (h - headH) / 2, cz], size: [Math.max(0.025, dia * 0.18), h - headH, Math.max(0.025, dia * 0.18)], material: body, shadow: true });
    add({ id: `${id}~head`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', taper: 0.7, position: [cx, top - headH / 2, cz], size: [Math.max(0.25, dia * 1.6), headH, Math.max(0.25, dia * 1.6)], material: 'linen', shadow: true });
    add({ id: `${id}~bulb`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, top - headH + 0.01, cz], size: [Math.max(0.2, dia * 1.3), 0.02, Math.max(0.2, dia * 1.3)], material: 'plastic', bulb: o.id, shadow: false });
    bulb = v3(cx, top - headH, cz);
  } else if (p.shape === 'cylinder') {
    // a ceiling disc with a rim and the diffuser under it
    add({ id: `${id}~body`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, cy + h * 0.15, cz], size: [dia, h * 0.7, dia], material: 'metal_light', shadow: true });
    add({ id: `${id}~bulb`, owner: p.id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, bottom + h * 0.15, cz], size: [dia * 0.86, h * 0.3, dia * 0.86], material: 'plastic', bulb: o.id, shadow: false });
  } else {
    // a panel, a strip, a wall light: a rounded body and its light face underneath (a wall light: its front)
    add({ id: `${id}~body`, owner: p.id, userData: ud, level_id: lv, shape: 'rbox', radius: Math.min(0.01, Math.min(w, h, dd) / 3), position: [cx, cy + h * 0.1, cz], size: [w, h * 0.8, dd], rotation: [0, yaw, 0], material: 'metal_light', shadow: true });
    add({ id: `${id}~bulb`, owner: p.id, userData: ud, level_id: lv, shape: 'box', position: [cx, bottom + h * 0.1, cz], size: [w * 0.92, h * 0.2, dd * 0.92], rotation: [0, yaw, 0], material: 'plastic', bulb: o.id, shadow: false });
  }
  out.lamps.push({ id: `lamp:${o.id}`, owner: p.id, level_id: lv ?? '', position: bulb, kind: light.kind, color_k: light.color_k, lumens: light.lumens, ...(light.beam_deg !== undefined ? { beam_deg: light.beam_deg } : {}), on });
}

/** The procedural families of LOOK_SPEC section 6 by catalog item; true when the object's base part is replaced. */
export function furnitureFamily(item: string, p: ScenePart, mat: string, add: Add): boolean {
  const [W, H, D] = p.size;
  const [cx, cy, cz] = p.position;
  const yaw = p.rotation[1];
  const y0 = cy - H / 2;
  const id = p.id;
  const ud = p.userData;
  const lv = p.level_id;
  const at = (lx: number, y: number, lz: number) => { const [ox, oz] = turned(lx, lz, yaw); return [cx + ox, y, cz + oz]; };
  const box = (k: string, lx: number, y: number, lz: number, w: number, h: number, d: number, m: string, r = 0): void => {
    const rr = r > 0 && Math.min(w, h, d) >= 0.02 ? Math.min(r, Math.min(w, h, d) / 2.2) : 0;
    add({ id: `${id}~${k}`, owner: id, userData: ud, level_id: lv, shape: rr > 0 ? 'rbox' : 'box', ...(rr > 0 ? { radius: r4(rr) } : {}), position: at(lx, y, lz), size: [w, h, d], rotation: [0, yaw, 0], material: m, shadow: true });
  };
  const leg = (k: string, lx: number, lz: number, h: number, r: number, m: string, taper = 0.75): void => {
    add({ id: `${id}~${k}`, owner: id, userData: ud, level_id: lv, shape: 'cyl', taper, position: at(lx, y0 + h / 2, lz), size: [2 * r, h, 2 * r], material: m, shadow: true });
  };
  const legs4 = (h: number, r: number, m: string, inset: number): void => {
    const ix = W / 2 - inset;
    const iz = D / 2 - inset;
    leg('leg0', -ix, -iz, h, r, m);
    leg('leg1', ix, -iz, h, r, m);
    leg('leg2', ix, iz, h, r, m);
    leg('leg3', -ix, iz, h, r, m);
  };
  if (p.shape !== 'box') {
    if (item === 'table.round' || item === 'stool' || item === 'stool.bar') {
      const top = item === 'table.round' ? 0.035 : 0.05;
      add({ id: `${id}~top`, owner: id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, y0 + H - top / 2, cz], size: [W, top, W], material: mat, shadow: true });
      add({ id: `${id}~column`, owner: id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, y0 + (H - top) / 2, cz], size: [Math.max(0.05, W * 0.08), H - top, Math.max(0.05, W * 0.08)], material: 'metal_dark', shadow: true });
      add({ id: `${id}~base`, owner: id, userData: ud, level_id: lv, shape: 'cyl', position: [cx, y0 + 0.012, cz], size: [W * 0.55, 0.024, W * 0.55], material: 'metal_dark', shadow: true });
      return true;
    }
    if (item === 'tree.small' || item === 'tree.large' || item === 'bush') {
      const tree = item !== 'bush';
      const trunkH = tree ? H * 0.45 : 0;
      if (tree) add({ id: `${id}~trunk`, owner: id, userData: ud, level_id: lv, shape: 'cyl', taper: 0.7, position: [cx, y0 + trunkH / 2, cz], size: [Math.max(0.12, W * 0.06), trunkH, Math.max(0.12, W * 0.06)], material: 'wood_dark', shadow: true });
      const crown = H - trunkH;
      const blobs: [number, number, number, number][] = [[0, 0.45, 0, 0.62], [0.22, 0.35, 0.12, 0.42], [-0.18, 0.62, -0.1, 0.4]];
      blobs.forEach(([bx, by, bz, s], i) => add({ id: `${id}~crown${i}`, owner: id, userData: ud, level_id: lv, shape: 'sphere', position: at(bx * W, y0 + trunkH + by * crown, bz * W), size: [W * s * 1.6, crown * s * 1.6, W * s * 1.6], material: 'grass', shadow: true }));
      return true;
    }
    return false;
  }
  if (item.startsWith('sofa.') || item === 'armchair') {
    const legH = 0.08;
    const baseTop = legH + 0.34;
    const back = 0.2;
    const arm = Math.min(0.2, W * 0.12);
    box('base', 0, y0 + legH + 0.17, 0, W, 0.34, D, mat, 0.04);
    box('back', 0, y0 + baseTop + (H - baseTop) / 2, -D / 2 + back / 2, W, H - baseTop, back, mat, 0.05);
    box('arm0', -W / 2 + arm / 2, y0 + baseTop + 0.1, back / 2, arm, 0.2, D - back, mat, 0.05);
    box('arm1', W / 2 - arm / 2, y0 + baseTop + 0.1, back / 2, arm, 0.2, D - back, mat, 0.05);
    const seatW = W - 2 * arm;
    const n = W > 1.9 ? 3 : Math.max(1, Math.round(seatW / 0.6));
    for (let i = 0; i < n; i++) {
      const sx = -seatW / 2 + ((i + 0.5) * seatW) / n;
      box(`cushion${i}`, sx, y0 + baseTop + 0.06, back / 2, seatW / n - 0.02, 0.12, D - back - 0.02, mat, 0.05);
      box(`backcushion${i}`, sx, y0 + baseTop + 0.12 + (H - baseTop - 0.12) * 0.45, -D / 2 + back + 0.06, seatW / n - 0.02, (H - baseTop) * 0.7, 0.12, mat, 0.05);
    }
    legs4(legH, 0.02, 'wood_dark', 0.06);
    return true;
  }
  if (item.startsWith('chair.') || item === 'seat.auditorium') {
    const seatY = Math.min(0.46, H * 0.54);
    box('seat', 0, y0 + seatY - 0.02, 0, W, 0.04, D, 'wood_dark', 0.012);
    box('cushion', 0, y0 + seatY + 0.025, 0.01, W * 0.94, 0.05, D * 0.9, 'fabric_grey', 0.02);
    box('back', 0, y0 + seatY + (H - seatY) / 2, -D / 2 + 0.03, W * 0.92, H - seatY, 0.04, 'wood_dark', 0.012);
    legs4(seatY - 0.04, 0.018, 'wood_dark', 0.04);
    return true;
  }
  if (item.startsWith('table.') || item === 'desk.standing') {
    const top = 0.035;
    box('top', 0, y0 + H - top / 2, 0, W, top, D, mat, 0.012);
    if (item === 'table.desk' || item === 'desk.standing') {
      box('side0', -W / 2 + 0.015, y0 + (H - top) / 2, 0, 0.03, H - top, D * 0.94, mat, 0.006);
      box('side1', W / 2 - 0.015, y0 + (H - top) / 2, 0, 0.03, H - top, D * 0.94, mat, 0.006);
      box('modesty', 0, y0 + H * 0.6, -D / 2 + 0.06, W - 0.06, H * 0.4, 0.018, mat, 0.004);
    } else legs4(H - top, item === 'table.side' ? 0.02 : 0.028, item === 'table.side' ? 'metal_dark' : 'wood_dark', 0.06);
    return true;
  }
  if (item.startsWith('bed.') || item === 'stretcher') {
    const frameH = Math.min(0.2, H * 0.3);
    const legH = Math.max(0.05, H - 0.4 - frameH);
    box('frame', 0, y0 + legH + frameH / 2, 0, W, frameH, D, mat, 0.012);
    box('mattress', 0, y0 + legH + frameH + 0.1, 0, W * 0.96, 0.2, D * 0.96, 'linen', 0.06);
    box('duvet', 0, y0 + legH + frameH + 0.24, D * 0.18, W * 0.98, 0.08, D * 0.62, 'fabric_grey', 0.03);
    box('pillow', 0, y0 + legH + frameH + 0.255, -D / 2 + 0.25, Math.min(W * 0.8, 0.7), 0.11, 0.42, 'linen', 0.04);
    box('headboard', 0, y0 + (legH + frameH + 0.45) / 2, -D / 2 + 0.025, W, legH + frameH + 0.45, 0.05, mat, 0.01);
    legs4(legH, 0.025, 'metal_light', 0.05);
    return true;
  }
  const cabinet = item.startsWith('cabinet.') || item === 'wardrobe' || item.startsWith('locker.') || item === 'kitchenette.counter' || item === 'dishwasher' || item === 'oven.kitchen' || item === 'sink.kitchen';
  if (cabinet) {
    const plinth = 0.1;
    const kitchen = item === 'kitchenette.counter' || item === 'sink.kitchen' || item === 'dishwasher' || item === 'oven.kitchen';
    const worktop = kitchen ? 0.04 : 0;
    box('plinth', 0, y0 + plinth / 2, -0.04, W - 0.04, plinth, D - 0.08, 'wood_dark');
    box('body', 0, y0 + plinth + (H - plinth - worktop) / 2, 0, W, H - plinth - worktop, D, mat, 0.012);
    if (kitchen) box('worktop', 0, y0 + H - worktop / 2, 0.015, W + 0.01, worktop, D + 0.03, 'concrete', 0.006);
    const pitch = kitchen ? 0.6 : 0.5;
    const doors = Math.max(1, Math.round(W / pitch));
    const fh = H - plinth - worktop;
    for (let i = 1; i < doors; i++) box(`seam${i}`, -W / 2 + (i * W) / doors, y0 + plinth + fh / 2, D / 2 + 0.002, 0.006, fh * 0.98, 0.004, 'wood_dark');
    for (let i = 0; i < doors; i++) {
      const hx = -W / 2 + ((i + 0.5) * W) / doors + (W / doors) * 0.3 * (i % 2 ? -1 : 1);
      const tall = H > 1.4;
      box(`handle${i}`, hx, y0 + plinth + fh * (tall ? 0.5 : 0.85), D / 2 + 0.015, tall ? 0.018 : 0.14, tall ? 0.3 : 0.018, 0.018, 'metal_light');
    }
    return true;
  }
  return false;
}
