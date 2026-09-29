/**
 * Shared space (CR-009, T093): one room that belongs to two floors - the owner's double-height sports hall. The room's
 * home floor owns everything in it; every read of the other floor attaches it (walls, openings, objects, labels,
 * connectors and circuits in this plan's coordinates, ids "<home floor>:<id>", each marked `shared`; its zone and
 * anchors in the map bundle) and the server routes an edit of those items back to the home floor's draft. Pure
 * functions, no DOM: the chip, the editor's hint, the room under a point, the namespacing of a new item, the 3D cut.
 */
import { bidi } from '../i18n/bidi';
import type { GeometryDoc, Pt } from './geometry';

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
  /** mirror, draft reads: the home draft's revision the attach was read at (a save echoes it; the server answers 409 when
   * the home draft moved and something differs). */
  home_revision?: number | null;
  home_version_id?: string | null;
  home_doc_hash?: string | null;
  /** The other floor's datum above this one (metres, negative downwards). */
  datum_m: number | null;
  /** The level the room's surface is on, as this document names it. */
  level_id: string;
  /** The room's walls rise this high from its surface (the home floor's height + the upper floor's ceiling). */
  volume_height_m: number | null;
  /** The ids (in this document) of the room's own walls. */
  wall_ids: string[];
  /** "רצפה בקומה -1": the small chip on both maps (owner decision 2). */
  label: string;
  other_floor_id?: string;
  other_floor_name?: string;
}

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

/** A new item drawn inside a shared room on the other floor belongs to the room: its id is namespaced by the home floor
 * and it carries the marker, so the server stores it there (and it shows on both floors); its level becomes the room's.
 * Anything else is returned unchanged. */
export function claimForRoom<T extends { id: string; level_id?: string; shared?: SharedItemMark }>(doc: Pick<GeometryDoc, 'shared_spaces'> | null | undefined, item: T, at: Pt): T {
  if (item.shared) return item;
  const e = roomAt(doc, at, 'mirror');
  if (!e) return item;
  const out = { ...item, id: `${e.home_floor_id}:${item.id}`, shared: { zone_id: e.zone_id, home_floor_id: e.home_floor_id } };
  if ('level_id' in item) (out as { level_id?: string }).level_id = e.level_id;
  return out;
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
const listOf = (d: Colls, coll: string): Loose[] => (Array.isArray(d[coll]) ? d[coll] : []);
const allIn = (pts: unknown, e: SharedSpaceEntry): boolean =>
  Array.isArray(pts) && pts.length > 0 && pts.every((p) => Array.isArray(p) && inside([Number(p[0]), Number(p[1])], e.polygon));

/** Every edit of the editor's document passes here (StudioController.commit, CR-009): the read-only pieces of a shared
 * room (a wall of the home floor crossing the room's outline, the openings on it) stay exactly as they were, and a new
 * item drawn inside a room another floor owns - a wall, an object, a label, a connector, an opening on one of the room's
 * walls, a circuit or group of the room's items - is claimed for that floor (namespaced id, the marker, the room's
 * level), so the server stores it there and it shows on both floors. `claimed` maps each old id to its new one. A new
 * opening on a read-only piece is dropped. A document without shared rooms passes untouched. */
export function guardShared(prev: GeometryDoc, next: GeometryDoc): { doc: GeometryDoc; claimed: Map<string, string> } {
  const claimed = new Map<string, string>();
  if (!prev.shared_spaces?.length && !next.shared_spaces?.length) return { doc: next, claimed };
  const was = prev as unknown as Colls;
  const out = { ...next } as unknown as Colls;
  // 1. read-only pieces: as they were
  for (const coll of ['walls', 'openings', 'connectors']) {
    const kept = listOf(was, coll).filter((x) => isReadonlyShared(x));
    if (!kept.length) continue;
    const now = new Map(listOf(out, coll).filter((x) => isReadonlyShared(x)).map((x) => [x.id, JSON.stringify(x)]));
    if (kept.length === now.size && kept.every((x) => now.get(x.id) === JSON.stringify(x))) continue;
    out[coll] = [...listOf(out, coll).filter((x) => !isReadonlyShared(x)), ...kept];
  }
  const mirrors = (next.shared_spaces ?? []).filter((e) => e.role === 'mirror' && e.polygon.length >= 3);
  if (!mirrors.length) return { doc: out as unknown as GeometryDoc, claimed };
  // 2. new items inside a room another floor owns
  const before = new Set(COLLS.flatMap((coll) => listOf(was, coll).map((x) => x.id)));
  const fresh = (x: Loose) => !before.has(x.id) && !x.shared;
  const roomOf = (pts: unknown) => mirrors.find((e) => allIn(pts, e)) ?? null;
  const entry = (mark: SharedItemMark | undefined) => (mark ? mirrors.find((e) => e.zone_id === mark.zone_id && e.home_floor_id === mark.home_floor_id) ?? null : null);
  const claim = (x: Loose, e: SharedSpaceEntry, extra: Record<string, unknown> = {}): Loose => {
    const id = `${e.home_floor_id}:${x.id}`;
    claimed.set(x.id, id);
    return { ...x, ...extra, id, shared: { zone_id: e.zone_id, home_floor_id: e.home_floor_id }, ...('level_id' in x ? { level_id: e.level_id } : {}) };
  };
  out.walls = listOf(out, 'walls').map((w) => {
    const e = fresh(w) ? roomOf(w.polyline) : null;
    return e ? claim(w, e) : w;
  });
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
  const walls = new Map(listOf(out, 'walls').map((w) => [w.id, w]));
  out.openings = listOf(out, 'openings').flatMap((o) => {
    const wallId = claimed.get(String(o.wall_id)) ?? String(o.wall_id);
    const host = walls.get(wallId);
    if (!fresh(o) || !host?.shared) return [wallId === o.wall_id ? o : { ...o, wall_id: wallId }];
    if (host.shared.readonly) return []; // a read-only piece takes no new opening: edit it on its own floor
    const e = entry(host.shared);
    return e ? [claim(o, e, { wall_id: wallId })] : [o];
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
/** The doc without the rooms another floor owns (a view that must draw each room once, e.g. several floors stacked). */
export function withoutMirrors(doc: GeometryDoc): GeometryDoc {
  if (!doc.shared_spaces?.some((e) => e.role === 'mirror')) return doc;
  const keep = <T extends { shared?: SharedItemMark }>(xs: T[] | undefined): T[] => (xs ?? []).filter((x) => !x.shared);
  return { ...doc, walls: keep(doc.walls), openings: keep(doc.openings), objects: keep(doc.objects), labels: keep(doc.labels), connectors: keep(doc.connectors), circuits: keep(doc.circuits),
    groups: keep(doc.groups), levels: keep(doc.levels) };
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
