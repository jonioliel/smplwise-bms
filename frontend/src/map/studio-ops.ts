/** Plan Studio (T084): pure edits of a structure document - every function returns a new document, so undo / redo is
 * a stack of documents and nothing is ever mutated in place. */
import { DEFAULT_LEVEL_ID, OPENING_DEFAULTS, isClosedOutline, pointAt, rotated, type GeometryDoc, type GeomGroup, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomSize, type GeomWall, type OpeningKind, type Pt, type Swing, type WallKind } from './geometry';
import type { CatalogItem } from '../api/plan-catalog';

export interface WallDefaults {
  thickness_m: number;
  kind: WallKind;
}

/** 16 hex characters, like the backend's new_id(). */
export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function defaultLevelId(doc: GeometryDoc): string {
  return doc.levels.find((l) => l.is_default)?.id ?? DEFAULT_LEVEL_ID;
}

/** A kind's usual size and swing (a door opens, a window and a passage do not). */
export function kindDefaults(kind: OpeningKind): Pick<GeomOpening, 'kind' | 'width_m' | 'height_m' | 'sill_m' | 'swing'> {
  const swing: Swing = kind === 'door' ? 'right' : 'none';
  return { kind, ...OPENING_DEFAULTS[kind], swing };
}

export function addWall(doc: GeometryDoc, points: Pt[], defaults: WallDefaults): { doc: GeometryDoc; id: string } {
  const id = newId();
  const wall: GeomWall = { id, level_id: defaultLevelId(doc), polyline: points.map(clampPt), thickness_m: defaults.thickness_m, height_m: null, base_z_m: 0,
    kind: defaults.kind, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, walls: [...doc.walls, wall] }, id };
}

export function addOpening(doc: GeometryDoc, wallId: string, t: number, kind: OpeningKind): { doc: GeometryDoc; id: string } {
  const o: GeomOpening = { id: newId(), wall_id: wallId, t: round5(Math.min(1, Math.max(0, t))), ...kindDefaults(kind), hinge: 'start', anchor_ref: null,
    confidence: 1, source: 'manual', external_ids: {} };
  return { doc: { ...doc, openings: [...doc.openings, o] }, id: o.id };
}

export function patchWall(doc: GeometryDoc, id: string, patch: Partial<GeomWall>): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, ...patch, id: w.id } : w)) };
}

export function patchOpening(doc: GeometryDoc, id: string, patch: Partial<GeomOpening>): GeometryDoc {
  return {
    ...doc,
    openings: doc.openings.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, t: patch.t === undefined ? o.t : round5(Math.min(1, Math.max(0, patch.t))) } : o)),
  };
}

/** The positions t that keep an opening `widthM` wide inside a wall `lengthM` long (the validator's opening_outside_wall):
 * half the width from either end. An opening wider than its wall has only the middle. */
export function openingRange(widthM: number, lengthM: number): [number, number] {
  if (!(lengthM > 0)) return [0, 1];
  const half = Math.max(0, widthM) / 2 / lengthM;
  return half >= 0.5 ? [0.5, 0.5] : [half, 1 - half];
}

/** A fine move of an opening along its wall by `dt` (a fraction of the wall's length): it stops at the end of `range`, and
 * never goes against the key - an opening that already sticks out does not jump, it only moves back towards the wall. */
export function nudgeT(t: number, dt: number, [lo, hi]: [number, number]): number {
  if (dt > 0) return Math.max(t, Math.min(t + dt, hi));
  if (dt < 0) return Math.min(t, Math.max(t + dt, lo));
  return t;
}

/** The unit direction of a wall at relative position t, in plan pixels (y down, so also on screen), pointing towards
 * the wall's end: the segment the position lies on, as the map draws an opening there. */
export function wallDirectionAt(wall: GeomWall, t: number, W: number, H: number): Pt {
  const pts: Pt[] = wall.polyline.map((v) => [v[0] * W, v[1] * H]);
  if (pts.length < 2) return [1, 0];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return pointAt(pts, cum, Math.min(1, Math.max(0, t)) * cum[cum.length - 1]).d;
}

export function moveVertex(doc: GeometryDoc, id: string, index: number, p: Pt): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, polyline: w.polyline.map((q, i) => (i === index ? clampPt(p) : q)) } : w)) };
}

/** Whether one corner can go without taking the wall with it: an open wall keeps at least two points, a closed outline
 * stays closed with at least three corners (four points, the last repeating the first). */
export function cornerRemovable(polyline: Pt[]): boolean {
  return isClosedOutline(polyline) ? polyline.length >= 5 : polyline.length >= 3;
}

/** Delete one corner of a wall (a closed outline's corner 0 is its closing point: the outline closes on the next corner).
 * A wall that cannot lose a corner (cornerRemovable) is deleted instead, with its openings. */
export function removeCorner(doc: GeometryDoc, id: string, index: number): { doc: GeometryDoc; wallRemoved: boolean } {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return { doc, wallRemoved: false };
  const pl = w.polyline;
  const closed = isClosedOutline(pl);
  if (index < 0 || index >= (closed ? pl.length - 1 : pl.length)) return { doc, wallRemoved: false };
  if (!cornerRemovable(pl)) return { doc: removeItem(doc, id), wallRemoved: true };
  const ring = (closed ? pl.slice(0, -1) : pl).filter((_, k) => k !== index);
  const polyline: Pt[] = closed ? [...ring, [ring[0][0], ring[0][1]]] : ring;
  return { doc: { ...doc, walls: doc.walls.map((x) => (x.id === id ? { ...x, polyline } : x)) }, wallRemoved: false };
}

/** A wall takes its openings with it; an object leaves its group and its circuit and takes the connector derived from it;
 * a group leaves its members in place, unlinked; a connector and a circuit simply go. */
export function removeItem(doc: GeometryDoc, id: string): GeometryDoc {
  if (doc.walls.some((w) => w.id === id)) return { ...doc, walls: doc.walls.filter((w) => w.id !== id), openings: doc.openings.filter((o) => o.wall_id !== id) };
  if (doc.objects.some((o) => o.id === id)) {
    return {
      ...doc,
      objects: doc.objects.filter((o) => o.id !== id),
      groups: doc.groups.map((g) => (g.member_ids.includes(id) ? { ...g, member_ids: g.member_ids.filter((m) => m !== id) } : g)),
      circuits: doc.circuits.map((k) => (k.member_ids.includes(id) ? { ...k, member_ids: k.member_ids.filter((m) => m !== id) } : k)),
      connectors: doc.connectors.filter((c) => c.object_id !== id),
    };
  }
  if (doc.groups.some((g) => g.id === id)) return { ...doc, groups: doc.groups.filter((g) => g.id !== id), objects: doc.objects.map((o) => (o.group_id === id ? { ...o, group_id: null } : o)) };
  if (doc.connectors.some((c) => c.id === id)) return { ...doc, connectors: doc.connectors.filter((c) => c.id !== id) };
  if (doc.circuits.some((k) => k.id === id)) return { ...doc, circuits: doc.circuits.filter((k) => k.id !== id) };
  return { ...doc, openings: doc.openings.filter((o) => o.id !== id), labels: doc.labels.filter((l) => l.id !== id) };
}

export function addLabel(doc: GeometryDoc, p: Pt, text: string): { doc: GeometryDoc; id: string } {
  const label: GeomLabel = { id: newId(), text, position: clampPt(p), level_id: defaultLevelId(doc), size: 14 };
  return { doc: { ...doc, labels: [...doc.labels, label] }, id: label.id };
}

export function patchLabel(doc: GeometryDoc, id: string, patch: Partial<GeomLabel>): GeometryDoc {
  return { ...doc, labels: doc.labels.map((l) => (l.id === id ? { ...l, ...patch, id: l.id, position: patch.position ? clampPt(patch.position) : l.position } : l)) };
}

// ---------------------------------------------------------------- objects (T085)

export interface PlaceOpts {
  levelId: string;
  ceilingM: number;
}
/** An object dropped this close (metres) to an anchor of a kind its item may represent is offered as the anchor's body. */
export const BIND_DISTANCE_M = 0.5;
const MIN_SIZE_M = 0.05;
const MAX_SIZE_M = 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** The height an item sits at: ceiling items carry a negative offset from the level's ceiling (a lamp at ceiling - 0.3). */
export function objectZ(item: Pick<CatalogItem, 'z_ref' | 'z_m'>, ceilingM: number): number {
  return item.z_ref === 'ceiling' ? round3(ceilingM + item.z_m) : item.z_m;
}

export function addObject(doc: GeometryDoc, item: CatalogItem, p: Pt, opts: PlaceOpts, rotation = 0): { doc: GeometryDoc; id: string } {
  const o: GeomObject = { id: newId(), item_id: item.id, level_id: opts.levelId, position: clampPt(p), rotation_deg: rotation, size: { ...item.size }, z_m: objectZ(item, opts.ceilingM),
    params: JSON.parse(JSON.stringify(item.params)) as Record<string, unknown>, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, objects: [...doc.objects, o] }, id: o.id };
}

export function patchObject(doc: GeometryDoc, id: string, patch: Partial<GeomObject>): GeometryDoc {
  return { ...doc, objects: doc.objects.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, position: patch.position ? clampPt(patch.position) : o.position } : o)) };
}

export function moveObject(doc: GeometryDoc, id: string, p: Pt): GeometryDoc {
  return patchObject(doc, id, { position: p });
}

/** A copy at `p`: same item, size, height, params, label, level and rotation; never bound, never in a group. */
export function duplicateObject(doc: GeometryDoc, id: string, p: Pt, newIdValue?: string): { doc: GeometryDoc; id: string } {
  const src = doc.objects.find((o) => o.id === id);
  if (!src) return { doc, id };
  const copy: GeomObject = { ...src, id: newIdValue ?? newId(), position: clampPt(p), params: JSON.parse(JSON.stringify(src.params)) as Record<string, unknown>, size: { ...src.size }, anchor_ref: null, group_id: null, external_ids: {} };
  return { doc: { ...doc, objects: [...doc.objects, copy] }, id: copy.id };
}

/** The rotation (0 = up, clockwise) that points an object's front at `p`, snapped to `snapDeg` degrees. */
export function rotationTo(o: Pick<GeomObject, 'position'>, p: Pt, W: number, H: number, snapDeg: number): number {
  const dx = (p[0] - o.position[0]) * W;
  const dy = (p[1] - o.position[1]) * H;
  if (Math.hypot(dx, dy) < 1e-9) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const snapped = Math.round(deg / snapDeg) * snapDeg;
  return ((snapped % 360) + 360) % 360;
}

/** The size after dragging an edge midpoint to `p`: edge 0 = front (-d), 1 = right (+w), 2 = back (+d), 3 = left (-w). The
 * stretch is symmetric about the centre: the dragged edge goes to the pointer's distance from the centre and the opposite
 * edge moves out by as much, so the centre stays where it is. Shift keeps the width / depth ratio. Never below 5 cm,
 * never above 100 m. */
export function stretchedSize(o: Pick<GeomObject, 'position' | 'rotation_deg' | 'size'>, edge: 0 | 1 | 2 | 3, p: Pt, W: number, H: number, scale: number, keepRatio: boolean): GeomSize {
  const theta = ((o.rotation_deg || 0) * Math.PI) / 180;
  const [ax, ay] = rotated(0, 0, edge === 1 ? 1 : edge === 3 ? -1 : 0, edge === 2 ? 1 : edge === 0 ? -1 : 0, theta); // the edge's outward unit vector on screen
  const dx = (p[0] - o.position[0]) * W;
  const dy = (p[1] - o.position[1]) * H;
  const along = Math.max(0, dx * ax + dy * ay); // how far from the centre the pointer is, along the outward direction
  const clamp = (v: number) => Math.min(MAX_SIZE_M, Math.max(MIN_SIZE_M, round3(v)));
  const ratio = o.size.d_m / o.size.w_m;
  if (edge === 1 || edge === 3) {
    const w = clamp(along * 2 * scale);
    return { ...o.size, w_m: w, d_m: keepRatio ? clamp(w * ratio) : o.size.d_m };
  }
  const d = clamp(along * 2 * scale);
  return { ...o.size, d_m: d, w_m: keepRatio ? clamp(d / ratio) : o.size.w_m };
}

// ---------------------------------------------------------------- arrays and groups (T085)

export interface ArrayOpts {
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  directionDeg: number;
}
/** Members an array may have at once (six rows of twelve chairs is 72). */
export const ARRAY_MAX = 400;
const OBJECTS_MAX = 5000;

/** Column pitch = the item's width + 5 cm, row pitch = its depth + 45 cm (a walkable gap behind a chair). */
export function arrayDefaults(item: Pick<CatalogItem, 'size'>): { spacingX: number; spacingY: number } {
  return { spacingX: round3(item.size.w_m + 0.05), spacingY: round3(item.size.d_m + 0.45) };
}

/** Rows x columns of copies of an object, in one group. Columns run along the direction's right, rows along its back
 * (direction 0 = up: columns go right on screen, rows go down). The origin stays member [0, 0] and keeps its id; every
 * copy gets a new one. Null when the origin is missing or already grouped, the array is smaller than 2 or larger than
 * ARRAY_MAX, or the document would pass its object limit. */
export function addArray(doc: GeometryDoc, originId: string, opts: ArrayOpts, W: number, H: number, scale: number): { doc: GeometryDoc; groupId: string; ids: string[] } | null {
  const origin = doc.objects.find((o) => o.id === originId);
  const rows = Math.floor(opts.rows);
  const cols = Math.floor(opts.cols);
  const total = rows * cols;
  if (!origin || origin.group_id || rows < 1 || cols < 1 || total < 2 || total > ARRAY_MAX || doc.objects.length + total - 1 > OBJECTS_MAX) return null;
  const theta = ((opts.directionDeg || 0) * Math.PI) / 180;
  const right: Pt = [Math.cos(theta), Math.sin(theta)];
  const back: Pt = [-Math.sin(theta), Math.cos(theta)];
  const px = 1 / scale;
  const groupId = newId();
  const ids: string[] = [];
  const added: GeomObject[] = [];
  const x0 = origin.position[0] * W;
  const y0 = origin.position[1] * H;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * opts.spacingX * px * right[0] + r * opts.spacingY * px * back[0];
      const y = y0 + c * opts.spacingX * px * right[1] + r * opts.spacingY * px * back[1];
      if (r === 0 && c === 0) {
        ids.push(origin.id);
        continue;
      }
      const copy: GeomObject = { ...origin, id: newId(), position: clampPt([x / W, y / H]), params: JSON.parse(JSON.stringify(origin.params)) as Record<string, unknown>, size: { ...origin.size },
        anchor_ref: null, group_id: groupId, external_ids: {} };
      ids.push(copy.id);
      added.push(copy);
    }
  }
  const group: GeomGroup = { id: groupId, kind: 'array', member_ids: ids, params: { rows, cols, spacing_x_m: opts.spacingX, spacing_y_m: opts.spacingY, direction_deg: opts.directionDeg, item_id: origin.item_id }, label: null };
  return { doc: { ...doc, objects: [...doc.objects.map((o) => (o.id === origin.id ? { ...o, group_id: groupId } : o)), ...added], groups: [...doc.groups, group] }, groupId, ids };
}

/** Every member of the group moves by (dx, dy) in normalized plan space; a member that is the body of an anchor stays. */
export function moveGroup(doc: GeometryDoc, groupId: string, dx: number, dy: number): GeometryDoc {
  const g = doc.groups.find((x) => x.id === groupId);
  if (!g) return doc;
  const members = new Set(g.member_ids);
  return { ...doc, objects: doc.objects.map((o) => (members.has(o.id) && !o.anchor_ref ? { ...o, position: clampPt([o.position[0] + dx, o.position[1] + dy]) } : o)) };
}

/** The group goes; its members go with it (`withMembers`) or stay in place, unlinked. */
export function removeGroup(doc: GeometryDoc, groupId: string, withMembers: boolean): GeometryDoc {
  const g = doc.groups.find((x) => x.id === groupId);
  if (!g) return doc;
  let out = doc;
  if (withMembers) for (const id of g.member_ids) out = removeItem(out, id);
  return removeItem(out, groupId);
}

// ---------------------------------------------------------------- levels (T085)

export function addLevel(doc: GeometryDoc, name: string, elevationM: number, ceilingM: number): { doc: GeometryDoc; id: string } {
  let n = 0;
  while (doc.levels.some((l) => l.id === `L${n}`)) n++;
  const level: GeomLevel = { id: `L${n}`, name: name.trim(), elevation_m: round3(elevationM), ceiling_height_m: round3(ceilingM), is_default: doc.levels.length === 0, external_ids: {} };
  return { doc: { ...doc, levels: [...doc.levels, level] }, id: level.id };
}

/** Exactly one level is the default: making one the default clears the others. */
export function patchLevel(doc: GeometryDoc, id: string, patch: Partial<GeomLevel>): GeometryDoc {
  return { ...doc, levels: doc.levels.map((l) => (l.id === id ? { ...l, ...patch, id: l.id } : patch.is_default ? { ...l, is_default: false } : l)) };
}

/** How many items sit on a level: walls, labels, objects, and connectors that start or end there. */
export function levelUsage(doc: GeometryDoc, id: string): number {
  return doc.walls.filter((w) => w.level_id === id).length + doc.labels.filter((l) => l.level_id === id).length + doc.objects.filter((o) => o.level_id === id).length
    + doc.connectors.filter((c) => c.level_from === id || c.level_to === id).length;
}

/** The level goes only when nothing sits on it and it is not the default (rooms and anchors keep their own level id:
 * the server treats an unknown one as the default). */
export function removeLevel(doc: GeometryDoc, id: string): GeometryDoc | null {
  const level = doc.levels.find((l) => l.id === id);
  if (!level || level.is_default || levelUsage(doc, id) > 0) return null;
  return { ...doc, levels: doc.levels.filter((l) => l.id !== id) };
}
