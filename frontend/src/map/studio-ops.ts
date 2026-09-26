/** Plan Studio (T084): pure edits of a structure document - every function returns a new document, so undo / redo is
 * a stack of documents and nothing is ever mutated in place. */
import { DEFAULT_LEVEL_ID, OPENING_DEFAULTS, isClosedOutline, objectCorners, pointAt, rotated, type ConnectorKind, type GeometryDoc, type GeomCircuit, type GeomConnector, type GeomGroup, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomSize, type GeomWall, type OpeningKind, type Pt, type Swing, type WallKind } from './geometry';
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

/** The `plan.levels` setting turned into a level filter for a floor just opened (0.1.89): `all` (or the setting
 * unavailable) shows every level; `default` opens on the floor's default level. A document without levels or with a
 * single level behaves the same either way, so it stays null (no filter, and no level bar to filter with). */
export function initialLevel(setting: 'all' | 'default' | undefined, doc: { levels: GeomLevel[] }): string | null {
  if (setting !== 'default' || doc.levels.length < 2) return null;
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

/** The part of a move (dx, dy) that keeps every point of `pts` inside the plan (0..1): the shape moves as a whole and
 * stops at the edge, never squashed against it. */
function clampDelta(xs: number[], ys: number[], dx: number, dy: number): [number, number] {
  if (!xs.length) return [0, 0];
  const cx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
  const cy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
  return [cx, cy];
}

/** A whole wall moves by (dx, dy) in normalized plan space (hotfix 0.1.87: walls could only be reshaped by their
 * corners). Clamped as a whole so no corner leaves the plan; a closed outline stays closed. Its openings sit at a
 * relative position t along it, so they ride along unchanged; groups, objects and connectors are not touched. */
export function translateWall(doc: GeometryDoc, id: string, dx: number, dy: number): GeometryDoc {
  const w = doc.walls.find((x) => x.id === id);
  if (!w) return doc;
  const [cx, cy] = clampDelta(w.polyline.map((q) => q[0]), w.polyline.map((q) => q[1]), dx, dy);
  const polyline: Pt[] = w.polyline.map((q) => [round5(Math.min(1, Math.max(0, q[0] + cx))), round5(Math.min(1, Math.max(0, q[1] + cy)))]);
  return { ...doc, walls: doc.walls.map((x) => (x.id === id ? { ...x, polyline } : x)) };
}

/** A zone (room) polygon moved as a whole by (dx, dy), clamped inside the plan, rounded like the zone editor's corners
 * (4 places). A new array: the input is never changed. */
export function translatePolygon(poly: readonly { x: number; y: number }[], dx: number, dy: number): { x: number; y: number }[] {
  const [cx, cy] = clampDelta(poly.map((q) => q.x), poly.map((q) => q.y), dx, dy);
  const r4 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4;
  return poly.map((q) => ({ x: r4(q.x + cx), y: r4(q.y + cy) }));
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
      groups: doc.groups.map((g) => (g.member_ids.includes(id) ? { ...g, member_ids: g.member_ids.filter((m) => m !== id) } : g)).filter((g) => g.member_ids.length > 0),
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
  const copy = copyObject(src, p, newIdValue ?? newId());
  return { doc: { ...doc, objects: [...doc.objects, copy] }, id: copy.id };
}

/** The copy duplicateObject makes (duplicateSelection makes the same, several at once). */
function copyObject(src: GeomObject, p: Pt, id: string): GeomObject {
  return { ...src, id, position: clampPt(p), params: JSON.parse(JSON.stringify(src.params)) as Record<string, unknown>, size: { ...src.size }, anchor_ref: null, group_id: null, external_ids: {} };
}

/** A copy beside the original, ready to be dragged into place (the inspector's "שכפל", Ctrl+D): one object width plus
 * 30 cm to the right; below the original when that leaves the plan; to the left when below leaves it too. `scale` is
 * metres per plan pixel; W and H the plan's pixel size. An unknown id returns the document unchanged. */
export function duplicateBeside(doc: GeometryDoc, id: string, W: number, H: number, scale: number): { doc: GeometryDoc; id: string } {
  const src = doc.objects.find((o) => o.id === id);
  if (!src || !(scale > 0) || !(W > 0) || !(H > 0)) return { doc, id };
  const dx = (src.size.w_m + 0.3) / scale / W;
  const dy = (src.size.d_m + 0.3) / scale / H;
  let p: Pt = [src.position[0] + dx, src.position[1]];
  if (p[0] > 1) p = [src.position[0], src.position[1] + dy];
  if (p[1] > 1) p = [Math.max(0, src.position[0] - dx), src.position[1]];
  return duplicateObject(doc, id, p);
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

/** Whether item `id` (any kind) would still show on the map under a level filter (null = every level, always visible):
 * a wall or an opening by its wall's level_id, a label or an object by its own, a connector if either end matches, a
 * group if any of its members would show; a connector always, since buildPrimitives draws every connector on every
 * level (only the "hide connectors" layer toggle gates them - level_from / level_to are its endpoints, not a filter).
 * An item without a level_id belongs to the default level (final review item 1: the level filter used to hide a
 * selected item it should have followed, or should have dropped the selection for). */
export function visibleUnderLevel(doc: GeometryDoc, id: string, levelId: string | null): boolean {
  if (levelId === null) return true;
  const def = defaultLevelId(doc);
  const onLevel = (lv: string) => (lv || def) === levelId;
  const wall = doc.walls.find((w) => w.id === id);
  if (wall) return onLevel(wall.level_id);
  const opening = doc.openings.find((o) => o.id === id);
  if (opening) {
    const host = doc.walls.find((w) => w.id === opening.wall_id);
    return host ? onLevel(host.level_id) : true;
  }
  const label = doc.labels.find((l) => l.id === id);
  if (label) return onLevel(label.level_id);
  const obj = doc.objects.find((o) => o.id === id);
  if (obj) return onLevel(obj.level_id);
  if (doc.connectors.some((c) => c.id === id)) return true; // connectors are drawn on every level (final review R2)
  const group = doc.groups.find((g) => g.id === id);
  if (group) return group.member_ids.some((m) => visibleUnderLevel(doc, m, levelId));
  return true;
}

// ---------------------------------------------------------------- multi-selection (T085)

/** What the editor's select tool can hold several of at once (owner report 2026-09-26): walls and objects of the
 * document, and zones (rooms), which live beside it on the server. Openings, labels, connectors, groups and circuits keep
 * their own single selection. */
export type MultiKind = 'wall' | 'object' | 'zone';
export interface MultiItem {
  id: string;
  kind: MultiKind;
}
/** A zone as the selection sees it: its id, its normalized polygon and its level (unset = no particular level). */
export interface ZoneShape {
  id: string;
  polygon: readonly { x: number; y: number }[];
  level_id?: string | null;
  /** Its free-text tags (T085); unset = none. */
  tags?: readonly string[] | null;
}

/** Whether a zone belongs under a level filter (null = every level) for Ctrl+A, the marquee and the pruning of a
 * multi-selection when the filter changes: a zone on that level. A zone with no level set is on the default level
 * (`defaultLevel`), as the backend, the zone inspector, the 3D view and the walls and objects all read it - and it is the
 * usual case, since only a hand edit gives a zone a level. The editor draws every zone under every filter, but a zone of
 * another level is never swept into a bulk action there: "filter to the basement, Ctrl+A, Delete" must not delete the
 * ground floor's rooms (review of T085, S2, corrected by R1). */
export function zoneOnLevel(z: Pick<ZoneShape, 'level_id'>, levelId: string | null, defaultLevel: string): boolean {
  return levelId === null || (z.level_id || defaultLevel) === levelId;
}

/** Shift+click: an item not in the selection joins it at the end; one already in it leaves. A new array. */
export function toggleItem(items: readonly MultiItem[], item: MultiItem): MultiItem[] {
  return items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item];
}

/** The members that move by hand: selected walls, and selected objects that are not the body of an anchor (a body moves
 * with its anchor, never by hand - as moveGroup and a single drag treat it). */
function movableMembers(doc: GeometryDoc, ids: readonly string[]): { walls: GeomWall[]; objects: GeomObject[] } {
  const set = new Set(ids);
  return { walls: doc.walls.filter((w) => set.has(w.id)), objects: doc.objects.filter((o) => set.has(o.id) && !o.anchor_ref) };
}

/** The part of a move (dx, dy) that keeps every moving member of the selection inside the plan - the walls' corners, the
 * objects' centres and the corners of the `zones` polygons moving with them - so the selection stops at the edge as a
 * whole and keeps its layout, instead of each member being squashed against the edge on its own. */
export function selectionDelta(doc: GeometryDoc, ids: readonly string[], dx: number, dy: number, zones: readonly (readonly { x: number; y: number }[])[] = []): [number, number] {
  const { walls, objects } = movableMembers(doc, ids);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const w of walls) for (const q of w.polyline) { xs.push(q[0]); ys.push(q[1]); }
  for (const o of objects) { xs.push(o.position[0]); ys.push(o.position[1]); }
  for (const z of zones) for (const q of z) { xs.push(q.x); ys.push(q.y); }
  return xs.length ? clampDelta(xs, ys, dx, dy) : [dx, dy];
}

/** Every selected wall and object moved by the same (dx, dy), clamped once for the whole selection (selectionDelta) -
 * one document, so one undo step. The result is exactly translateWall per wall and moveObject per object (the unit test
 * keeps that composition as its oracle), computed in one pass over the walls and one over the objects: it runs on every
 * pointer move of a group drag, and a composition would rebuild both lists once per member. Ids that are neither (a
 * zone, an unknown id) are left to the caller. */
export function moveSelection(doc: GeometryDoc, ids: readonly string[], dx: number, dy: number): GeometryDoc {
  const set = new Set(ids);
  const [cx, cy] = selectionDelta(doc, ids, dx, dy);
  const shift = (q: Pt): Pt => [round5(Math.min(1, Math.max(0, q[0] + cx))), round5(Math.min(1, Math.max(0, q[1] + cy)))];
  // cx, cy already keep every member inside the plan, so translateWall's own clamp would change nothing: the same shift
  return {
    ...doc,
    walls: doc.walls.map((w) => (set.has(w.id) ? { ...w, polyline: w.polyline.map(shift) } : w)),
    objects: doc.objects.map((o) => (set.has(o.id) && !o.anchor_ref ? { ...o, position: clampPt([o.position[0] + cx, o.position[1] + cy]) } : o)),
  };
}

/** Every item of `ids` removed with removeItem's rules - a wall with its openings; an object out of its group (a group
 * left empty goes), its circuit and its derived connector; a group leaving its members unlinked; a connector, a circuit,
 * an opening or a label simply going - in one document, one undo step. One pass per collection (a Ctrl+A delete on a big
 * plan would otherwise rebuild every list once per item); the unit test keeps the composition of removeItem as its
 * oracle. */
export function removeItems(doc: GeometryDoc, ids: readonly string[]): GeometryDoc {
  if (!ids.length) return doc;
  const set = new Set(ids);
  const goneWalls = new Set(doc.walls.filter((w) => set.has(w.id)).map((w) => w.id));
  const goneObjects = new Set(doc.objects.filter((o) => set.has(o.id)).map((o) => o.id));
  const goneGroups = new Set(doc.groups.filter((g) => set.has(g.id)).map((g) => g.id));
  const lessMembers = <T extends { member_ids: string[] }>(x: T): T => (x.member_ids.some((m) => goneObjects.has(m)) ? { ...x, member_ids: x.member_ids.filter((m) => !goneObjects.has(m)) } : x);
  const groups = doc.groups.filter((g) => !goneGroups.has(g.id)).map(lessMembers);
  return {
    ...doc,
    walls: doc.walls.filter((w) => !goneWalls.has(w.id)),
    openings: doc.openings.filter((o) => !set.has(o.id) && !goneWalls.has(o.wall_id)),
    objects: doc.objects.filter((o) => !goneObjects.has(o.id)).map((o) => (o.group_id && goneGroups.has(o.group_id) ? { ...o, group_id: null } : o)),
    groups: goneObjects.size ? groups.filter((g) => g.member_ids.length > 0) : groups, // as removeItem: an object going drops the groups it left empty
    circuits: doc.circuits.filter((k) => !set.has(k.id)).map(lessMembers),
    connectors: doc.connectors.filter((c) => !set.has(c.id) && !(c.object_id && goneObjects.has(c.object_id))),
    labels: doc.labels.filter((l) => !set.has(l.id)),
  };
}

/** The selected objects copied as one block beside the selection (the multi-selection's "שכפל", Ctrl+D): duplicateBeside's
 * rule applied to the block's footprint instead of one object - the block's width plus 30 cm to the right, below when a
 * copy would leave the plan, to the left when below leaves it too - so every copy moves by the same shift and the copies
 * never overlap the originals. Walls and zones in `ids` are not copied. Returns the new ids in the order of `ids`. */
export function duplicateSelection(doc: GeometryDoc, ids: readonly string[], W: number, H: number, scale: number): { doc: GeometryDoc; ids: string[] } {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const srcs = ids.map((id) => byId.get(id)).filter((o): o is GeomObject => !!o);
  if (!srcs.length || !(scale > 0) || !(W > 0) || !(H > 0)) return { doc, ids: [] };
  const corners = srcs.flatMap((o) => objectCorners(o, W, H, scale));
  const spanX = Math.max(...corners.map((c) => c[0])) - Math.min(...corners.map((c) => c[0])); // plan pixels
  const spanY = Math.max(...corners.map((c) => c[1])) - Math.min(...corners.map((c) => c[1]));
  const dx = (spanX + 0.3 / scale) / W;
  const dy = (spanY + 0.3 / scale) / H;
  const maxX = Math.max(...srcs.map((o) => o.position[0]));
  const maxY = Math.max(...srcs.map((o) => o.position[1]));
  const [sx, sy] = maxX + dx <= 1 ? [dx, 0] : maxY + dy <= 1 ? [0, dy] : [-dx, 0];
  const copies = srcs.map((o) => copyObject(o, [o.position[0] + sx, o.position[1] + sy], newId())); // duplicateObject's copy, all at once
  return { doc: { ...doc, objects: [...doc.objects, ...copies] }, ids: copies.map((c) => c.id) };
}

/** Ctrl+A in the select tool: every wall and object the level filter shows (visibleUnderLevel's rule for them: an item
 * without a level belongs to the default level), then every zone on that level by the same rule (zoneOnLevel). One pass
 * per list. */
export function selectableItems(doc: GeometryDoc, zones: readonly Pick<ZoneShape, 'id' | 'level_id'>[], levelId: string | null): MultiItem[] {
  const def = defaultLevelId(doc);
  const shown = (lv: string) => levelId === null || (lv || def) === levelId;
  return [
    ...doc.walls.filter((w) => shown(w.level_id)).map((w): MultiItem => ({ id: w.id, kind: 'wall' })),
    ...doc.objects.filter((o) => shown(o.level_id)).map((o): MultiItem => ({ id: o.id, kind: 'object' })),
    ...zones.filter((z) => zoneOnLevel(z, levelId, def)).map((z): MultiItem => ({ id: z.id, kind: 'zone' })),
  ];
}

/** The marquee: the shown walls, objects and zones FULLY inside the rectangle (normalized plan space, corners in any
 * order) - every corner of a wall's polyline, of an object's footprint (objectCorners, turned with it) and of a zone's
 * polygon. Fully, not mostly: a zone or a long outer wall that the drag merely crosses is not caught, which matters here
 * because a marquee may start on a room's fill. W, H: the plan's pixel size; scale: metres per plan pixel. */
export function itemsInRect(doc: GeometryDoc, zones: readonly ZoneShape[], rect: { x0: number; y0: number; x1: number; y1: number }, levelId: string | null, W: number, H: number, scale: number): MultiItem[] {
  const EPS = 1e-9;
  const [x0, x1] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
  const [y0, y1] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
  const inside = (x: number, y: number) => x >= x0 - EPS && x <= x1 + EPS && y >= y0 - EPS && y <= y1 + EPS;
  const objectInside = (o: GeomObject) => (scale > 0 && W > 0 && H > 0 ? objectCorners(o, W, H, scale).every((c) => inside(c[0] / W, c[1] / H)) : inside(o.position[0], o.position[1]));
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const objects = new Map(doc.objects.map((o) => [o.id, o]));
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  return selectableItems(doc, zones, levelId).filter((i) => {
    if (i.kind === 'wall') return walls.get(i.id)!.polyline.every((q) => inside(q[0], q[1]));
    if (i.kind === 'object') return objectInside(objects.get(i.id)!);
    const z = zoneById.get(i.id)!;
    return z.polygon.length > 0 && z.polygon.every((q) => inside(q.x, q.y));
  });
}

// ---------------------------------------------------------------- tags and bulk reassignment (T085)

/** The bounds of an item's tags: plan_geometry.MAX_TAGS / MAX_TAG_LEN, shared by the zone PATCH. Past them the server
 * refuses the save, so the editor never produces them. */
export const TAG_MAX_COUNT = 20;
export const TAG_MAX_LEN = 40;

/** A tag as typed, cleaned: trimmed, every run of spaces one space. Null when nothing is left or it is longer than
 * TAG_MAX_LEN (owner request 2026-09-26: free text - "מטבח", "יציאת חירום" - no fixed vocabulary). */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  return t && t.length <= TAG_MAX_LEN ? t : null;
}

/** Two spellings of one tag ("Kitchen", " kitchen") are the same tag: every comparison goes through this key. */
const tagKey = (t: string): string => t.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** The list with `tag` (cleaned) at its end. The same list when the tag is blank, already there in any spelling, or the
 * list is full (TAG_MAX_COUNT). */
export function withTag(tags: readonly string[] | null | undefined, tag: string): string[] {
  const t = normalizeTag(tag);
  const list = (tags ?? []) as string[];
  if (!t || list.length >= TAG_MAX_COUNT || list.some((x) => tagKey(x) === tagKey(t))) return list;
  return [...list, t];
}

/** The list without `tag` in any spelling; the same list when it is not there. */
export function withoutTag(tags: readonly string[] | null | undefined, tag: string): string[] {
  const list = (tags ?? []) as string[];
  const k = tagKey(tag);
  return list.some((x) => tagKey(x) === k) ? list.filter((x) => tagKey(x) !== k) : list;
}

/** One tag added to (`add`) or removed from every wall and object of `ids`, in one document - one undo step; the result
 * is patchWall / patchObject with withTag / withoutTag per member (the unit test keeps that composition as its oracle).
 * An item the edit does not change (it already has the tag, never had it, or is full) stays the same object, and the
 * document itself when none changes. Zones (and unknown ids) in `ids` are left to the caller: they live on the server. */
export function tagItems(doc: GeometryDoc, ids: readonly string[], tag: string, add: boolean): GeometryDoc {
  if (!normalizeTag(tag)) return doc;
  const set = new Set(ids);
  let changed = false;
  const edit = <T extends { id: string; tags?: string[] }>(x: T): T => {
    if (!set.has(x.id)) return x;
    const next = add ? withTag(x.tags, tag) : withoutTag(x.tags, tag);
    if (next === x.tags || (x.tags === undefined && !next.length)) return x;
    changed = true;
    return { ...x, tags: next };
  };
  const walls = doc.walls.map(edit);
  const objects = doc.objects.map(edit);
  return changed ? { ...doc, walls, objects } : doc;
}

/** The tags of `items` (walls, objects, zones) with how many of them carry each, in the order and the spelling first
 * seen: the bulk panel's chips and the select-by-tag list. */
export function tagCounts(doc: GeometryDoc, zones: readonly Pick<ZoneShape, 'id' | 'tags'>[], items: readonly MultiItem[]): { tag: string; count: number }[] {
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const objects = new Map(doc.objects.map((o) => [o.id, o]));
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const out = new Map<string, { tag: string; count: number }>();
  for (const i of items) {
    const tags = i.kind === 'wall' ? walls.get(i.id)?.tags : i.kind === 'object' ? objects.get(i.id)?.tags : zoneById.get(i.id)?.tags;
    const seen = new Set<string>();
    for (const t of tags ?? []) {
      const k = tagKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      const e = out.get(k);
      if (e) e.count += 1;
      else out.set(k, { tag: t, count: 1 });
    }
  }
  return [...out.values()];
}

/** Select by tag: every wall, object and zone carrying `tag` (any spelling) among what Ctrl+A would select under the
 * level filter - selectableItems narrowed to the tag, so the level rule (an item or a zone without a level is on the
 * default level; zoneOnLevel) is the one the marquee and Ctrl+A use, never a second copy of it. */
export function itemsWithTag(doc: GeometryDoc, zones: readonly Pick<ZoneShape, 'id' | 'level_id' | 'tags'>[], tag: string, levelId: string | null): MultiItem[] {
  const t = normalizeTag(tag);
  if (!t) return [];
  const k = tagKey(t);
  const has = (tags: readonly string[] | null | undefined) => !!tags?.some((x) => tagKey(x) === k);
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const objects = new Map(doc.objects.map((o) => [o.id, o]));
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  return selectableItems(doc, zones, levelId).filter((i) => has(i.kind === 'wall' ? walls.get(i.id)?.tags : i.kind === 'object' ? objects.get(i.id)?.tags : zoneById.get(i.id)?.tags));
}

/** Every wall and object of `ids` put on level `levelId` in one document - one undo step; the result is patchWall /
 * patchObject with that level_id per member (the unit test's oracle). A wall's openings go with it (they follow their
 * wall's level). Unchanged members stay the same objects, and the document itself when none changes or `levelId` is not
 * one of its levels. Zones in `ids` are the caller's (a zone PATCH each). */
export function setLevelOf(doc: GeometryDoc, ids: readonly string[], levelId: string): GeometryDoc {
  if (!doc.levels.some((l) => l.id === levelId)) return doc;
  const set = new Set(ids);
  let changed = false;
  const edit = <T extends { id: string; level_id: string }>(x: T): T => {
    if (!set.has(x.id) || x.level_id === levelId) return x;
    changed = true;
    return { ...x, level_id: levelId };
  };
  const walls = doc.walls.map(edit);
  const objects = doc.objects.map(edit);
  return changed ? { ...doc, walls, objects } : doc;
}

/** Whether an object whose library item is `item` may be a member of a lighting circuit - the one rule of the circuit
 * tool's click on a lamp and of the bulk "add to circuit": a light, or an item the library does not know (a custom item
 * deleted meanwhile), which the server's _check_circuits also reads as a light; an item of any other role never. */
export function circuitEligible(item: Pick<CatalogItem, 'role'> | undefined): boolean {
  return !item || item.role === 'light';
}

/** The bulk "add to circuit": the objects of `ids` that `eligible` accepts (the editor passes circuitEligible of the
 * object's library item) join the circuit in one document, each leaving any other circuit (one
 * switch per lamp, as toggleCircuitMember) - but a lamp already on the circuit stays on it, never toggled out. Walls,
 * zones and unknown ids are never members. `added`: the eligible objects, now on the circuit, in the order of `ids`. */
export function joinCircuit(doc: GeometryDoc, circuitId: string, ids: readonly string[], eligible: (o: GeomObject) => boolean): { doc: GeometryDoc; added: string[] } {
  const k = doc.circuits.find((c) => c.id === circuitId);
  if (!k) return { doc, added: [] };
  const objects = new Map(doc.objects.map((o) => [o.id, o]));
  const added = [...new Set(ids)].filter((id) => {
    const o = objects.get(id);
    return !!o && eligible(o);
  });
  const fresh = added.filter((id) => !k.member_ids.includes(id));
  if (!fresh.length) return { doc, added };
  const join = new Set(fresh);
  const circuits = doc.circuits.map((c) => (c.id === circuitId ? { ...c, member_ids: [...c.member_ids, ...fresh] } : c.member_ids.some((m) => join.has(m)) ? { ...c, member_ids: c.member_ids.filter((m) => !join.has(m)) } : c));
  return { doc: { ...doc, circuits }, added };
}

// ---------------------------------------------------------------- connectors (T085)

export const CONNECTOR_KINDS: readonly ConnectorKind[] = ['stairs', 'ramp', 'tribune', 'elevator', 'ladder'];
export const CONNECTOR_DEFAULT_WIDTH_M: Record<ConnectorKind, number> = { stairs: 1.2, ramp: 1.5, tribune: 4, elevator: 1.6, ladder: 0.5 };

export function addConnector(doc: GeometryDoc, kind: ConnectorKind, a: Pt, b: Pt, levelFrom: string, levelTo: string | null): { doc: GeometryDoc; id: string } {
  const c: GeomConnector = { id: newId(), kind, level_from: levelFrom, level_to: levelTo, floor_ids: [], polyline: [clampPt(a), clampPt(b)], width_m: CONNECTOR_DEFAULT_WIDTH_M[kind], label: null,
    object_id: null, source: 'manual', external_ids: {} };
  return { doc: { ...doc, connectors: [...doc.connectors, c] }, id: c.id };
}

export function patchConnector(doc: GeometryDoc, id: string, patch: Partial<GeomConnector>): GeometryDoc {
  return { ...doc, connectors: doc.connectors.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) };
}

/** A corner of a drawn connector; a connector derived from an object (a tribune) follows its object, not the pointer. */
export function moveConnectorVertex(doc: GeometryDoc, id: string, index: number, p: Pt): GeometryDoc {
  return { ...doc, connectors: doc.connectors.map((c) => (c.id === id && !c.object_id ? { ...c, polyline: c.polyline.map((q, i) => (i === index ? clampPt(p) : q)) } : c)) };
}

// ---------------------------------------------------------------- circuits (T085)

export const CIRCUIT_COLORS = ['circuit-1', 'circuit-2', 'circuit-3', 'circuit-4', 'circuit-5', 'circuit-6'] as const;

export function addCircuit(doc: GeometryDoc, name: string, switchEntityId: string, colorToken: string): { doc: GeometryDoc; id: string } {
  const k: GeomCircuit = { id: newId(), name: name.trim(), switch_entity_id: switchEntityId, member_ids: [], color_token: colorToken, power_w: 0 };
  return { doc: { ...doc, circuits: [...doc.circuits, k] }, id: k.id };
}

export function patchCircuit(doc: GeometryDoc, id: string, patch: Partial<GeomCircuit>): GeometryDoc {
  return { ...doc, circuits: doc.circuits.map((k) => (k.id === id ? { ...k, ...patch, id: k.id } : k)) };
}

/** A lamp on the circuit leaves it; a lamp not on it joins (and leaves any other circuit: one switch per lamp). */
export function toggleCircuitMember(doc: GeometryDoc, circuitId: string, objectId: string): GeometryDoc {
  const k = doc.circuits.find((x) => x.id === circuitId);
  if (!k) return doc;
  const member = k.member_ids.includes(objectId);
  return { ...doc, circuits: doc.circuits.map((x) => (x.id === circuitId ? { ...x, member_ids: member ? x.member_ids.filter((m) => m !== objectId) : [...x.member_ids, objectId] } : { ...x, member_ids: x.member_ids.filter((m) => m !== objectId) })) };
}

/** A new lamp placed exactly as addObject places it and wired into the circuit, in one document (one undo step): the
 * circuit panel's lamp picker (owner report 2026-09-26: "add lamps" placed nothing on a click on the map). An unknown
 * circuit id still places the object and leaves every circuit as it was. */
export function addCircuitLamp(doc: GeometryDoc, item: CatalogItem, p: Pt, opts: PlaceOpts, circuitId: string, rotation = 0): { doc: GeometryDoc; id: string } {
  const r = addObject(doc, item, p, opts, rotation);
  return { doc: toggleCircuitMember(r.doc, circuitId, r.id), id: r.id };
}

/** The sum of the members' power: the object's params.power_w, else its item's default (what the server recomputes). */
export function circuitPower(doc: GeometryDoc, k: GeomCircuit, itemOfId: (id: string) => Pick<CatalogItem, 'params'> | undefined): number {
  let total = 0;
  for (const mid of k.member_ids) {
    const o = doc.objects.find((x) => x.id === mid);
    if (!o) continue;
    const own = o.params.power_w;
    const w = typeof own === 'number' ? own : (itemOfId(o.item_id)?.params.power_w as number | undefined);
    if (typeof w === 'number' && Number.isFinite(w)) total += w;
  }
  return Math.round(total * 1000) / 1000;
}
