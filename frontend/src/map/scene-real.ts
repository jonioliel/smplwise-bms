/**
 * Plan Studio 6, slices S1 / S2 (CR-029 sections 3.1 / 6, LOOK_SPEC sections 1-6, 11, 13): the three.js realisation of
 * the realistic level (quality level 3) from a description that carries `real` (scene-real-builder.ts). SceneView
 * (scene-three.ts) calls it instead of its level-2 realisation for the structure and the objects; the state layer (tints,
 * markers, cones, labels, chips, pills) keeps the level-2 path.
 *
 * - Materials (RealMaterials): one MeshStandardMaterial per (library id, variant), tinted by the style's palette
 *   (materials.json `tint`), with the CC0 files (colour detail, NormalGL, AO + roughness packed) when the texture source is
 *   `files` - loaded lazily, per id, a failed file falls back to the plain tint. Glass: MeshPhysicalMaterial (transmission)
 *   on the top rung only, the cheap translucent standard glass on every other rung (LOOK_SPEC section 2). A style switch
 *   re-tints; it never rebuilds.
 * - Geometry: the walls, plates, lintels, sills, heads, room floors, connectors and the static detail families are MERGED
 *   per (level, material) with box-mapped UVs in metres (mesh-utils.boxUv): one draw per material per level, picking by
 *   triangle ranges. Objects and repeated family parts are INSTANCED per (shape, size, bevel, material) (LOOK_SPEC section
 *   11 rule 1). A door leaf is two meshes (wood, metal handles) in one group so it can swing. Kit models are instanced
 *   per (file, primitive) with the palette per slot and a +-5 % luminance jitter (R2 G1).
 * - Contact AO (every rung of level 3): junction strips along every wall footprint edge (0.30 m floor + 0.30 m wall) and a
 *   blob under every floor-standing object; the building's contact shadow on the ground disc.
 * - The section cut (LOOK_SPEC section 5): one world clipping plane at 0.6 x the ceiling of the top visible level, the cap
 *   polygons drawn at the cut in the style's poché colour (the dark style adds the edge line).
 * - Exterior: ground disc (unlit below the top rung), horizon band, the LDR sky dome (vertex colours from the sun recipe),
 *   prefiltered into the environment (IBL) on time change.
 * No HDRI, no path tracer, no KTX2, no Draco; the post chain lives in its own lazy chunk (post-chain.ts).
 */
import { BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, Object3D, Plane, Quaternion, RepeatWrapping, RoundedBoxGeometry, SRGBColorSpace, Scene, ShapeUtils, SphereGeometry, Texture, TextureLoader, Vector2, Vector3 } from './three-bundle';
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';
import type { RealWorld } from './scene-real-builder';
import { MATERIALS, type MaterialDef } from './material-resolve';
import { LOOK_STYLES, type StyleId } from './look-style';
import { MODEL_MAP, SLOT_ROUGHNESS, modelUrl, textureUrls, PLAN3D_BASE, type ModelEntry } from './plan3d-assets';
import { boxUv, creaseNormals, fitModel, jitter, readGlb, type GlbModel } from './mesh-utils';
import { kelvinRgb, type LightRecipe } from './sun';

export type RealRung = 'realistic' | 'lite';
export interface RealSettings {
  rung: RealRung;
  style: StyleId;
  furniture: 'models' | 'procedural';
  textures: 'files' | 'procedural';
  sectionCut: boolean;
}
export const DEFAULT_REAL: RealSettings = { rung: 'lite', style: 'light', furniture: 'models', textures: 'files', sectionCut: true };

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));
const rad = (d: number): number => (d * Math.PI) / 180;
/** Kinds the realistic level draws itself (structure and objects); everything else keeps SceneView's level-2 path. */
export const REAL_KINDS = new Set(['floor', 'wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector', 'camera', 'room']);
/** What is cut by the section plane (decals, caps, ground, sprites and lines are not). */
const CLIPPED_KINDS = new Set(['wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector', 'camera']);
const MAX_BLOB_BASE_M = 0.5;
const CREASE = rad(35);

type Pickable = Pick<ScenePart, 'id' | 'kind' | 'userData'>;
/** One realised level-3 graph (SceneView merges its lookup into its own). */
export interface RealBuilt {
  root: Group;
  /** Object -> the parts it carries: by instanceId, by triangle range (userData.ranges), or [0]. */
  lookup: Map<Object3D, Pickable[]>;
  /** Door leaves by base part id (the animation moves the group). */
  leaves: Map<string, Object3D>;
  shutters: Map<string, { mesh: Object3D; height: number }>;
  /** The lamp bodies' bulb materials by lamp id (emissive while on). */
  bulbs: Map<string, MeshStandardMaterial>;
  caps: Object3D | null;
  stats: { meshes: number; instanced: number; merged: number; models: number };
}

// ---------------------------------------------------------------- materials

export class RealMaterials {
  private readonly loader = new TextureLoader();
  private readonly textures = new Map<string, Texture>();
  private readonly failed = new Set<string>();
  private readonly mats = new Map<string, { id: string; variant: string; m: MeshStandardMaterial }>();
  private pendingLoads = 0;
  private clip: Plane[] | null = null;
  style: StyleId = 'light';
  source: 'files' | 'procedural' = 'files';
  rung: RealRung = 'lite';

  constructor(private readonly base: string, private readonly onLoad: () => void) {}

  get pending(): number {
    return this.pendingLoads;
  }

  private tex(url: string, srgb: boolean): Texture | null {
    if (this.failed.has(url)) return null;
    let t = this.textures.get(url);
    if (t) return t;
    this.pendingLoads++;
    t = this.loader.load(url, () => { this.pendingLoads--; this.onLoad(); }, undefined, () => {
      this.pendingLoads--;
      this.failed.add(url);
      // a failed file falls back to the plain tint for that id (LOOK_SPEC section 13: nothing else changes)
      for (const e of this.mats.values()) if (e.m.map === t || e.m.normalMap === t || e.m.roughnessMap === t) { e.m.map = null; e.m.normalMap = null; e.m.roughnessMap = null; e.m.aoMap = null; e.m.roughness = BY_ID.get(e.id)?.roughness ?? 1; e.m.needsUpdate = true; }
      this.onLoad();
    });
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.anisotropy = 4;
    this.textures.set(url, t);
    return t;
  }

  private tint(def: MaterialDef | undefined): number {
    return new Color(def?.tint[this.style] ?? '#cccccc').getHex();
  }

  /** The material of a library id; `variant`: 'std' | 'floor' | 'nomap' (kit models: no UVs) | 'glass' | 'slot:<roughness>'. */
  get(id: string, variant = 'std', clipped = true): MeshStandardMaterial {
    const key = `${id}|${variant}|${clipped ? 1 : 0}|${this.rung === 'realistic' && variant === 'glass' ? 'phys' : ''}`;
    const have = this.mats.get(key);
    if (have) return have.m;
    const def = BY_ID.get(id);
    let m: MeshStandardMaterial;
    if (variant === 'glass' || def?.glass) {
      const g = LOOK_STYLES[this.style].glass;
      const frosted = id === 'glass_frosted';
      if (this.rung === 'realistic' && !frosted) {
        m = new MeshPhysicalMaterial({ color: g.tint, transmission: 0.92, roughness: 0.05, ior: 1.5, clearcoat: 0.6, thickness: 0.01, transparent: true, opacity: 1, envMapIntensity: g.env, side: DoubleSide });
      } else {
        m = new MeshStandardMaterial({ color: frosted ? 0xdfe9f3 : g.tint, transparent: true, opacity: frosted ? 0.62 : g.opacity, roughness: 0.05, metalness: 0, envMapIntensity: 1.4, depthWrite: false, side: DoubleSide, forceSinglePass: true });
      }
    } else {
      const metal = def?.metalness ?? 0;
      m = new MeshStandardMaterial({ color: this.tint(def), roughness: def?.roughness ?? 1, metalness: metal, envMapIntensity: metal > 0.5 ? 1.0 : 0.7 });
      const urls = variant === 'nomap' || this.source !== 'files' ? null : textureUrls(id, this.base);
      if (urls) {
        const map = this.tex(urls.color, true);
        const normal = this.tex(urls.normal, false);
        const rao = this.tex(urls.roughAo, false);
        if (map && normal && rao) {
          m.map = map;
          m.normalMap = normal;
          m.normalScale = new Vector2(def?.normal ?? 1, def?.normal ?? 1);
          m.roughnessMap = rao;
          m.aoMap = rao;
          m.aoMapIntensity = 0.6;
          m.roughness = 1;
        }
      }
      if (variant.startsWith('slot:')) m.roughness = Number(variant.slice(5));
      if (variant === 'floor') m.roughness *= LOOK_STYLES[this.style].rig.floorSheen;
    }
    m.userData.materialId = id;
    if (clipped) m.clippingPlanes = this.clip;
    m.clipShadows = true;
    this.mats.set(key, { id, variant, m });
    return m;
  }

  /** Re-tint every material for a style (LOOK_SPEC section 1: no rebuild). */
  setStyle(style: StyleId): void {
    this.style = style;
    const g = LOOK_STYLES[style].glass;
    for (const e of this.mats.values()) {
      const def = BY_ID.get(e.id);
      if (e.variant === 'glass' || def?.glass) {
        if (e.id !== 'glass_frosted') e.m.color.setHex(g.tint);
        e.m.envMapIntensity = g.env;
        if (!(e.m instanceof MeshPhysicalMaterial) && e.id !== 'glass_frosted') e.m.opacity = g.opacity;
        continue;
      }
      e.m.color.setHex(this.tint(def));
      if (e.variant === 'floor') e.m.roughness = (e.m.map ? 1 : def?.roughness ?? 1) * LOOK_STYLES[style].rig.floorSheen;
    }
  }

  /** The section plane on every clipped material (null: nothing cut). */
  setClip(planes: Plane[] | null): void {
    this.clip = planes;
    for (const [key, e] of this.mats) if (key.split('|')[2] === '1') e.m.clippingPlanes = planes;
  }

  /** The rung changed (glass physical / standard): the glass entries are dropped, re-made on the next build. */
  setRung(rung: RealRung): void {
    if (rung === this.rung) return;
    this.rung = rung;
    for (const [key, e] of [...this.mats]) if (e.variant === 'glass' || BY_ID.get(e.id)?.glass) { e.m.dispose(); this.mats.delete(key); }
  }

  setSource(source: 'files' | 'procedural'): void {
    if (source === this.source) return;
    this.source = source;
    for (const e of this.mats.values()) e.m.dispose();
    this.mats.clear();
  }

  dispose(): void {
    for (const e of this.mats.values()) e.m.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.mats.clear();
    this.textures.clear();
  }
}

// ---------------------------------------------------------------- models

interface ModelTemplate {
  model: GlbModel;
  geos: { geometry: BufferGeometry; slot: string }[];
}
export class RealModels {
  private readonly cache = new Map<string, ModelTemplate | null>();
  private readonly loading = new Set<string>();
  /** Incremented when a file finished (loaded or failed): the view realises the graph again when it moved. */
  version = 0;
  constructor(private readonly base: string, private readonly onLoad: () => void) {}

  get pending(): number {
    return this.loading.size;
  }

  /** The template of a file: ready, null (failed: the families draw), or undefined (loading: the families draw meanwhile). */
  template(file: string): ModelTemplate | null | undefined {
    if (this.cache.has(file)) return this.cache.get(file);
    if (!this.loading.has(file)) {
      this.loading.add(file);
      void fetch(modelUrl(file, this.base))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((buf) => {
          const model = readGlb(buf);
          const geos = model.primitives.map((p) => {
            const g = new BufferGeometry();
            g.setAttribute('position', new Float32BufferAttribute(p.positions, 3));
            g.setAttribute('normal', new Float32BufferAttribute(creaseNormals(p.positions, CREASE), 3));
            return { geometry: g, slot: p.material };
          });
          this.cache.set(file, { model, geos });
        })
        .catch((err) => {
          console.warn(`sw-plan-3d: model ${file} failed, the procedural family draws instead`, err);
          this.cache.set(file, null);
        })
        .finally(() => {
          this.loading.delete(file);
          this.version++;
          this.onLoad();
        });
    }
    return undefined;
  }

  dispose(): void {
    for (const t of this.cache.values()) for (const g of t?.geos ?? []) g.geometry.dispose();
    this.cache.clear();
  }
}

// ---------------------------------------------------------------- shared gradient textures (generated, no files)

let radial: CanvasTexture | null = null;
let strip: CanvasTexture | null = null;
let band: CanvasTexture | null = null;
let disc: CanvasTexture | null = null;
function canvasTex(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) paint(ctx);
  return new CanvasTexture(c);
}
/** The contact blob: a radial gradient (alpha 1 -> .75 at 45 % -> .18 at 80 % -> 0). */
export function radialTexture(): CanvasTexture {
  radial ??= canvasTex(128, 128, (ctx) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.75)'); g.addColorStop(0.8, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
  return radial;
}
/** The junction strip: black at v = 0 (the wall), .45 at 35 %, transparent at v = 1. */
function stripTexture(): CanvasTexture {
  if (!strip) {
    strip = canvasTex(4, 64, (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64); });
    strip.wrapS = RepeatWrapping;
    strip.wrapT = ClampToEdgeWrapping;
    strip.flipY = false;
  }
  return strip;
}
/** The ground disc's alpha: opaque to 55 %, transparent at the rim. */
function discTexture(): CanvasTexture {
  disc ??= canvasTex(256, 256, (ctx) => { const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#fff'); g.addColorStop(1, '#000'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); });
  return disc;
}
/** The horizon band's alpha: a soft vegetation silhouette (a seeded curve, deterministic). */
function bandTexture(): CanvasTexture {
  if (!band) {
    band = canvasTex(1024, 128, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1024, 128);
      let s = 77;
      const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 128);
      for (let x = 0; x <= 1024; x += 8) ctx.lineTo(x, 128 - (60 + 22 * Math.sin(x * 0.02) + 14 * Math.sin(x * 0.071 + 1.3) + r() * 10));
      ctx.lineTo(1024, 128);
      ctx.closePath();
      ctx.fill();
    });
    band.wrapS = RepeatWrapping;
    band.repeat.set(6, 1);
  }
  return band;
}

// ---------------------------------------------------------------- geometry

/** Collects world-space triangles per key; becomes one mesh with box UVs and triangle ranges per part. */
class Bucket {
  pos: number[] = [];
  nrm: number[] = [];
  ranges: number[] = [];
  parts: Pickable[] = [];
  push(geometry: BufferGeometry, matrix: Matrix4, part: Pickable): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const nm = new Matrix4().copy(matrix).invert().transpose();
    const v = new Vector3();
    this.ranges.push(this.pos.length / 9);
    this.parts.push(part);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      if (n) {
        v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix4(nm).setLength(1);
        this.nrm.push(v.x, v.y, v.z);
      } else this.nrm.push(0, 1, 0);
    }
    if (g !== geometry) g.dispose();
  }
  geometry(tile: number): BufferGeometry {
    const g = new BufferGeometry();
    const pos = new Float32Array(this.pos);
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('uv', new BufferAttribute(boxUv(pos, tile), 2));
    g.computeBoundingSphere();
    return g;
  }
}

const matrixOf = (position: Vec3, rotation: Vec3, scale: [number, number, number] = [1, 1, 1]): Matrix4 =>
  new Matrix4().compose(new Vector3(position[0], position[1], position[2]), new Quaternion().setFromEuler(new Euler(rad(rotation[0]), rad(rotation[1]), rad(rotation[2]), 'YXZ')), new Vector3(scale[0], scale[1], scale[2]));

/** The unit-free geometry of a part at its real size, centred (instanced by key; UVs in metres in its own frame). */
function partGeometry(shape: string, size: Vec3, radius: number, taper: number, tile: number): BufferGeometry {
  let g: BufferGeometry;
  const [w, h, d] = [Math.max(size[0], 1e-3), Math.max(size[1], 1e-3), Math.max(size[2], 1e-3)];
  if (shape === 'rbox' && radius > 0) g = new RoundedBoxGeometry(w, h, d, Math.min(w, h, d) < 0.12 ? 1 : 2, Math.min(radius, Math.min(w, h, d) / 2 - 1e-4));
  else if (shape === 'cyl' || shape === 'cylinder') g = new CylinderGeometry((w / 2) * taper, w / 2, h, 14);
  else if (shape === 'sphere') g = new SphereGeometry(0.5, 12, 8).scale(w, h, d);
  else g = new BoxGeometry(w, h, d);
  const soup = g.index ? g.toNonIndexed() : g;
  if (soup !== g) g.dispose();
  soup.setAttribute('uv', new BufferAttribute(boxUv(soup.getAttribute('position').array, tile), 2));
  return soup;
}
const sizeKey = (s: Vec3) => s.map((v) => Math.round(v * 1000)).join('x');

/** The prism top of a floor polygon at height y (a room floor plate: its top face and a thin edge). */
function plateGeometry(polygon: [number, number][], y: number, thick: number): BufferGeometry | null {
  if (polygon.length < 3) return null;
  const tris = ShapeUtils.triangulateShape(polygon.map(([x, z]) => new Vector2(x, z)), []);
  const pos: number[] = [];
  for (const [i, j, k] of tris) {
    const [a, b, c] = [polygon[i], polygon[j], polygon[k]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(cross) < 1e-10) continue;
    // counter-clockwise seen from above (normal +y): x-z cross must be negative
    if (cross > 0) pos.push(a[0], y + thick, a[1], c[0], y + thick, c[1], b[0], y + thick, b[1]);
    else pos.push(a[0], y + thick, a[1], b[0], y + thick, b[1], c[0], y + thick, c[1]);
  }
  if (!pos.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the build

export interface RealBuildInput {
  desc: SceneDescription;
  real: RealWorld;
  /** The base parts this realisation draws (SceneView passes its filtered list: one level for a thumbnail, ...). */
  parts: ScenePart[];
  settings: RealSettings;
  heavy: boolean;
  mats: RealMaterials;
  models: RealModels;
}

/** Realise the structure and the objects of a level-3 description (module note). Deterministic for equal input and
 * equal loaded assets. */
export function buildReal(inp: RealBuildInput): RealBuilt {
  const { real, settings, mats, models } = inp;
  const out: RealBuilt = { root: new Group(), lookup: new Map(), leaves: new Map(), shutters: new Map(), bulbs: new Map(), caps: null, stats: { meshes: 0, instanced: 0, merged: 0, models: 0 } };
  out.root.name = 'real';
  const levels = new Set(inp.desc.levels.map((l) => l.id));
  const heavy = inp.heavy;
  const replaced = new Set(heavy ? [] : real.replaced);
  // models: one per object of a mapped item, in the `models` mode, once its file loaded (else the family / base part)
  const modelled = new Set<string>();
  const modelRows: { row: (typeof real.models)[number]; entry: ModelEntry; tpl: ModelTemplate }[] = [];
  if (settings.furniture === 'models' && !heavy) {
    for (const row of real.models) {
      const entry = MODEL_MAP[row.item];
      if (!entry || !levels.has(row.level_id)) continue;
      const tpl = models.template(entry.file);
      if (!tpl) continue;
      modelled.add(row.owner);
      modelRows.push({ row, entry, tpl });
    }
  }
  const buckets = new Map<string, Bucket>(); // `${level}|${material}|${variant}|${shadowKey}`
  const instGroups = new Map<string, { shape: string; size: Vec3; radius: number; taper: number; material: string; variant: string; level: string | null; shadow: boolean; items: { matrix: Matrix4; part: Pickable }[] }>();
  const bucket = (level: string | null, material: string, variant: string, kind: string): Bucket => {
    const key = `${level ?? ''}|${material}|${variant}|${CLIPPED_KINDS.has(kind) ? 'c' : 'n'}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = new Bucket()));
    return b;
  };
  const unitBox = new BoxGeometry(1, 1, 1);
  const pickable = (p: { id: string; userData: { id: string; kind: string } }, kind: string): Pickable => ({ id: p.id, kind: kind as ScenePart['kind'], userData: p.userData });

  // ---- base parts
  for (const p of inp.parts) {
    if (!REAL_KINDS.has(p.kind) || replaced.has(p.id) || modelled.has(p.id)) continue;
    if (p.kind === 'room') continue; // the room floors (real.floors) draw the room and pick it
    const material = real.materials[p.id] ?? 'plaster_white';
    if (p.kind === 'window' || material === 'glass' || material === 'glass_frosted') {
      // glass: one merged mesh per level and glass kind, no shadow, drawn after the opaque parts
      const b = bucket(p.level_id, material === 'glass_frosted' ? 'glass_frosted' : 'glass', 'glass', p.kind);
      b.push(unitBox, matrixOf(p.position, p.rotation, [Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3)]), pickable(p, p.kind));
      continue;
    }
    if (p.kind === 'door' && p.shape === 'box') {
      out.leaves.set(p.id, doorLeaf(p, real, inp, mats, out));
      continue;
    }
    if ((p.kind === 'object' || p.kind === 'camera') && (p.shape === 'box' || p.shape === 'cylinder')) {
      const radius = heavy ? 0 : real.radius[p.id] ?? 0;
      const shape = p.shape === 'cylinder' ? 'cyl' : radius > 0 ? 'rbox' : 'box';
      const key = `${p.level_id}|${shape}|${sizeKey(p.size)}|${radius}|${material}`;
      let g = instGroups.get(key);
      if (!g) instGroups.set(key, (g = { shape, size: p.size, radius, taper: 1, material, variant: 'std', level: p.level_id, shadow: true, items: [] }));
      g.items.push({ matrix: matrixOf(p.position, p.rotation), part: pickable(p, p.kind) });
      continue;
    }
    if (p.shape === 'prism') {
      const geo = prismTop(p);
      if (geo) bucket(p.level_id, material, 'std', p.kind).push(geo, new Matrix4().makeTranslation(p.position[0], p.position[1], p.position[2]), pickable(p, p.kind));
      continue;
    }
    if (p.shape !== 'box' && p.shape !== 'cylinder') continue;
    const variant = p.kind === 'floor' ? 'floor' : 'std';
    const geo = p.shape === 'cylinder' ? new CylinderGeometry(0.5, 0.5, 1, 16) : unitBox;
    bucket(p.level_id, material, variant, p.kind).push(geo, matrixOf(p.position, p.rotation, [Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3)]), pickable(p, p.kind));
    if (geo !== unitBox) geo.dispose();
  }

  // ---- detail families (not those of a replaced-by-model object, not on a heavy floor)
  if (!heavy) for (const r of real.parts) {
    if (!levels.has(r.level_id ?? '') && r.level_id !== null) continue;
    if (modelled.has(r.owner)) continue;
    if (out.leaves.has(r.owner)) continue; // handles ride with their leaf (doorLeaf)
    const pick = { id: r.id, kind: (r.userData.kind === 'opening' ? 'door' : 'object') as ScenePart['kind'], userData: r.userData };
    if (r.bulb) {
      const m = bulbMaterial(mats, r.bulb, out);
      const geo = partGeometry(r.shape, r.size, r.radius ?? 0, r.taper ?? 1, 1);
      const mesh = new Mesh(geo, m);
      mesh.applyMatrix4(matrixOf(r.position, r.rotation));
      mesh.name = r.id;
      mesh.userData.ownMaterial = true;
      out.lookup.set(mesh, [pick]);
      out.root.add(mesh);
      out.stats.meshes++;
      continue;
    }
    // the structure's details (skirting, frames, casings, sills, mullions) have a size per wall: merged with the
    // structure per material (one draw); the families of objects repeat: instanced per (shape, size, material)
    if (r.userData.kind === 'wall' || r.userData.kind === 'opening') {
      const geo = partGeometry(r.shape, r.size, r.radius ?? 0, r.taper ?? 1, 1);
      bucket(r.level_id, r.material, 'std', 'wall').push(geo, matrixOf(r.position, r.rotation), pick);
      geo.dispose();
      continue;
    }
    const key = `${r.level_id}|${r.shape}|${sizeKey(r.size)}|${r.radius ?? 0}|${r.taper ?? 1}|${r.material}|${r.shadow ? 1 : 0}`;
    let g = instGroups.get(key);
    if (!g) instGroups.set(key, (g = { shape: r.shape, size: r.size, radius: r.radius ?? 0, taper: r.taper ?? 1, material: r.material, variant: 'std', level: r.level_id, shadow: r.shadow, items: [] }));
    g.items.push({ matrix: matrixOf(r.position, r.rotation), part: pick });
  }

  // ---- room floors
  for (const f of real.floors) {
    if (!levels.has(f.level_id)) continue;
    const geo = plateGeometry(f.polygon, f.y, 0.006);
    if (geo) bucket(f.level_id, f.material, 'floor', 'floor').push(geo, new Matrix4(), { id: f.id, kind: 'room', userData: { id: f.zone, kind: 'zone' } });
  }

  // ---- merged meshes
  for (const [key, b] of [...buckets].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    const [level, material, variant, clip] = key.split('|');
    const def = BY_ID.get(material);
    const geo = b.geometry(def?.tile_m ?? 1);
    const m = mats.get(material, variant === 'glass' ? 'glass' : variant, clip === 'c');
    const mesh = new Mesh(geo, m);
    mesh.name = `merged|${level}|${material}|${variant}`;
    mesh.userData.ranges = Uint32Array.from(b.ranges);
    const glass = variant === 'glass';
    mesh.castShadow = !glass;
    mesh.receiveShadow = !glass;
    if (glass) mesh.renderOrder = 2;
    out.lookup.set(mesh, b.parts);
    out.root.add(mesh);
    out.stats.merged++;
  }

  // ---- instanced groups
  for (const [key, g] of [...instGroups].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    const def = BY_ID.get(g.material);
    const geo = partGeometry(g.shape, g.size, g.radius, g.taper, def?.tile_m ?? 1);
    const mesh = new InstancedMesh(geo, mats.get(g.material, g.variant, true), g.items.length);
    g.items.forEach((it, i) => mesh.setMatrixAt(i, it.matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = g.shadow;
    mesh.receiveShadow = true;
    mesh.name = `inst|${key}`;
    out.lookup.set(mesh, g.items.map((it) => it.part));
    out.root.add(mesh);
    out.stats.instanced++;
  }

  // ---- models: one InstancedMesh per (level, file, primitive), the palette per slot, the jitter per instance
  const modelGroups = new Map<string, { entry: ModelEntry; tpl: ModelTemplate; level: string; list: { m: Matrix4; part: Pickable; j: number }[] }>();
  for (const { row, entry, tpl } of modelRows) {
    const key = `${row.level_id}|${entry.file}`;
    let mg = modelGroups.get(key);
    if (!mg) modelGroups.set(key, (mg = { entry, tpl, level: row.level_id, list: [] }));
    const fit = fitModel(tpl.model.min, tpl.model.max, row.size[0], row.size[1], row.size[2]);
    const part: Pickable = { id: row.owner, kind: 'object', userData: { id: row.id.slice('model:'.length), kind: 'object' } };
    for (const t of row.tiles) {
      const m = new Matrix4().compose(new Vector3(t[0], t[1], t[2]), new Quaternion().setFromEuler(new Euler(0, rad(row.yaw), 0, 'YXZ')), new Vector3(...fit.scale));
      m.multiply(new Matrix4().makeTranslation(fit.offset[0], fit.offset[1], fit.offset[2]));
      mg.list.push({ m, part, j: jitter(t[0], t[2]) });
    }
  }
  for (const [key, mg] of [...modelGroups].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    mg.tpl.geos.forEach((src, k) => {
      const mid = mg.entry.slots[src.slot] ?? mg.entry.fallback;
      const mesh = new InstancedMesh(src.geometry, mats.get(mid, `slot:${SLOT_ROUGHNESS[src.slot] ?? 0.6}`, true), mg.list.length);
      const c = new Color();
      mg.list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, c.setScalar(it.j)); });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `model|${key}|${k}`;
      mesh.userData.shared = true; // the template's geometry: never disposed with the graph
      out.lookup.set(mesh, mg.list.map((it) => it.part));
      out.root.add(mesh);
      out.stats.models++;
    });
  }

  // ---- shutters: a slat curtain hanging from the housing, scaled by how far it is down
  for (const s of real.shutters) {
    if (!levels.has(s.level_id)) continue;
    const geo = new BoxGeometry(s.width, 1, 0.04).translate(0, -0.5, 0);
    const mesh = new Mesh(geo, mats.get('shutter', 'std', true));
    mesh.position.set(s.position[0], s.position[1], s.position[2]);
    mesh.rotation.set(0, rad(s.yaw), 0, 'YXZ');
    mesh.scale.y = Math.max(1e-3, s.down * s.height);
    mesh.visible = s.down > 0.001;
    mesh.castShadow = true;
    mesh.name = s.id;
    out.lookup.set(mesh, [{ id: s.id, kind: 'window', userData: { id: s.id.slice('shutter:'.length), kind: 'opening' } }]);
    out.shutters.set(s.id, { mesh, height: s.height });
    out.root.add(mesh);
  }

  // ---- contact AO: junction strips + object blobs (LOOK_SPEC section 4)
  const style = LOOK_STYLES[settings.style];
  const elev = new Map(inp.desc.levels.map((l) => [l.id, l.elevation_m]));
  const strips = junctionStrips(inp.parts.filter((p) => p.kind === 'wall' && p.shape === 'box' && p.userData.kind === 'wall' && Math.abs(p.position[1] - p.size[1] / 2 - (elev.get(p.level_id ?? '') ?? 0)) < 0.02));
  if (strips) {
    const m = new MeshBasicMaterial({ map: stripTexture(), color: 0x000000, transparent: true, opacity: style.post.junctionAlpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mesh = new Mesh(strips, m);
    mesh.name = 'ao-strips';
    mesh.renderOrder = 1;
    mesh.userData.ownMaterial = true;
    out.root.add(mesh);
  }
  const blobs = inp.parts.filter((p) => p.kind === 'object' && (p.shape === 'box' || p.shape === 'cylinder') && p.position[1] - p.size[1] / 2 <= (elev.get(p.level_id ?? '') ?? 0) + MAX_BLOB_BASE_M);
  if (blobs.length) {
    const m = new MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: style.post.blobAlpha, depthWrite: false });
    const plane = new BoxGeometry(1, 0, 1);
    const mesh = new InstancedMesh(plane, m, blobs.length);
    blobs.forEach((p, i) => mesh.setMatrixAt(i, new Matrix4().compose(new Vector3(p.position[0], p.position[1] - p.size[1] / 2 + 0.008, p.position[2]), new Quaternion().setFromEuler(new Euler(0, rad(p.rotation[1]), 0, 'YXZ')), new Vector3(p.size[0] * 1.3 + 0.1, 1, p.size[2] * 1.3 + 0.1))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = 'ao-blobs';
    mesh.renderOrder = 1;
    mesh.userData.ownMaterial = true;
    out.root.add(mesh);
  }

  // ---- the section caps of every shown level (SceneView shows the top level's while the cut is on)
  if (real.caps.length) {
    const g = new Group();
    g.name = 'caps';
    const byLevel = new Map<string, typeof real.caps>();
    for (const c of real.caps) if (levels.has(c.level_id)) byLevel.set(c.level_id, [...(byLevel.get(c.level_id) ?? []), c]);
    for (const [lv, caps] of [...byLevel].sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
      const pos: number[] = [];
      const lines: number[] = [];
      for (const c of caps) {
        const q = c.polygon;
        for (let i = 1; i + 1 < q.length; i++) pos.push(q[0][0], c.y, q[0][1], q[i + 1][0], c.y, q[i + 1][1], q[i][0], c.y, q[i][1]);
        for (let i = 0; i < q.length; i++) lines.push(q[i][0], c.y + 0.002, q[i][1], q[(i + 1) % q.length][0], c.y + 0.002, q[(i + 1) % q.length][1]);
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const capMat = new MeshBasicMaterial({ color: style.cut.cap, side: DoubleSide });
      const mesh = new Mesh(geo, capMat);
      mesh.name = `caps|${lv}`;
      mesh.userData = { level: lv, ownMaterial: true };
      g.add(mesh);
      const lg = new BufferGeometry();
      lg.setAttribute('position', new Float32BufferAttribute(lines, 3));
      const edge = new LineSegments(lg, new LineBasicMaterial({ color: style.cut.edge ?? style.cut.cap, transparent: true, opacity: 0.9 }));
      edge.name = `capedge|${lv}`;
      edge.userData = { level: lv, edge: true, ownMaterial: true };
      edge.visible = style.cut.edge !== null;
      g.add(edge);
    }
    out.caps = g;
    out.root.add(g);
  }
  unitBox.dispose();
  out.stats.meshes += out.root.children.length;
  return out;
}

/** A door leaf as two meshes (LOOK_SPEC R2 G8): the rounded wood leaf and the merged metal handles, in one group placed at
 * the leaf's transform so the animation can move it. */
function doorLeaf(p: ScenePart, real: RealWorld, inp: RealBuildInput, mats: RealMaterials, out: RealBuilt): Object3D {
  const g = new Group();
  g.name = p.id;
  g.position.set(p.position[0], p.position[1], p.position[2]);
  g.quaternion.setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
  const material = real.materials[p.id] ?? 'door_wood';
  const leaf = new Mesh(partGeometry(inp.heavy ? 'box' : 'rbox', p.size, real.radius[p.id] ?? 0.006, 1, BY_ID.get(material)?.tile_m ?? 1), material === 'glass' ? mats.get('glass', 'glass', true) : mats.get(material, 'std', true));
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  leaf.name = `${p.id}|leaf`;
  g.add(leaf);
  out.lookup.set(leaf, [{ id: p.id, kind: 'door', userData: p.userData }]);
  if (!inp.heavy) {
    const inv = new Matrix4().compose(g.position, g.quaternion, new Vector3(1, 1, 1)).invert();
    const b = new Bucket();
    for (const r of real.parts) {
      if (r.owner !== p.id) continue;
      const geo = partGeometry(r.shape, r.size, r.radius ?? 0, r.taper ?? 1, 0.5);
      b.push(geo, inv.clone().multiply(matrixOf(r.position, r.rotation)), { id: r.id, kind: 'door', userData: r.userData });
      geo.dispose();
    }
    if (b.parts.length) {
      const metal = new Mesh(b.geometry(0.5), mats.get('metal_light', 'std', true));
      metal.name = `${p.id}|metal`;
      metal.castShadow = true;
      out.lookup.set(metal, b.parts);
      metal.userData.ranges = Uint32Array.from(b.ranges);
      g.add(metal);
    }
  }
  out.root.add(g);
  return g;
}

function bulbMaterial(mats: RealMaterials, lampId: string, out: RealBuilt): MeshStandardMaterial {
  let m = out.bulbs.get(lampId);
  if (!m) {
    m = mats.get('plastic', 'std', true).clone();
    m.color.setHex(0xf2efe8);
    m.emissive.setRGB(0, 0, 0);
    m.userData.ownMaterial = true;
    out.bulbs.set(lampId, m);
  }
  return m;
}

/** The top face of a prism part (a floor-level polygon, cones excluded by REAL_KINDS). */
function prismTop(p: ScenePart): BufferGeometry | null {
  return plateGeometry(p.polygon ?? [], 0, p.size[1]);
}

/** Junction strips along the long edges of every wall box standing on its floor: a 0.30 m floor quad and a 0.30 m wall
 * quad per face, the gradient dark at the junction (LOOK_SPEC section 4). Edges under 0.32 m are skipped. */
function junctionStrips(walls: ScenePart[]): BufferGeometry | null {
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], rep: number) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, rep, 0, rep, 1, 0, 0, rep, 1, 0, 1);
  };
  for (const p of walls) {
    const [len, h, t] = p.size;
    if (len < 0.32) continue;
    const yaw = rad(p.rotation[1]);
    const ux = Math.cos(yaw), uz = -Math.sin(yaw);
    const nx = -uz, nz = ux;
    const y = p.position[1] - h / 2;
    const rep = len / 0.5;
    for (const s of [-1, 1]) {
      const ox = p.position[0] + nx * s * (t / 2), oz = p.position[2] + nz * s * (t / 2);
      const a = [ox - (ux * len) / 2, oz - (uz * len) / 2];
      const b = [ox + (ux * len) / 2, oz + (uz * len) / 2];
      const fx = nx * s * 0.3, fz = nz * s * 0.3;
      quad([a[0], y + 0.006, a[1]], [b[0], y + 0.006, b[1]], [b[0] + fx, y + 0.006, b[1] + fz], [a[0] + fx, y + 0.006, a[1] + fz], rep);
      const o = 0.004;
      quad([a[0] + nx * s * o, y, a[1] + nz * s * o], [b[0] + nx * s * o, y, b[1] + nz * s * o], [b[0] + nx * s * o, y + 0.3, b[1] + nz * s * o], [a[0] + nx * s * o, y + 0.3, a[1] + nz * s * o], rep);
    }
  }
  if (!pos.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- exterior and sky

export interface Exterior {
  root: Group;
  dome: Mesh;
  domeScene: Scene;
  disc: Mesh;
  contact: Mesh;
  band: Mesh;
}
/** The ground disc, the building's contact shadow and the horizon band around an extent, plus the sky dome. */
export function buildExterior(extent: { x0: number; x1: number; y0: number; z0: number; z1: number }, style: StyleId, lit: boolean): Exterior {
  const s = LOOK_STYLES[style];
  const root = new Group();
  root.name = 'exterior';
  const cx = (extent.x0 + extent.x1) / 2;
  const cz = (extent.z0 + extent.z1) / 2;
  const w = extent.x1 - extent.x0;
  const d = extent.z1 - extent.z0;
  const r = Math.hypot(w, d) * 0.8 + 20;
  const y = extent.y0 - 0.06;
  const discMat = lit ? new MeshStandardMaterial({ color: s.ground.disc, roughness: 1, transparent: true, alphaMap: discTexture(), depthWrite: false }) : new MeshBasicMaterial({ color: s.ground.disc, transparent: true, alphaMap: discTexture(), depthWrite: false });
  const disc = new Mesh(new BoxGeometry(2 * r, 0, 2 * r), discMat);
  disc.position.set(cx, y, cz);
  disc.receiveShadow = lit;
  disc.name = 'ground';
  disc.renderOrder = -2;
  const contact = new Mesh(new BoxGeometry(w + 3, 0, d + 3), new MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: s.ground.contact, depthWrite: false }));
  contact.position.set(cx, y + 0.01, cz);
  contact.name = 'ground-contact';
  contact.renderOrder = -1;
  const bandGeo = new CylinderGeometry(s.horizon.radius, s.horizon.radius, s.horizon.height, 64, 1, true);
  const band = new Mesh(bandGeo, new MeshBasicMaterial({ color: s.horizon.color, alphaMap: bandTexture(), transparent: true, side: BackSide, depthWrite: false, fog: false }));
  band.position.set(cx, y + s.horizon.height / 2, cz);
  band.name = 'horizon';
  band.renderOrder = -3;
  const domeGeo = new SphereGeometry(400, 32, 16);
  domeGeo.setAttribute('color', new BufferAttribute(new Float32Array(domeGeo.getAttribute('position').count * 3), 3));
  const dome = new Mesh(domeGeo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, toneMapped: false, fog: false, depthWrite: false }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  dome.name = 'sky';
  dome.position.set(cx, 0, cz);
  const domeScene = new Scene();
  domeScene.add(new Mesh(domeGeo, dome.material));
  for (const m of [dome, band, disc, contact]) m.userData.ownMaterial = true;
  root.add(dome, band, disc, contact);
  return { root, dome, domeScene, disc, contact, band };
}

/** Paint the dome's vertex colours from the recipe and the style (LOOK_SPEC section 1 sky scale, ground tint; a sun disc). */
export function paintSky(ext: Exterior, r: LightRecipe, sunDir: [number, number, number], style: StyleId): void {
  const s = LOOK_STYLES[style];
  const g = ext.dome.geometry;
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color') as BufferAttribute;
  const v = new Vector3();
  const sd = new Vector3(...sunDir).normalize();
  const k = s.rig.skyScale;
  const ground = r.hemiGround.map((x) => (x * 0.9 + 0.1) * s.backdrop.groundTint);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let c: number[];
    if (v.y < 0) c = ground;
    else {
      const t = Math.pow(v.y, 0.55);
      c = [0, 1, 2].map((j) => (r.skyHorizon[j] + (r.skyTop[j] - r.skyHorizon[j]) * t) * k);
    }
    const dd = Math.max(0, v.dot(sd));
    const discAmt = sd.y > -0.05 ? Math.pow(dd, 400) * 0.9 + Math.pow(dd, 12) * 0.18 * r.day : 0;
    col.setXYZ(i, Math.min(1, c[0] + discAmt * r.sunColor[0]), Math.min(1, c[1] + discAmt * r.sunColor[1]), Math.min(1, c[2] + discAmt * r.sunColor[2]));
  }
  col.needsUpdate = true;
}

/** The CSS backdrop stops [top, horizon, bottom]: the style's colours mixed 50 % with the recipe (LOOK_SPEC section 1). */
export function backdropColors(r: LightRecipe, style: StyleId): [string, string, string] {
  const s = LOOK_STYLES[style];
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const css = (c: number[]) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(', ')})`;
  const mix = (a: number[], b: number[]) => css(a.map((v, i) => (v + b[i]) / 2));
  const night = r.night > 0.5;
  const top = hex(night ? s.backdrop.topNight : s.backdrop.topDay);
  const hor = hex(night ? s.backdrop.horizonNight : s.backdrop.horizonDay);
  return [mix(top, r.skyTop.map((v) => v * s.rig.skyScale)), mix(hor, r.skyHorizon.map((v) => v * s.rig.skyScale)), css(r.hemiGround.map((v) => v * s.backdrop.groundTint * 0.9 + 0.08))];
}

/** A lamp's emissive colour and the pool light's colour from its colour temperature. */
export function lampColor(colorK: number): Color {
  const [r, g, b] = kelvinRgb(colorK);
  return new Color(r, g, b);
}

export const assetBase = (): string => PLAN3D_BASE;

/** Dispose a realised level-3 graph: geometries (not a model template's shared one), own materials, sprites. */
export function disposeDeep(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if ((m as unknown as { isMesh?: boolean }).isMesh || (o as unknown as { isLineSegments?: boolean }).isLineSegments) {
      if (!m.userData.shared) m.geometry?.dispose();
      const mat = m.material;
      if (m.userData.ownMaterial && mat && !Array.isArray(mat)) mat.dispose();
    }
  });
}