/**
 * Shared space (CR-009, T097): one room that belongs to two floors - the owner's double-height sports hall, wider at the
 * upper level. Two-outline model: each floor keeps its own outline and walls of the room; the room's CONTENT (tribunes,
 * court markings, objects, lighting circuits) lives on its home floor and every read of the other floor attaches it
 * (ids "<home floor>:<id>", marked `shared`) - the server routes an edit of it back home. Cameras and devices are shared
 * by an explicit member list (security review B1). Pure functions, no DOM: the chip, the hint, the room under a point,
 * the claim of a new item, the deletions a save lists, the 3D volume from the two outlines.
 */
import { bidi } from '../i18n/bidi';
import { effectiveScale, isCurved, MAX_TRIBUNE_ROWS, pointOnWall, type GeometryDoc, type GeomObject, type Pt } from './geometry';

/** The marker of an attached item (never stored on this floor). A read-only item is a piece of a wall that crosses the
 * room's outline: it belongs to the rest of the home floor. */
export interface SharedItemMark {
  zone_id: string;
  home_floor_id: string;
  readonly?: boolean;
}

/** One room this floor shares, as the document describes it: "mirror" - another floor's room shown here; "home" - a room
 * of this floor shown on other floors (the chip and the 3D volume only). */
export interface SharedSpaceEntry {
  zone_id: string;
  zone_name: string;
  home_floor_id: string;
  home_floor_name: string;
  home_floor_level: number | null;
  role: 'mirror' | 'home';
  /** The room's outline in THIS plan's coordinates (normalized). */
  polygon: { x: number; y: number }[];
  placement: Record<string, unknown>;
  /** The other floor's outline brought onto this plan: on the court's floor the wider upper level ("מפלס עליון"), on the
   * upper floor the court ("מפלס תחתון"). [] when the other floor has no outline of its own. */
  other_polygon?: { x: number; y: number }[];
  other_label?: string;
  other_floor_level?: number | null;
  /** The ceiling of the upper floor's main level (the top of the volume). */
  upper_ceiling_m?: number | null;
  /** The two outlines agree (the lower one lies inside the upper one); false = "ודא את יישור הקומות". */
  aligned?: boolean;
  /** mirror, draft reads: the home draft's revision the attach was read at (a save echoes it; the server answers 409 when
   * the home draft moved and something differs). */
  home_revision?: number | null;
  /** The other floor's datum above this one (metres, negative downwards). */
  datum_m: number | null;
  /** The level the room's surface is on, as this document names it. */
  level_id: string;
  /** On the court's floor: the room's own walls rise this high (up to the upper floor's level). */
  volume_height_m: number | null;
  /** The ids (in this document) of the room's own walls. */
  wall_ids: string[];
  /** "רצפה בקומה -1": the small chip on both maps (owner decision 2). */
  label: string;
  other_floor_id?: string;
  other_floor_name?: string;
}

/** What the server names a home floor the reader may not read (services/shared_spaces.OTHER_FLOOR): no jump to it. */
export const OTHER_FLOOR = 'קומה אחרת';

/** The `shared` mark of a zone in the map bundle (api/types SpatialZone.shared). */
export interface SharedZoneMark {
  role: 'mirror' | 'home';
  zone_id: string;
  home_floor_id: string;
  home_floor_name: string;
  home_floor_level: number | null;
  label: string;
  floors?: { floor_id: string; name: string; level: number }[];
}

/** The `shared` mark of an anchor in the map bundle: an anchor of the home floor shown here, with its real id. */
export interface SharedAnchorMark {
  zone_id: string;
  home_floor_id: string;
  home_floor_name: string;
  label: string;
}

export const isShared = (item: unknown): boolean => !!item && typeof item === 'object' && typeof (item as { shared?: unknown }).shared === 'object' && (item as { shared?: unknown }).shared !== null;
export const isReadonlyShared = (item: unknown): boolean => isShared(item) && (item as { shared: SharedItemMark }).shared.readonly === true;

/** The chip text of a shared room ("רצפה בקומה -1"), bidi-safe; null for a room that is not shared. */
export function sharedChip(mark: { label?: string | null } | null | undefined): string | null {
  return mark && mark.label ? bidi(mark.label) : null;
}

function inside(p: Pt, poly: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p[1] !== b.y > p[1] && p[0] < ((b.x - a.x) * (p[1] - a.y)) / (b.y - a.y || 1e-300) + a.x) hit = !hit;
  }
  return hit;
}

/** A bundle's zones as the canvas draws them: the label position and, for a room shown on two floors, its chip. */
export function zonesWithChips<Z extends { label_pos?: string; shared?: SharedZoneMark | null }>(zones: readonly Z[]): (Z & { labelPos?: string; chip: string | null })[] {
  return zones.map((z) => ({ ...z, labelPos: z.label_pos, chip: sharedChip(z.shared) }));
}

/** The shared room (either role) whose outline holds the point (normalized), or null. */
export function roomAt(doc: Pick<GeometryDoc, 'shared_spaces'> | null | undefined, p: Pt, role?: 'mirror' | 'home'): SharedSpaceEntry | null {
  for (const e of doc?.shared_spaces ?? []) if ((!role || e.role === role) && e.polygon.length >= 3 && inside(p, e.polygon)) return e;
  return null;
}

/** The entry of a shared item of this document. */
export function entryOf(doc: Pick<GeometryDoc, 'shared_spaces'> | null | undefined, mark: SharedItemMark | undefined): SharedSpaceEntry | null {
  if (!mark) return null;
  return (doc?.shared_spaces ?? []).find((e) => e.role === 'mirror' && e.zone_id === mark.zone_id && e.home_floor_id === mark.home_floor_id) ?? null;
}

/** "חלל משותף · השינוי יופיע גם בקומה -1" - the editor's hint on a selected item of a shared room (on either floor).
 * Empty when the item is not in one. */
export function sharedHint(doc: Pick<GeometryDoc, 'shared_spaces'> | null | undefined, item: { shared?: SharedItemMark } | null | undefined, at?: Pt | null): string {
  if (!item && !at) return '';
  const e = item?.shared ? entryOf(doc, item.shared) : at ? roomAt(doc, at, 'home') : null;
  if (!e) return '';
  if (item?.shared?.readonly) return `חלק מ${bidi(e.home_floor_name)} · ערוך אותו שם`;
  const other = e.role === 'mirror' ? e.home_floor_name : e.other_floor_name ?? '';
  return other ? `חלל משותף · השינוי יופיע גם ב${bidi(other)}` : 'חלל משותף';
}

/** Re-review N3 on the home floor: the shared room whose UPPER outline (brought onto this plan) holds the item while its
 * home outline does not - the part under the upper level, where the floor's own items stay its own unless marked
 * "חלק מהחלל המשותף" (`shared_space_id`). Null elsewhere, for attached items and for items without a position. */
export function overhangZone(doc: Pick<GeometryDoc, 'shared_spaces'> | null | undefined, item: { position?: unknown; shared?: unknown } | null | undefined): string | null {
  const pos = item?.position;
  if (!item || item.shared || !Array.isArray(pos) || pos.length !== 2) return null;
  const p: Pt = [Number(pos[0]), Number(pos[1])];
  for (const e of doc?.shared_spaces ?? []) {
    const other = e.other_polygon ?? [];
    if (e.role === 'home' && other.length >= 3 && inside(p, other) && !(e.polygon.length >= 3 && inside(p, e.polygon))) return e.zone_id;
  }
  return null;
}

/** An item of the document by id (walls, openings, objects, labels, connectors, circuits, groups), or null. */
export function findGeomItem(doc: GeometryDoc, id: string): { id: string; shared?: SharedItemMark; [k: string]: unknown } | null {
  for (const coll of COLLS) {
    const hit = listOf(doc as unknown as Colls, coll).find((x) => x.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Every item id of the document (the editor's selection check). */
export function geomIds(doc: GeometryDoc): Set<string> {
  return new Set(COLLS.flatMap((coll) => listOf(doc as unknown as Colls, coll).map((x) => x.id)));
}

/** A representative point of an item (its position, else its first polyline point), normalized; null when none. */
export function geomItemPoint(item: { [k: string]: unknown }): Pt | null {
  const pos = item.position;
  if (Array.isArray(pos) && pos.length === 2) return [Number(pos[0]), Number(pos[1])];
  const pl = item.polyline;
  if (Array.isArray(pl) && pl.length && Array.isArray(pl[0])) return [Number(pl[0][0]), Number(pl[0][1])];
  return null;
}

type Loose = { id: string; shared?: SharedItemMark; [k: string]: unknown };
type Colls = Record<string, Loose[]>;
const COLLS = ['walls', 'openings', 'objects', 'labels', 'connectors', 'circuits', 'groups'] as const;
/** The room's content: what is shared between its floors (walls and openings stay each floor's own). */
const CONTENT = ['objects', 'labels', 'connectors', 'circuits', 'groups'] as const;
const listOf = (d: Colls, coll: string): Loose[] => (Array.isArray(d[coll]) ? d[coll] : []);
const allIn = (pts: unknown, e: SharedSpaceEntry): boolean =>
  Array.isArray(pts) && pts.length > 0 && pts.every((p) => Array.isArray(p) && inside([Number(p[0]), Number(p[1])], e.polygon));

/** Every edit of the editor's document passes here (StudioController.commit, CR-009): the read-only pieces of a shared
 * room stay exactly as they were, and a new piece of CONTENT drawn inside a room another floor owns - an object (a
 * tribune row, a bench), a label, a same-floor connector, a circuit or group of the room's objects - is claimed for that
 * floor (namespaced id, the marker, the room's level), so the server stores it there and it shows on both floors.
 * Walls and openings are never claimed: each floor keeps its own outline and walls of the room (two-outline model).
 * `claimed` maps each old id to its new one. A document without shared rooms passes untouched. */
export function guardShared(prev: GeometryDoc, next: GeometryDoc): { doc: GeometryDoc; claimed: Map<string, string> } {
  const claimed = new Map<string, string>();
  if (!prev.shared_spaces?.length && !next.shared_spaces?.length) return { doc: next, claimed };
  const was = prev as unknown as Colls;
  const out = { ...next } as unknown as Colls;
  for (const coll of CONTENT) {
    const kept = listOf(was, coll).filter((x) => isReadonlyShared(x));
    if (!kept.length) continue;
    const now = new Map(listOf(out, coll).filter((x) => isReadonlyShared(x)).map((x) => [x.id, JSON.stringify(x)]));
    if (kept.length === now.size && kept.every((x) => now.get(x.id) === JSON.stringify(x))) continue;
    out[coll] = [...listOf(out, coll).filter((x) => !isReadonlyShared(x)), ...kept];
  }
  const mirrors = (next.shared_spaces ?? []).filter((e) => e.role === 'mirror' && e.polygon.length >= 3);
  if (!mirrors.length) return { doc: out as unknown as GeometryDoc, claimed };
  const before = new Set(COLLS.flatMap((coll) => listOf(was, coll).map((x) => x.id)));
  const fresh = (x: Loose) => !before.has(x.id) && !x.shared;
  const roomOf = (pts: unknown) => mirrors.find((e) => allIn(pts, e)) ?? null;
  const entry = (mark: SharedItemMark | undefined) => (mark ? mirrors.find((e) => e.zone_id === mark.zone_id && e.home_floor_id === mark.home_floor_id) ?? null : null);
  const claim = (x: Loose, e: SharedSpaceEntry): Loose => {
    const id = `${e.home_floor_id}:${x.id}`;
    claimed.set(x.id, id);
    return { ...x, id, shared: { zone_id: e.zone_id, home_floor_id: e.home_floor_id }, ...('level_id' in x ? { level_id: e.level_id } : {}) };
  };
  for (const coll of ['objects', 'labels']) {
    out[coll] = listOf(out, coll).map((o) => {
      const e = fresh(o) ? roomOf([o.position]) : null;
      return e ? claim(o, e) : o;
    });
  }
  out.connectors = listOf(out, 'connectors').map((c) => {
    const derived = c.source === 'auto' && String(c.id).startsWith('cx-');
    const crossFloor = Array.isArray(c.floor_ids) && c.floor_ids.length > 0;
    const e = fresh(c) && !derived && !crossFloor ? roomOf(c.polyline) : null;
    return e ? claim(c, e) : c;
  });
  const objects = new Map(listOf(out, 'objects').map((o) => [o.id, o]));
  for (const coll of ['circuits', 'groups']) {
    out[coll] = listOf(out, coll).map((k) => {
      const raw = Array.isArray(k.member_ids) ? (k.member_ids as unknown[]).map(String) : [];
      const members = raw.map((m) => claimed.get(m) ?? m);
      const renamed = members.some((m, i) => m !== raw[i]) ? { ...k, member_ids: members } : k;
      if (!fresh(k) || !members.length) return renamed;
      const marks = members.map((m) => objects.get(m)?.shared);
      const e = marks.every((s) => s && !s.readonly) ? entry(marks[0]) : null;
      return e && marks.every((s) => s!.zone_id === e.zone_id) ? claim(renamed, e) : renamed;
    });
  }
  if (claimed.size) out.objects = listOf(out, 'objects').map((o) => (o.group_id && claimed.has(String(o.group_id)) ? { ...o, group_id: claimed.get(String(o.group_id)) } : o));
  return { doc: out as unknown as GeometryDoc, claimed };
}

/** The shared items a save deletes (security review M1: the server deletes only what the client lists): those of
 * `base` (the document the edits started from) that `doc` no longer has. */
export function sharedDeleted(base: GeometryDoc | null, doc: GeometryDoc): string[] {
  if (!base?.shared_spaces?.length) return [];
  const now = new Set(CONTENT.flatMap((coll) => listOf(doc as unknown as Colls, coll).map((x) => x.id)));
  return CONTENT.flatMap((coll) => listOf(base as unknown as Colls, coll).filter((x) => x.shared && !x.shared.readonly && !now.has(x.id)).map((x) => x.id));
}

/** 3D volume of a shared room from its two outlines (owner 2026-09-29: the hall is wider upstairs), in this plan's
 * normalized coordinates: the lower outline stands from its floor up to the upper floor's level, the upper outline from
 * there to the upper ceiling. Nothing horizontal is generated inside the room (owner 2026-09-30: the gap between the
 * outlines is the tribune's footprint, open to the hall - no slab ring). `lowerWalls` / `upperWalls`: whether this view
 * must generate that outline's walls (the floor's own walls already stand along its own outline). */
export interface SharedVolume {
  zoneId: string;
  /** The level (as this document names it) of the room's surface. */
  levelId: string;
  lower: { x: number; y: number }[];
  upper: { x: number; y: number }[];
  lowerElev: number;
  upperElev: number;
  topElev: number;
  lowerWalls: boolean;
  upperWalls: boolean;
}
export function sharedVolumes(doc: Pick<GeometryDoc, 'shared_spaces'>): SharedVolume[] {
  const out: SharedVolume[] = [];
  for (const e of doc.shared_spaces ?? []) {
    const other = e.other_polygon ?? [];
    if (other.length < 3 || e.polygon.length < 3 || e.datum_m === null || e.datum_m === undefined || e.datum_m === 0) continue;
    const ceiling = e.upper_ceiling_m ?? 2.8;
    if (e.datum_m < 0) out.push({ zoneId: e.zone_id, levelId: e.level_id, lower: other, upper: e.polygon, lowerElev: e.datum_m, upperElev: 0, topElev: ceiling, lowerWalls: true, upperWalls: false });
    else out.push({ zoneId: e.zone_id, levelId: e.level_id, lower: e.polygon, upper: other, lowerElev: 0, upperElev: e.datum_m, topElev: e.datum_m + ceiling, lowerWalls: false, upperWalls: true });
  }
  return out;
}
// ---------------------------------------------------------------- the tribune through the upper floor's level
//
// Owner 2026-09-30: ONE tribune spans the hall's height - it rises from the court (the lower floor) past the upper
// floor's level to rows above it; from the upper floor a door in its outline opens straight onto the tribune's middle,
// from the court one walks onto the parquet. A stepped object of a shared space therefore has a bottom (its level + z)
// and a top (bottom + its height, possibly above the upper level); its rows share the rise to the upper level evenly so
// that one row - the ENTRY ROW - tops out exactly at the upper floor's level, and the same step continues above it.

/** The elevation, in this document's metres, of the upper floor's level that a stepped object of a shared space passes
 * through - null when the object is not in a shared space standing on the LOWER floor. On the upper floor's view the
 * object is the attached content of the room (`shared`), and the upper level is this floor's own default level; on the
 * court's floor it is its own content (inside the home outline, or explicitly the room's under the upper level). */
export function sharedUpperLevel(doc: Pick<GeometryDoc, 'shared_spaces' | 'levels'>, o: Pick<GeomObject, 'position' | 'shared' | 'shared_space_id'>): number | null {
  const base = (doc.levels ?? []).find((l) => l.is_default && !l.shared)?.elevation_m ?? 0;
  for (const e of doc.shared_spaces ?? []) {
    const datum = e.datum_m;
    if (datum === null || datum === undefined || Math.abs(datum) < 1e-6) continue;
    if (e.role === 'mirror') {
      if (datum < 0 && o.shared && o.shared.zone_id === e.zone_id && o.shared.home_floor_id === e.home_floor_id) return base;
    } else if (datum > 0) {
      const inHome = e.polygon.length >= 3 && inside(o.position, e.polygon);
      const other = e.other_polygon ?? [];
      const flagged = o.shared_space_id === e.zone_id && other.length >= 3 && inside(o.position, other);
      if (inHome || flagged) return base + datum;
    }
  }
  return null;
}

export interface TribuneLayout {
  rows: number;
  /** The rise of each row (metres). */
  step: number;
  /** The index of the row whose top is the upper floor's level (rows before it are below it, after it above), or null. */
  entry: number | null;
  top: number;
}

/** The rows of a stepped object from its bottom, height and nominal rows / step (params.rows, params.step_height_m),
 * given the upper floor's level it passes through (null: the tribune as before - `rows` rows of height / rows). With an
 * upper level inside its height: k rows share the rise to it evenly (k = the nominal step's count, at least 1), the
 * same step continues to the top, and row k-1 is the entry row. */
export function tribuneLayout(bottom: number, height: number, rowsParam: unknown, stepParam: unknown, upper: number | null): TribuneLayout {
  const nominalRows = typeof rowsParam === 'number' && Number.isInteger(rowsParam) && rowsParam >= 2 ? Math.min(rowsParam, MAX_TRIBUNE_ROWS) : 4;
  const nominal = typeof stepParam === 'number' && Number.isFinite(stepParam) && stepParam > 0 ? stepParam : height / nominalRows;
  const rise = upper === null ? NaN : upper - bottom;
  if (!(rise > 0.05) || rise > height + nominal / 2 || !(nominal > 0)) return { rows: nominalRows, step: nominal, entry: null, top: bottom + Math.min(height, nominal * nominalRows) };
  const k = Math.max(1, Math.round(rise / nominal));
  const step = rise / k;
  const rows = Math.min(MAX_TRIBUNE_ROWS, Math.max(k, Math.round(height / step)));
  return { rows, step, entry: k - 1, top: bottom + rows * step };
}

export interface TribuneEntrance {
  objectId: string;
  openingId: string;
  /** The door's centre, normalized plan coordinates. */
  point: Pt;
  /** The door's position across the tribune's width (metres from its centre, the tribune's own x axis). */
  along: number;
  /** The upper floor's level: the entry row's top. */
  elevation: number;
}

const isStepped = (o: GeomObject): boolean => o.item_id.startsWith('tribune.') || typeof o.params?.rows === 'number';

/** The doors of this floor's OWN walls on the upper level that open onto a shared tribune (their centre within the
 * tribune's footprint, widened by the wall's thickness and half a metre): the entrances into its entry row. Only the upper
 * floor's view has them - the court's floor does not draw the upper floor's walls. */
export function tribuneEntrances(doc: GeometryDoc): TribuneEntrance[] {
  const out: TribuneEntrance[] = [];
  const W = doc.dimensions.width_px || 1000;
  const H = doc.dimensions.height_px || 1000;
  const { scale } = effectiveScale(doc);
  const levels = new Map((doc.levels ?? []).map((l) => [l.id, l]));
  const walls = new Map(doc.walls.filter((w) => !w.shared).map((w) => [w.id, w]));
  // only a tribune that actually reaches the upper level has an entry row to open onto
  const tribunes = doc.objects.filter((o) => isStepped(o) && o.shared).map((o) => ({ o, upper: sharedUpperLevel(doc, o) }))
    .filter((t) => t.upper !== null && tribuneLayout((levels.get(t.o.level_id)?.elevation_m ?? 0) + (t.o.z_m || 0), t.o.size.h_m, t.o.params?.rows, t.o.params?.step_height_m, t.upper).entry !== null);
  if (!tribunes.length) return out;
  for (const op of doc.openings) {
    if (op.kind !== 'door' && op.kind !== 'passage') continue;
    const w = walls.get(op.wall_id);
    if (!w || w.polyline.length < 2) continue;
    const pts = w.polyline.map(([x, y]): Pt => [x * W, y * H]);
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    let s = Math.max(0, Math.min(1, op.t)) * lens.reduce((a, b) => a + b, 0);
    let c: Pt = pts[0];
    if (isCurved(w)) { // on a curved wall the door's centre lies on the arc
      const q = pointOnWall(w, op.t, W, H);
      c = [q[0] * W, q[1] * H];
      s = Number.POSITIVE_INFINITY;
    }
    for (let i = 0; i < lens.length && Number.isFinite(s); i++) {
      if (s <= lens[i] || i === lens.length - 1) {
        const f = lens[i] > 0 ? Math.min(1, s / lens[i]) : 0;
        c = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
        break;
      }
      s -= lens[i];
    }
    const elev = levels.get(w.level_id)?.elevation_m ?? 0;
    for (const { o, upper } of tribunes) {
      if (Math.abs(elev + (w.base_z_m || 0) - (upper as number)) > 0.3) continue;
      const r = (o.rotation_deg * Math.PI) / 180;
      const dx = (c[0] - o.position[0] * W) * scale;
      const dz = (c[1] - o.position[1] * H) * scale;
      const lx = dx * Math.cos(r) + dz * Math.sin(r);
      const lz = -dx * Math.sin(r) + dz * Math.cos(r);
      const margin = (w.thickness_m || 0.2) + 0.5;
      if (Math.abs(lx) <= o.size.w_m / 2 + margin && Math.abs(lz) <= o.size.d_m / 2 + margin) {
        out.push({ objectId: o.id, openingId: op.id, point: [c[0] / W, c[1] / H], along: Math.max(-o.size.w_m / 2, Math.min(o.size.w_m / 2, lx)), elevation: upper as number });
      }
    }
  }
  return out;
}

/** 3D: the rooms whose volume passes through this floor's plates (a mirror room: the plate must be open above it),
 * as [x0, z0, x1, z1] boxes in metres. */
export function plateHoles(doc: Pick<GeometryDoc, 'shared_spaces'>, width: number, height: number, scale: number): [number, number, number, number][] {
  return (doc.shared_spaces ?? [])
    .filter((e) => e.role === 'mirror' && (e.datum_m ?? 0) < 0 && e.polygon.length >= 3)
    .map((e) => {
      const xs = e.polygon.map((p) => p.x * width * scale);
      const zs = e.polygon.map((p) => p.y * height * scale);
      return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as [number, number, number, number];
    });
}

/** 3D: wall id -> the height the room's volume gives it (from the room's surface), for walls of a shared room. */
export function volumeHeights(doc: Pick<GeometryDoc, 'shared_spaces'>): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of doc.shared_spaces ?? []) {
    if (!e.volume_height_m) continue;
    for (const id of e.wall_ids ?? []) out.set(id, Math.max(out.get(id) ?? 0, e.volume_height_m));
  }
  return out;
}
