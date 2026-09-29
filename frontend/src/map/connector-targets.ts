/**
 * The "מחבר אל" picker of a connector (T085, owner 2026-09-29: "stairs connect only between levels"): one list with
 * this floor's other levels and every level of every other floor of the building ("קומה 1 · גלריה"), so a link to
 * another floor chooses the level it reaches there too. Pure: no DOM, runs in node (tests/unit-stairs.spec.ts).
 */
import type { GeomConnector, GeometryDoc, GeomLevel, Pt } from './geometry';

/** One floor of GET plan-versions/{id}/geometry/link-targets. */
export interface LinkTargetFloor {
  floor_id: string;
  name: string;
  level: number;
  version_id: string | null;
  levels: { id: string; name: string; elevation_m: number | null; is_default: boolean }[];
  same_frame: boolean;
}

export interface TargetOption {
  /** `here:<level>` or `<floor id>:<level>` - the select's value. */
  value: string;
  label: string;
  /** null = a level of this floor. */
  floorId: string | null;
  levelId: string;
}

export interface TargetGroups {
  here: TargetOption[];
  floors: { floorId: string; name: string; sameFrame: boolean; options: TargetOption[] }[];
}

const SEP = ':';

export function targetValue(floorId: string | null, levelId: string): string {
  return `${floorId ?? 'here'}${SEP}${levelId}`;
}

export function parseTarget(value: string): { floorId: string | null; levelId: string } | null {
  const i = value.indexOf(SEP);
  if (i <= 0 || i === value.length - 1) return null;
  const f = value.slice(0, i);
  return { floorId: f === 'here' ? null : f, levelId: value.slice(i + 1) };
}

/** The other floor of a connector linked to one (floor_ids set), or null. */
export function otherFloorOf(doc: Pick<GeometryDoc, 'floor_id'>, c: Pick<GeomConnector, 'floor_ids' | 'far'>): string | null {
  if (!c.floor_ids?.length) return null;
  return c.far?.floor_id ?? c.floor_ids.find((f) => f !== doc.floor_id) ?? null;
}

/** The picker's options: this floor's levels other than the one the connector starts on, then each other floor that
 * has a plan with all its levels ("קומה 1 · גלריה"). A floor without a plan cannot receive the twin: it is left out. */
export function connectorTargets(doc: Pick<GeometryDoc, 'levels' | 'floor_id'>, c: Pick<GeomConnector, 'level_from'>, floors: readonly LinkTargetFloor[]): TargetGroups {
  return {
    here: doc.levels.filter((l) => l.id !== c.level_from).map((l) => ({ value: targetValue(null, l.id), label: l.name, floorId: null, levelId: l.id })),
    floors: floors
      .filter((f) => f.floor_id !== doc.floor_id && f.version_id && f.levels.length)
      .map((f) => ({ floorId: f.floor_id, name: f.name, sameFrame: f.same_frame, options: f.levels.map((l) => ({ value: targetValue(f.floor_id, l.id), label: `${f.name} · ${l.name}`, floorId: f.floor_id, levelId: l.id })) })),
  };
}

/** The picker's current value: the other floor and the level there, a level of this floor, or '' (not chosen yet). */
export function currentTarget(doc: Pick<GeometryDoc, 'floor_id'>, c: Pick<GeomConnector, 'floor_ids' | 'far' | 'level_to'>): string {
  const other = otherFloorOf(doc, c);
  if (other) return c.level_to ? targetValue(other, c.level_to) : '';
  return c.level_to ? targetValue(null, c.level_to) : '';
}

// ---------------------------------------------------------------- the links between floors (the building page)

/** The published structure of one floor as the building page holds it. */
export interface FloorLinkDoc {
  floorId: string;
  connectors: GeomConnector[];
  levels: GeomLevel[];
}
export interface FloorLinkEnd {
  floorId: string;
  /** The middle of the connector on that floor's plan, normalized. */
  at: Pt;
  /** "קומה 0 · מפלס ראשי". */
  label: string;
}
export interface FloorLink {
  id: string;
  kindLabel: string;
  a: FloorLinkEnd;
  /** The twin on the other floor; null when that floor's published structure does not hold it (yet). */
  b: FloorLinkEnd | null;
  /** The other floor and level as `a` names them (its far record), for a link whose twin is not published. */
  farLabel: string;
}

const KIND_HE: Record<string, string> = { stairs: 'מדרגות', ramp: 'רמפה', tribune: 'טריבונה', elevator: 'מעלית', ladder: 'סולם' };

const middle = (poly: Pt[]): Pt => {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

/** Every connector linked between two floors, once, with its position on each floor that published it (T085): the
 * building page draws a line between the two. The first end is the floor listed first in `floors`. */
export function floorLinks(docs: readonly FloorLinkDoc[], floors: readonly { id: string; name: string }[]): FloorLink[] {
  const names = new Map(floors.map((f) => [f.id, f.name]));
  const rank = new Map(floors.map((f, i) => [f.id, i]));
  const ends = new Map<string, { floorId: string; c: GeomConnector; levels: GeomLevel[] }[]>();
  for (const d of docs) {
    for (const c of d.connectors) {
      if (!c.floor_ids || c.floor_ids.length !== 2 || !c.floor_ids.includes(d.floorId) || c.polyline.length < 2) continue;
      const list = ends.get(c.id) ?? [];
      if (!list.some((e) => e.floorId === d.floorId)) list.push({ floorId: d.floorId, c, levels: d.levels });
      ends.set(c.id, list);
    }
  }
  const end = (e: { floorId: string; c: GeomConnector; levels: GeomLevel[] }): FloorLinkEnd => {
    const level = e.levels.find((l) => l.id === e.c.level_from)?.name;
    const floor = names.get(e.floorId) ?? '';
    return { floorId: e.floorId, at: middle(e.c.polyline), label: level ? `${floor} · ${level}` : floor };
  };
  return [...ends.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, list]) => {
      const sorted = [...list].sort((x, y) => (rank.get(x.floorId) ?? 0) - (rank.get(y.floorId) ?? 0));
      const first = sorted[0];
      const far = first.c.far;
      return { id, kindLabel: KIND_HE[first.c.kind] ?? first.c.kind, a: end(first), b: sorted[1] ? end(sorted[1]) : null,
        farLabel: far?.floor_name ? (far.level_name ? `${far.floor_name} · ${far.level_name}` : far.floor_name) : 'קומה אחרת' };
    });
}
