/**
 * Plan Studio 6 stills and room masks (CR-029 S3, approach B1; docs/changes/CR-029-ST7-S3-NOTES.md). Pure functions - no
 * three.js, no DOM - so node tests pin them:
 *
 * - the slots of a floor (the same names and order as services/plan_bakes.py expected_slots / slot_id);
 * - the time band of a moment at the site (sun elevation: day above 6 deg, sunset -4..6 deg, night below -4 deg) and the
 *   fixed scene state a band is drawn in (`bandScene` - S2's sun model consumes it);
 * - the frozen palette of a style (the product's token table, light or dark column), so the same geometry gives the same
 *   picture whatever theme the editor's own browser shows;
 * - the description a still draws (one level, the synthetic all-off / all-on states of skin-control.ts - no labels, no
 *   people, no live state);
 * - the iso projection of a still's camera (the exact frame SceneView.setPreset('iso') uses, scene-frame.isoFrame), and the
 *   mask document built through any projection: rooms (floor outline + the outline lifted to 0.55 of the ceiling, the
 *   prototype's rule), door leaves and cameras;
 * - the `StillRenderer` interface: today's level-2 adapter (still-render-scene.ts) implements it; the level-3 owner (S1 / S2)
 *   provides another implementation with its own recipe id, and every bake of an older recipe is offered again.
 *
 * Determinism: the same description, level, preset and size give the same camera, the same masks (rounded to 0.1 px) and the
 * same palette on every machine. The pixels depend on the GPU that draws them (the notes, section 1).
 */
import type { GeometryDoc } from './geometry';
import type { SceneDescription, SceneInput, ScenePart, Vec3 } from './scene-builder';
import { ISO_DIR, ISO_RIGHT, ISO_UP, isoFrame, sceneExtent, type IsoFrame } from './scene-frame';
import { controlSceneInput } from './skin-control';
import { TOKEN_GROUPS } from '../design/tokens';

export type StillPreset = 'iso' | 'top' | 'persp';
export type StillStyle = 'light' | 'dark';
export type StillBand = 'day' | 'sunset' | 'night';
export type StillVariant = 'off' | 'on';
export type BakeKind = 'still' | 'mask' | 'lightmap';
export const PRESETS: readonly StillPreset[] = ['iso', 'top', 'persp'];
export const STYLES: readonly StillStyle[] = ['light', 'dark'];
export const BANDS: readonly StillBand[] = ['day', 'sunset', 'night'];
export const VARIANTS: readonly StillVariant[] = ['off', 'on'];
/** The recipe of the level-2 still renderer (still-render-scene.ts). The level-3 renderer will be `still-q3.*`. q2.2 (STILLCAM):
 * the bake input leaves camera-bound bodies out (`bakeSceneInput`); the backend withholds q2.1 stills from a reader whose
 * camera scope hides a camera a body of the floor is bound to (services/plan_bakes.SAFE_STILL_RANK). */
export const STILL_RECIPE_Q2 = 'still-q2.2';
export const MASK_RECIPE = 'mask-1';
/** Where the lifted mask outline sits: this share of the level's ceiling height (prototype stills.js). */
export const MASK_TOP_SHARE = 0.55;
/** A room's chip (temperature) anchor height above its floor. */
export const MASK_CENTRE_Y_M = 1.2;
/** Fallback site position (CR-029 section 5.2: Israel) when the infrastructure gives none. */
export const DEFAULT_SITE = { lat: 32.0, lon: 34.8 } as const;
export const BAND_LIMITS = { day: 6, night: -4 } as const;

export interface BakeSlot {
  kind: BakeKind;
  level_id: string;
  preset: StillPreset | '';
  style: StillStyle | '';
  band: StillBand | '';
  variant: StillVariant | '';
}
export type BakeTrigger = 'manual' | 'auto';
export type BakeViews = 'iso' | 'iso_top';
export interface BakeSetting {
  /** Read-only: derived from `bake_views` by the backend (services/plan_bakes.VIEW_PRESETS). */
  presets: StillPreset[];
  /** Owner 2026-10-11: manual = the editor presses "הכן תמונות ותאורה"; auto = it starts when an editor opens the floor. */
  bake_trigger: BakeTrigger;
  /** Owner 2026-10-11: the iso view only (default) or the iso and the top view. */
  bake_views: BakeViews;
  styles: StillStyle[];
  bands: StillBand[];
  lightmap: boolean;
  size: string;
  floor_cap_mb: number;
  total_cap_mb: number;
}
/** services/plan_bakes.SETTING_DEFAULT (unit-still-bake.spec.ts compares them). */
export const DEFAULT_BAKE_SETTING: BakeSetting = {
  presets: ['iso'], styles: ['light', 'dark'], bands: ['day', 'sunset', 'night'], lightmap: true, size: '1600x1000', floor_cap_mb: 64, total_cap_mb: 512,
  bake_trigger: 'manual', bake_views: 'iso',
};
export const VIEW_PRESETS: Record<BakeViews, StillPreset[]> = { iso: ['iso'], iso_top: ['iso', 'top'] };
export const BAKE_SIZES = ['1280x800', '1600x1000', '1920x1200'] as const;

/** "still/L0/iso/light/day/off", "mask/L0/iso", "lightmap/L0" - services/plan_bakes.slot_id. */
export function slotName(s: BakeSlot): string {
  return [s.kind, s.level_id, s.preset, s.style, s.band, s.variant].filter((x) => x !== '').join('/');
}

/** Every slot a setting asks for, in the backend's order: per level and preset one mask then the stills, then the lightmap. */
export function expectedSlots(levels: readonly string[], setting: Pick<BakeSetting, 'presets' | 'styles' | 'bands' | 'lightmap'>): BakeSlot[] {
  const out: BakeSlot[] = [];
  for (const level_id of levels) {
    for (const preset of setting.presets) {
      out.push({ kind: 'mask', level_id, preset, style: '', band: '', variant: '' });
      for (const style of setting.styles) for (const band of setting.bands) for (const variant of VARIANTS) out.push({ kind: 'still', level_id, preset, style, band, variant });
    }
    if (setting.lightmap) out.push({ kind: 'lightmap', level_id, preset: '', style: '', band: '', variant: '' });
  }
  return out;
}

export function sizeOf(setting: Pick<BakeSetting, 'size'>): { w: number; h: number } {
  const [w, h] = setting.size.split('x').map(Number);
  return { w: w || 1600, h: h || 1000 };
}

// ---- time bands --------------------------------------------------------------------------------------------------------

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** The sun's elevation in degrees at a UTC instant and a place (NOAA's low-accuracy formulas: about 0.5 deg, enough to pick a
 * band; S2's sun model is the precise one). */
export function sunElevationDeg(at: Date, lat: number, lon: number): number {
  const ms = at.getTime();
  const day = Math.floor((ms - Date.UTC(at.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
  const hour = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (day - 1 + (hour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqtime + 4 * lon; // true solar time, minutes
  const ha = rad(tst / 4 - 180);
  const cosZen = Math.sin(rad(lat)) * Math.sin(decl) + Math.cos(rad(lat)) * Math.cos(decl) * Math.cos(ha);
  return 90 - deg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
}

/** The band a moment falls in at the site: day above 6 deg of sun, night below -4 deg, sunset in between (both twilights). */
export function bandAt(at: Date, lat: number = DEFAULT_SITE.lat, lon: number = DEFAULT_SITE.lon): StillBand {
  const e = sunElevationDeg(at, lat, lon);
  if (e > BAND_LIMITS.day) return 'day';
  if (e < BAND_LIMITS.night) return 'night';
  return 'sunset';
}

/** The fixed scene state a band is drawn in (never the clock: the same band gives the same picture). `night` drives
 * today's level-2 night mode; the elevation / hour are for the level-3 sun of S2 (equinox, solar time). */
export function bandScene(band: StillBand): { night: boolean; sun_elevation_deg: number; hour: number } {
  if (band === 'day') return { night: false, sun_elevation_deg: 45, hour: 12.5 };
  if (band === 'sunset') return { night: false, sun_elevation_deg: 2, hour: 17.8 };
  return { night: true, sun_elevation_deg: -18, hour: 21 };
}

// ---- palettes ----------------------------------------------------------------------------------------------------------

const palettes = new Map<StillStyle, Readonly<Record<string, string>>>();

/** The frozen token values of a style (the product's token table: the light column for `light`, the dark column for
 * `dark`), keyed without the `--sw-` prefix - the colour callback of a still renderer. Plain colours only. */
export function stillPalette(style: StillStyle): Readonly<Record<string, string>> {
  const hit = palettes.get(style);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const g of TOKEN_GROUPS) {
    for (const [name, v] of Object.entries(g.tokens)) {
      const value = style === 'dark' ? v.dark : v.light;
      if (name.startsWith('--sw-') && /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/.test(value.trim())) out[name.slice(5)] = value.trim();
    }
  }
  const frozen = Object.freeze(out);
  palettes.set(style, frozen);
  return frozen;
}
export const STILL_FALLBACK = { light: '#9aa7b8', dark: '#4b5364' } as const;
export const stillColor = (style: StillStyle) => (token: string): string => stillPalette(style)[token] ?? STILL_FALLBACK[style];
/** The opaque backdrop a still is flattened on (its sky): the style's map sky. */
export function stillBackdrop(style: StillStyle, band: StillBand): string {
  const p = stillPalette(band === 'night' ? 'dark' : style);
  return p['map-sky'] ?? (style === 'dark' ? '#0b1a33' : '#dbe7f8');
}

// ---- the still's description -----------------------------------------------------------------------------------------

/**
 * STILLCAM (a leftover of the Studio 6 security review): the document without the objects bound to a CAMERA anchor. A bake is
 * drawn once, in one editor's browser, and every reader of the floor is served the same pixels - also a reader whose camera
 * scope hides that camera. The store copies the anchor's position and heading onto its body (plan_geometry.apply_anchor_positions),
 * so a body drawn in a still or shading the lightmap shows the hidden camera's place, which the normal plan read withholds from
 * that reader (plan_anchor_scope.redact). Whoever bakes, such a body is left out: the same pixels are safe for every reader.
 * Entity-bound and free objects stay (a reader who reaches the floor only through camera bindings - the one reader an entity
 * reference is withheld from - is handed no bakes at all: routers/anchors.py, the bakes routes need map.read on the floor).
 * A body the baker's own read already withheld arrives unbound at the plan centre (redact's rule) and is drawn there - it tells
 * nothing. Returns `doc` itself when nothing is bound to a camera.
 */
export function withoutCameraBodies(doc: GeometryDoc): GeometryDoc {
  if (!doc.objects.some((o) => o.anchor_ref?.resource_type === 'camera')) return doc;
  return { ...doc, objects: doc.objects.filter((o) => o.anchor_ref?.resource_type !== 'camera') };
}

/** The builder input every still, mask and lightmap of a bake is drawn from: the synthetic all-off / all-on control input
 * (skin-control.controlSceneInput) of the document without its camera-bound bodies (`withoutCameraBodies`). */
export function bakeSceneInput(input: SceneInput, variant: StillVariant): SceneInput {
  return controlSceneInput({ ...input, doc: withoutCameraBodies(input.doc) }, variant === 'on' ? 'all_on' : 'all_off');
}

const STILL_KINDS = new Set<ScenePart['kind']>(['floor', 'room', 'wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector']);

/** One level of a synthetic all-off / all-on description (skin-control.controlSceneInput): structure, rooms, objects, and in
 * `on` the lit plates and the glows; no sprite, camera, cone, entity, marker or presence part. */
export function stillDescription(desc: SceneDescription, levelId: string, variant: StillVariant): SceneDescription {
  const parts = desc.parts.filter((p) => {
    if (p.level_id !== levelId) return false;
    if (p.shape === 'sprite') return false;
    if (STILL_KINDS.has(p.kind)) return true;
    if (variant !== 'on') return false;
    return p.kind === 'glow' || (p.kind === 'tint' && p.id.endsWith('#lit'));
  });
  return { ...desc, levels: desc.levels.filter((l) => l.id === levelId), parts: parts.map((p) => (p.text === undefined ? p : { ...p, text: undefined })), walk: undefined };
}

// ---- projection and masks ------------------------------------------------------------------------------------------------

export type Project = (p: Vec3) => [number, number] | null;
export interface StillCamera {
  preset: StillPreset;
  width: number;
  height: number;
  /** iso only: the frame (target, half sizes, distance) - scene-frame.isoFrame of the still description's extent. */
  frame?: IsoFrame;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** The iso still's camera for a description at a size: exactly SceneView.setPreset('iso') (isoFrame of sceneExtent, zoom 1)
 * on a mount of that size. */
export function isoCamera(desc: SceneDescription, width: number, height: number): StillCamera {
  return { preset: 'iso', width, height, frame: isoFrame(sceneExtent(desc), width / height) };
}

/** Picture pixels of a scene point under an iso still camera (orthographic along ISO_DIR, ISO_RIGHT / ISO_UP axes). */
export function isoProject(cam: StillCamera): Project {
  const f = cam.frame!;
  let halfW = f.halfW;
  let halfH = f.halfH;
  const aspect = cam.width / cam.height;
  if (halfW / halfH < aspect) halfW = halfH * aspect;
  else halfH = halfW / aspect;
  return (p) => {
    const v: Vec3 = [p[0] - f.target[0], p[1] - f.target[1], p[2] - f.target[2]];
    const r = v[0] * ISO_RIGHT[0] + v[1] * ISO_RIGHT[1] + v[2] * ISO_RIGHT[2];
    const u = v[0] * ISO_UP[0] + v[1] * ISO_UP[1] + v[2] * ISO_UP[2];
    return [((r / halfW + 1) / 2) * cam.width, ((1 - u / halfH) / 2) * cam.height];
  };
}
export const ISO_VIEW_DIR = ISO_DIR;

export interface MaskRoom {
  id: string;
  floor: [number, number][];
  top: [number, number][];
  centre: [number, number];
}
export interface MaskDoc {
  version: 1;
  preset: StillPreset;
  width: number;
  height: number;
  rooms: MaskRoom[];
  doors: { id: string; points: [number, number][] }[];
  cameras: { id: string; p: [number, number] }[];
}
const MASK_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function centroid(poly: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    const f = x0 * z1 - x1 * z0;
    a += f;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
  }
  if (Math.abs(a) < 1e-9) return poly[0] ?? [0, 0];
  return [cx / (3 * a), cz / (3 * a)];
}

/** The eight corners of a yawed box part (its own rotation [pitch, yaw, 0]: yaw only - doors and walls carry no pitch). */
function boxCorners(p: ScenePart): Vec3[] {
  const [w, h, d] = p.size;
  const yaw = rad(p.rotation[1]);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const out: Vec3[] = [];
  for (const dx of [-w / 2, w / 2]) for (const dy of [-h / 2, h / 2]) for (const dz of [-d / 2, d / 2]) {
    // three.js Y rotation: x' = x cos + z sin, z' = -x sin + z cos
    out.push([p.position[0] + dx * c + dz * s, p.position[1] + dy, p.position[2] - dx * s + dz * c]);
  }
  return out;
}

export function convexHull(points: [number, number][]): [number, number][] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * The mask document of one level under a still camera: every room of the level (its floor outline and the outline lifted
 * to MASK_TOP_SHARE of the ceiling - a lit room's picture is revealed through the hull of both), every door leaf (the hull
 * of its closed box, per opening id) and every camera body of `live` (the host's live description: cameras are not part of
 * a still). Points are rounded to 0.1 px; ids that cannot travel (MASK_ID) are left out.
 */
export function buildMask(desc: SceneDescription, levelId: string, cam: StillCamera, project: Project, live?: SceneDescription | null): MaskDoc {
  const lv = desc.levels.find((l) => l.id === levelId) ?? { id: levelId, elevation_m: 0, ceiling_height_m: 2.8 };
  const pt = (v: Vec3): [number, number] | null => {
    const q = project(v);
    return q ? [r1(q[0]), r1(q[1])] : null;
  };
  const rooms: MaskRoom[] = [];
  for (const p of desc.parts) {
    if (p.kind !== 'room' || p.level_id !== levelId || !p.polygon?.length || !p.id.startsWith('room:') || p.id.includes('#')) continue;
    const id = p.id.slice(5);
    if (!MASK_ID.test(id)) continue;
    const abs = p.polygon.map(([x, z]) => [x + p.position[0], z + p.position[2]] as [number, number]);
    const floor = abs.map(([x, z]) => pt([x, lv.elevation_m, z]));
    const top = abs.map(([x, z]) => pt([x, lv.elevation_m + lv.ceiling_height_m * MASK_TOP_SHARE, z]));
    const [cx, cz] = centroid(abs);
    const centre = pt([cx, lv.elevation_m + MASK_CENTRE_Y_M, cz]);
    if (floor.some((q) => !q) || top.some((q) => !q) || !centre) continue;
    rooms.push({ id, floor: floor as [number, number][], top: top as [number, number][], centre });
  }
  rooms.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const leaves = new Map<string, [number, number][]>();
  for (const p of desc.parts) {
    if (p.kind !== 'door' || p.level_id !== levelId || p.shape !== 'box' || !MASK_ID.test(p.userData.id)) continue;
    const pts = boxCorners(p).map(pt).filter((q): q is [number, number] => !!q);
    leaves.set(p.userData.id, [...(leaves.get(p.userData.id) ?? []), ...pts]);
  }
  const doors = [...leaves.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, pts]) => ({ id, points: convexHull(pts).slice(0, 16) }));
  const cameras: MaskDoc['cameras'] = [];
  for (const p of (live ?? desc).parts) {
    if (p.kind !== 'camera' || p.level_id !== levelId || !MASK_ID.test(p.userData.id)) continue;
    const q = pt(p.position);
    if (q) cameras.push({ id: p.userData.id, p: q });
  }
  cameras.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: 1, preset: cam.preset, width: cam.width, height: cam.height, rooms, doors, cameras };
}

// ---- the renderer interface --------------------------------------------------------------------------------------------

export interface StillRenderRequest {
  levelId: string;
  preset: StillPreset;
  style: StillStyle;
  band: StillBand;
  variant: StillVariant;
  width: number;
  height: number;
}
export interface StillRenderResult {
  blob: Blob;
  /** Picture pixels of a scene point under the camera that drew it (the masks use the same camera). */
  project: Project;
  /** The GPU / renderer string (stored with the row; differs per machine). */
  renderer: string;
  ms: number;
}
/** What draws a still. `describe(variant)` gives the floor's full synthetic description for a lamp variant. */
export interface StillRenderer {
  readonly recipe: string;
  readonly quality: number;
  render(describe: (variant: StillVariant) => SceneDescription, req: StillRenderRequest): Promise<StillRenderResult>;
  dispose(): void;
}

// ---- status of a floor's bake, as the viewer sees it ---------------------------------------------------------------------

export interface BundleBakes {
  bake_key: string | null;
  complete: boolean;
  stale_count: number;
  recipes: string[];
  levels: Record<string, {
    stills: Record<string, { url: string; width: number; height: number; recipe: string }>;
    masks: Record<string, { url: string }>;
    lightmap: { url: string; width: number; height: number; meta: Record<string, unknown>; recipe: string } | null;
  }>;
}

/** The recipe number of a recipe id ("still-q2.1" -> [2, 1]); unknown ids are [0, 0]. */
export function recipeRank(recipe: string): [number, number] {
  const m = /^still-q(\d+)\.(\d+)$/.exec(recipe);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Whether a floor's bake should be offered again by an editor whose renderer draws `recipe`: nothing yet, an incomplete or
 * stale set, or a set drawn by an older recipe. */
export function needsBake(b: BundleBakes | null | undefined, recipe: string): 'none' | 'incomplete' | 'stale' | 'older_recipe' | null {
  if (!b || !Object.keys(b.levels).length) return b && b.stale_count > 0 ? 'stale' : 'none';
  if (!b.complete) return b.stale_count > 0 ? 'stale' : 'incomplete';
  const mine = recipeRank(recipe);
  const older = b.recipes.some((r) => {
    const k = recipeRank(r);
    return r.startsWith('still-') && (k[0] < mine[0] || (k[0] === mine[0] && k[1] < mine[1]));
  });
  return older ? 'older_recipe' : null;
}

/** The still key of the bundle ("iso/light/day/off"). */
export const stillKey = (preset: StillPreset, style: StillStyle, band: StillBand, variant: StillVariant): string => `${preset}/${style}/${band}/${variant}`;
