/** The "סמן דלת" tool of the Plan Studio editor (T087): pure functions from the server's door proposal
 * (POST /plan-versions/{id}/door-proposal, services/plan_door_tool.py) to the ghost the editor shows, its handles, the
 * person's adjustments (width, hinge flip, swing flip) and the accepted door - an ordinary opening (and, when no drawn
 * wall carries it, the short wall piece it came with), added to the draft as one undo step. */
import type { DoorProposal } from '../api/geometry';
import { OPENING_DEFAULTS, effectiveScale, pointOnWall, type GeometryDoc, type GeomOpening, type GeomWall, type Hinge, type Pt, type Swing } from './geometry';
import { addOpening, addWall, defaultLevelId, openingRange, patchOpening, patchWall, wallDirectionAt, type WallDefaults } from './studio-ops';

export const GHOST_WALL_ID = 'ghost-wall';
export const GHOST_DOOR_ID = 'ghost-door';
/** Widths a person can drag the ghost to (metres). */
export const GHOST_WIDTH_M: [number, number] = [0.4, 3.0];
/** A wall piece a door brings reaches this far past each side of it (services/plan_door_tool.py JAMB_M). */
export const GHOST_JAMB_M = 0.12;
/** A wall piece's end snaps onto a drawn wall's end this far past its jamb margin (instead of overlapping it). */
export const GHOST_SNAP_M = 0.25;
/** external_ids.origin of a wall piece the door tool added (the wall inspector says so). */
export const DOOR_TOOL_ORIGIN = 'door_tool';

export interface DoorGhost {
  found: DoorProposal['found'];
  note: string;
  warning: string | null;
  /** The drawn wall the door goes on, or null with `newWall`. */
  wallId: string | null;
  newWall: { polyline: Pt[]; thickness_m: number } | null;
  t: number;
  width_m: number;
  hinge: Hinge;
  swing: Swing;
  confidence: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

function lengthM(wall: Pick<GeomWall, 'polyline'>, doc: GeometryDoc, W: number, H: number): number {
  let px = 0;
  for (let i = 1; i < wall.polyline.length; i++) px += Math.hypot((wall.polyline[i][0] - wall.polyline[i - 1][0]) * W, (wall.polyline[i][1] - wall.polyline[i - 1][1]) * H);
  return px * effectiveScale(doc).scale;
}

/** The ghost from the server's proposal: metres from its version pixels at the document's effective scale (as the
 * detection accept does), the default door width when nothing measured one, and the position pulled inside the wall. */
export function ghostFromProposal(doc: GeometryDoc, p: DoorProposal, W: number, H: number, defaults: WallDefaults): DoorGhost {
  const { scale } = effectiveScale(doc);
  const width = p.width_px != null ? round3(clamp(p.width_px * scale, GHOST_WIDTH_M[0], GHOST_WIDTH_M[1])) : OPENING_DEFAULTS.door.width_m;
  const newWall = p.new_wall
    ? { polyline: p.new_wall.polyline.map((q) => [q[0], q[1]] as Pt), thickness_m: round3(clamp(p.new_wall.thickness_px * scale, 0.05, 0.6)) || defaults.thickness_m }
    : null;
  const g: DoorGhost = { found: p.found, note: p.note, warning: p.warning, wallId: p.wall_id, newWall, t: p.t, width_m: width, hinge: p.hinge, swing: p.swing, confidence: p.confidence };
  return fitGhost(doc, g, W, H);
}

/** The wall the ghost stands on: the drawn one, or the piece it brings (as a draw-only wall). */
export function ghostWall(doc: GeometryDoc, g: DoorGhost, defaults?: WallDefaults): GeomWall | null {
  if (g.wallId) return doc.walls.find((w) => w.id === g.wallId) ?? null;
  if (!g.newWall) return null;
  return { id: GHOST_WALL_ID, level_id: defaultLevelId(doc), polyline: g.newWall.polyline, thickness_m: g.newWall.thickness_m || defaults?.thickness_m || 0.15, height_m: null, base_z_m: 0,
    kind: defaults?.kind ?? 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} };
}

/** Keep the door inside its wall (the validator's opening_outside_wall): a wall piece grows with its door. */
function fitGhost(doc: GeometryDoc, g: DoorGhost, W: number, H: number): DoorGhost {
  const wall = ghostWall(doc, g);
  if (!wall) return g;
  if (g.newWall) {
    // the piece reaches GHOST_JAMB_M past each side of the door, whatever the width, centred on the door
    const [a, b] = [g.newWall.polyline[0], g.newWall.polyline[g.newWall.polyline.length - 1]];
    const cx = a[0] + (b[0] - a[0]) * g.t; // the door's centre (a snapped piece is uneven about it)
    const cy = a[1] + (b[1] - a[1]) * g.t;
    const dx = (b[0] - a[0]) * W;
    const dy = (b[1] - a[1]) * H;
    const n = Math.hypot(dx, dy) || 1;
    const scale = effectiveScale(doc).scale;
    const halfDoor = g.width_m / 2 / scale;
    const ex = dx / n;
    const ey = dy / n;
    // each end reaches GHOST_JAMB_M past the door - or stops on a drawn wall's end there (no overlap with its neighbour)
    const reachTo = (sign: 1 | -1): number => {
      let best = halfDoor + GHOST_JAMB_M / scale;
      let bestOff = Number.POSITIVE_INFINITY;
      const maxLateral = Math.max(g.newWall!.thickness_m, 0.2) / scale;
      for (const w of doc.walls) {
        if (w.polyline.length < 2) continue;
        for (const v of [w.polyline[0], w.polyline[w.polyline.length - 1]]) {
          const rx = (v[0] - cx) * W;
          const ry = (v[1] - cy) * H;
          const along = (rx * ex + ry * ey) * sign;
          const lateral = Math.abs(rx * ey - ry * ex);
          if (along >= halfDoor && along <= halfDoor + (GHOST_JAMB_M + GHOST_SNAP_M) / scale && lateral <= maxLateral && lateral < bestOff) {
            best = along;
            bestOff = lateral;
          }
        }
      }
      return best;
    };
    const hi = reachTo(1);
    const lo = reachTo(-1);
    const a0: Pt = [cx - (ex * lo) / W, cy - (ey * lo) / H];
    const b0: Pt = [cx + (ex * hi) / W, cy + (ey * hi) / H];
    // the door stays where it was: its centre's share of the (possibly uneven) piece
    return { ...g, t: lo / (lo + hi), newWall: { ...g.newWall, polyline: [a0, b0] } };
  }
  const [lo, hi] = openingRange(g.width_m, lengthM(wall, doc, W, H));
  return { ...g, t: clamp(g.t, lo, hi) };
}

/** A draw-only document for the canvas: the ghost's wall and the ghost door, on the document's scale. */
export function ghostDoc(doc: GeometryDoc, g: DoorGhost, defaults?: WallDefaults): GeometryDoc | null {
  const wall = ghostWall(doc, g, defaults);
  if (!wall) return null;
  const door: GeomOpening = { id: GHOST_DOOR_ID, wall_id: wall.id, t: g.t, kind: 'door', width_m: g.width_m, height_m: OPENING_DEFAULTS.door.height_m, sill_m: 0, swing: g.swing, hinge: g.hinge,
    anchor_ref: null, confidence: g.confidence, source: 'manual', external_ids: {} };
  return { ...doc, walls: [wall], openings: [door], labels: [], objects: [], connectors: [] };
}

/** The ends of the ghost's opening along its wall, in normalized plan space: [start side, end side]. */
export function ghostGap(doc: GeometryDoc, g: DoorGhost, W: number, H: number): [Pt, Pt] | null {
  const wall = ghostWall(doc, g);
  if (!wall) return null;
  const len = lengthM(wall, doc, W, H);
  const half = len > 0 ? g.width_m / 2 / len : 0;
  return [pointOnWall(wall, g.t - half, W, H), pointOnWall(wall, g.t + half, W, H)];
}

/** Where the three handles sit (normalized): the width square at the latch end (a double door: the end side), the hinge
 * flip on the wall a little past the hinge end, the swing flip half a width out on the side the door opens to. A double
 * door has no hinge to flip: its swing flip changes the side it opens to. */
export function ghostHandles(doc: GeometryDoc, g: DoorGhost, W: number, H: number): { id: 'width' | 'hinge' | 'swing'; at: Pt; label: string }[] {
  const wall = ghostWall(doc, g);
  const gap = ghostGap(doc, g, W, H);
  if (!wall || !gap) return [];
  const d = wallDirectionAt(wall, g.t, W, H);
  const nl: Pt = [d[1], -d[0]];
  const double = g.swing === 'double' || g.swing === 'sliding';
  const opensLeft = double ? g.hinge === 'start' : g.swing === 'left';
  const side = opensLeft ? 1 : -1;
  const { scale } = effectiveScale(doc);
  const widthPx = g.width_m / scale;
  const hingeEnd = g.hinge === 'start' ? gap[0] : gap[1];
  const latchEnd = double ? gap[1] : g.hinge === 'start' ? gap[1] : gap[0];
  const off = (p: Pt, k: number): Pt => [p[0] + (nl[0] * k) / W, p[1] + (nl[1] * k) / H];
  const mid: Pt = [(gap[0][0] + gap[1][0]) / 2, (gap[0][1] + gap[1][1]) / 2];
  const out: { id: 'width' | 'hinge' | 'swing'; at: Pt; label: string }[] = [{ id: 'width', at: latchEnd, label: 'רוחב הדלת: גרירה לאורך הקיר' }];
  const outward = g.hinge === 'start' ? -1 : 1; // along the wall, away from the opening
  const k = Math.max(14, 0.3 * widthPx);
  if (!double) out.push({ id: 'hinge', at: [hingeEnd[0] + (d[0] * outward * k) / W, hingeEnd[1] + (d[1] * outward * k) / H], label: 'החלף צד ציר' });
  out.push({ id: 'swing', at: off(mid, side * Math.max(18, 0.5 * widthPx)), label: double ? 'החלף את צד הפתיחה' : 'החלף כיוון פתיחה' });
  return out;
}

export function flipHinge(g: DoorGhost): DoorGhost {
  return { ...g, hinge: g.hinge === 'start' ? 'end' : 'start' };
}

/** The swing flip: a single leaf opens to the other side of the wall; a double door (its hinge field picks the side)
 * too. */
export function flipSwing(g: DoorGhost): DoorGhost {
  if (g.swing === 'double' || g.swing === 'sliding') return flipHinge(g);
  return { ...g, swing: g.swing === 'left' ? 'right' : g.swing === 'right' ? 'left' : g.swing };
}

/** The width dragged to plan point p: twice the distance along the wall from the door's centre, in the allowed range
 * and inside the wall (a wall piece grows with it). */
export function ghostWidthTo(doc: GeometryDoc, g: DoorGhost, p: Pt, W: number, H: number): DoorGhost {
  const wall = ghostWall(doc, g);
  if (!wall) return g;
  const c = pointOnWall(wall, g.t, W, H);
  const d = wallDirectionAt(wall, g.t, W, H);
  const along = Math.abs((p[0] - c[0]) * W * d[0] + (p[1] - c[1]) * H * d[1]);
  let width = clamp(2 * along * effectiveScale(doc).scale, GHOST_WIDTH_M[0], GHOST_WIDTH_M[1]);
  if (!g.newWall) width = Math.min(width, lengthM(wall, doc, W, H));
  return fitGhost(doc, { ...g, width_m: round3(width) }, W, H);
}

/** The accepted door: an ordinary opening (source manual, like one placed with the door tool) on its wall, after the
 * wall piece when it brings one - one new document, so one undo step. `levelId`: the level the piece is drawn on. */
export function acceptGhost(doc: GeometryDoc, g: DoorGhost, W: number, H: number, defaults: WallDefaults, levelId?: string): { doc: GeometryDoc; openingId: string; wallId: string } | null {
  let next = doc;
  let wallId = g.wallId;
  if (!wallId) {
    if (!g.newWall) return null;
    const r = addWall(next, g.newWall.polyline, { thickness_m: g.newWall.thickness_m || defaults.thickness_m, kind: defaults.kind });
    next = patchWall(r.doc, r.id, { external_ids: { origin: DOOR_TOOL_ORIGIN }, ...(levelId && levelId !== defaultLevelId(r.doc) ? { level_id: levelId } : {}) });
    wallId = r.id;
  }
  const wall = next.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const [lo, hi] = openingRange(g.width_m, lengthM(wall, next, W, H));
  const r = addOpening(next, wallId, clamp(g.t, lo, hi), 'door');
  return { doc: patchOpening(r.doc, r.id, { width_m: g.width_m, swing: g.swing, hinge: g.hinge }), openingId: r.id, wallId };
}

/** An opening already on the ghost's wall where the ghost would go (their centres closer than half the wider of the
 * two): clicking an accepted door's symbol again selects that door instead of stacking a second one. */
export function existingOpening(doc: GeometryDoc, g: DoorGhost, W: number, H: number): GeomOpening | null {
  const wall = g.wallId ? doc.walls.find((w) => w.id === g.wallId) : null;
  if (!wall) return null;
  const len = lengthM(wall, doc, W, H);
  let best: GeomOpening | null = null;
  let bestM = Number.POSITIVE_INFINITY;
  for (const o of doc.openings) {
    if (o.wall_id !== wall.id) continue;
    const m = Math.abs(o.t - g.t) * len;
    if (m < Math.max(o.width_m, g.width_m) / 2 && m < bestM) {
      best = o;
      bestM = m;
    }
  }
  return best;
}

/** The default ghost when the server cannot be asked (the demo plan): the editor's default door on the wall clicked,
 * opening to the side of the click. */
export function defaultGhost(doc: GeometryDoc, wall: GeomWall, t: number, click: Pt, W: number, H: number): DoorGhost {
  const d = wallDirectionAt(wall, t, W, H);
  const c = pointOnWall(wall, t, W, H);
  const left = (click[0] - c[0]) * W * d[1] + (click[1] - c[1]) * H * -d[0] > 0;
  return fitGhost(doc, { found: 'default', note: 'ברירת מחדל - בדוק', warning: null, wallId: wall.id, newWall: null, t, width_m: OPENING_DEFAULTS.door.width_m, hinge: 'start',
    swing: left ? 'left' : 'right', confidence: 0.2 }, W, H);
}

/** Whether plan point p lies on the ghost: within its opening along the wall and half a width either side of it. */
export function onGhost(doc: GeometryDoc, g: DoorGhost, p: Pt, W: number, H: number): boolean {
  const wall = ghostWall(doc, g);
  if (!wall) return false;
  const c = pointOnWall(wall, g.t, W, H);
  const d = wallDirectionAt(wall, g.t, W, H);
  const dx = (p[0] - c[0]) * W;
  const dy = (p[1] - c[1]) * H;
  const widthPx = g.width_m / effectiveScale(doc).scale;
  return Math.abs(dx * d[0] + dy * d[1]) <= widthPx / 2 && Math.abs(dx * d[1] - dy * d[0]) <= widthPx;
}
