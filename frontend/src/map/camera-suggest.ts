/**
 * Nearest cameras for a zone (CAMSUGGEST138-295, board r138): from a zone polygon and the camera pins of the same floor, up
 * to three cameras ranked by how close they are to the zone and - when a camera's field of view is known - how well it faces
 * it. A suggestion is geometry only (pins and zones of the published plan): it does not claim the camera sees the room, and
 * nothing is applied until the editor presses accept. Pure: no DOM, runs in node (tests/unit-camera-suggest.spec.ts).
 *
 * Distances are in plan-width units (1 = the plan's width), the same unit as the settings' "max distance". `aspect` is the
 * plan's width / height: normalized y is scaled by 1 / aspect so a camera 0.1 of the height away is not mistaken for 0.1 of
 * the width. Bearings follow coverage.ts: 0 = up, clockwise.
 */
import { pointInPolygon, type ZonePoint } from '../api/zones';

export interface CameraSuggestSettings {
  /** A camera further than this from the zone (plan-width units) is not offered. */
  maxDistance: number;
  /** 0 = distance only; 1 = a camera whose known field of view misses the zone entirely is not offered. In between it adds to the score. */
  fovWeight: number;
  /** How many to offer (1..3). */
  maxSuggestions: number;
}

export const CAMERA_SUGGEST_DEFAULTS: CameraSuggestSettings = { maxDistance: 0.35, fovWeight: 0.5, maxSuggestions: 3 };
export const CAMERA_SUGGEST_LIMIT = 3;

export interface SuggestZone {
  id: string;
  floorId: string;
  levelId?: string | null;
  polygon: ZonePoint[];
}

export interface SuggestCamera {
  /** The anchor id of the camera pin. */
  id: string;
  floorId: string;
  levelId?: string | null;
  position: ZonePoint;
  rotationDeg: number;
  /** null = the pin has no field of view: it is ranked by distance alone and flagged as such. */
  fovDeg: number | null;
}

export interface CameraSuggestion {
  id: string;
  /** Plan-width units from the pin to the zone's edge; 0 when the pin stands inside the zone. */
  distance: number;
  inside: boolean;
  /** Share (0..1) of the zone's sample points inside the camera's field of view; null when the field of view is unknown. */
  facing: number | null;
  /** Lower is better. */
  score: number;
}

export function sanitizeSettings(s: Partial<CameraSuggestSettings> | null | undefined): CameraSuggestSettings {
  const d = CAMERA_SUGGEST_DEFAULTS;
  const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : dflt);
  return {
    maxDistance: num(s?.maxDistance, 1e-6, 1, d.maxDistance),
    fovWeight: num(s?.fovWeight, 0, 1, d.fovWeight),
    maxSuggestions: Math.round(num(s?.maxSuggestions, 1, CAMERA_SUGGEST_LIMIT, d.maxSuggestions)),
  };
}

type P = { x: number; y: number };

const scaled = (p: ZonePoint, aspect: number): P => ({ x: p.x, y: p.y / aspect });

function segDist(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

/** Distance from a point to a polygon: 0 inside, otherwise to the nearest edge (plan-width units). */
export function distanceToPolygon(p: ZonePoint, poly: ZonePoint[], aspect = 1): number {
  if (poly.length < 3) return Infinity;
  if (pointInPolygon(p, poly)) return 0;
  const sp = scaled(p, aspect);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(sp, scaled(poly[i], aspect), scaled(poly[(i + 1) % poly.length], aspect)));
  return best;
}

/** Sample points that stand for the zone's extent: its corners, edge midpoints and the vertex mean. */
function samples(poly: ZonePoint[]): ZonePoint[] {
  const out: ZonePoint[] = [];
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    sx += a.x;
    sy += a.y;
  }
  out.push({ x: sx / poly.length, y: sy / poly.length });
  return out;
}

/** Bearing in degrees (0 = up, clockwise) from `from` to `to`, in plan-width units. */
export function bearingDeg(from: ZonePoint, to: ZonePoint, aspect = 1): number {
  const a = scaled(from, aspect);
  const b = scaled(to, aspect);
  const deg = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Share (0..1) of the zone's sample points within `fovDeg` centred on `rotationDeg` as seen from `cam`. */
export function facingShare(cam: ZonePoint, rotationDeg: number, fovDeg: number, poly: ZonePoint[], aspect = 1): number {
  const pts = samples(poly);
  const half = Math.max(0, Math.min(360, fovDeg)) / 2;
  let hit = 0;
  for (const s of pts) {
    if (Math.hypot(s.x - cam.x, (s.y - cam.y) / aspect) < 1e-9) {
      hit++; // the pin stands on the sample itself
      continue;
    }
    const diff = Math.abs(((bearingDeg(cam, s, aspect) - rotationDeg + 540) % 360) - 180);
    if (diff <= half + 1e-9) hit++;
  }
  return hit / pts.length;
}

/**
 * The cameras nearest to a zone, best first. Only pins on the zone's floor (and, when both name one, its level) count; a
 * camera further than `maxDistance` is dropped; a camera with a known field of view is penalised by how little of the zone it
 * faces (`fovWeight`), a camera without one is ranked by distance alone. `exclude` holds ids already offered or accepted.
 */
export function suggestCameras(zone: SuggestZone, cameras: readonly SuggestCamera[], settings: Partial<CameraSuggestSettings> = {}, opts: { aspect?: number; exclude?: readonly string[] } = {}): CameraSuggestion[] {
  const cfg = sanitizeSettings({ ...CAMERA_SUGGEST_DEFAULTS, ...settings });
  const aspect = opts.aspect && opts.aspect > 0 ? opts.aspect : 1;
  if (zone.polygon.length < 3) return [];
  const skip = new Set(opts.exclude ?? []);
  const out: CameraSuggestion[] = [];
  for (const c of cameras) {
    if (skip.has(c.id) || c.floorId !== zone.floorId) continue;
    if (zone.levelId && c.levelId && zone.levelId !== c.levelId) continue;
    const distance = distanceToPolygon(c.position, zone.polygon, aspect);
    if (distance > cfg.maxDistance) continue;
    const facing = c.fovDeg != null && c.fovDeg > 0 ? facingShare(c.position, c.rotationDeg, c.fovDeg, zone.polygon, aspect) : null;
    if (facing !== null && facing === 0 && cfg.fovWeight >= 1) continue;
    const score = distance / cfg.maxDistance + (facing === null ? 0 : cfg.fovWeight * (1 - facing));
    out.push({ id: c.id, distance, inside: distance === 0, facing, score });
  }
  out.sort((a, b) => a.score - b.score || a.distance - b.distance || (a.id < b.id ? -1 : 1));
  return out.slice(0, cfg.maxSuggestions);
}
