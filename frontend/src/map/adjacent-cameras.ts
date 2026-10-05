/**
 * Suggested adjacent cameras for the map's multi-camera selection (T043, M043): from the cameras already picked, the
 * cameras in the same room, in a room that shares a wall, or within reach on the plan - ranked in that order, closest
 * first, one entry per camera. A suggestion is topology only (rooms and pins of the published plan): it never claims
 * that a person or vehicle moved there, and nothing is picked without the operator's click. Pure: no DOM, runs in node
 * (tests/unit-adjacent-cameras.spec.ts).
 */
import { pointInPolygon, type ZonePoint } from '../api/zones';

export type AdjacentRelation = 'same_zone' | 'adjacent_zone' | 'nearby';

export const ADJACENT_LABEL: Record<AdjacentRelation, string> = { same_zone: 'אותו חדר', adjacent_zone: 'חדר סמוך', nearby: 'בקרבת מקום' };

/** Within this normalized distance (a fifth of the plan) a camera outside every room still counts as "nearby". */
export const NEARBY_RADIUS = 0.2;

export interface AdjacentCamera {
  id: string;
  position: ZonePoint;
}

export interface AdjacentZone {
  id: string;
  name: string;
  polygon: ZonePoint[];
}

export interface AdjacentSuggestion {
  /** The anchor id of the suggested camera. */
  id: string;
  relation: AdjacentRelation;
  /** Normalized plan distance from the closest picked camera. */
  distance: number;
  /** The picked camera it is adjacent to. */
  from: string;
  /** The room the suggested camera sits in (null = outside every room). */
  zoneId: string | null;
  zoneName: string | null;
}

const RANK: Record<AdjacentRelation, number> = { same_zone: 0, adjacent_zone: 1, nearby: 2 };

function area(poly: ZonePoint[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** The smallest room containing the point (a lobby drawn inside a wing wins over the wing), or null. */
export function zoneAt(p: ZonePoint, zones: readonly AdjacentZone[]): AdjacentZone | null {
  let best: { z: AdjacentZone; a: number } | null = null;
  for (const z of zones) {
    if (z.polygon.length < 3 || !pointInPolygon(p, z.polygon)) continue;
    const a = area(z.polygon);
    if (!best || a < best.a) best = { z, a };
  }
  return best?.z ?? null;
}

function segDist(p: ZonePoint, a: ZonePoint, b: ZonePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

/** Two rooms share a wall when a vertex of one lies on or inside the other (within eps, 1 % of the plan). */
export function zonesTouch(pa: ZonePoint[], pb: ZonePoint[], eps = 0.01): boolean {
  for (const [poly, other] of [[pa, pb], [pb, pa]] as const) {
    for (const p of poly) {
      if (pointInPolygon(p, other)) return true;
      for (let i = 0; i < other.length; i++) if (segDist(p, other[i], other[(i + 1) % other.length]) <= eps) return true;
    }
  }
  return false;
}

/**
 * The cameras worth adding next to the picked ones. `picked` are anchor ids; cameras already picked are never
 * suggested. Each camera gets its best relation over every picked camera; ties go to the shorter distance.
 */
export function suggestAdjacent(picked: readonly string[], cameras: readonly AdjacentCamera[], zones: readonly AdjacentZone[], radius = NEARBY_RADIUS): AdjacentSuggestion[] {
  const pickedSet = new Set(picked);
  const chosen = cameras.filter((c) => pickedSet.has(c.id));
  if (!chosen.length) return [];
  const zoneOf = new Map<string, AdjacentZone | null>();
  for (const c of cameras) zoneOf.set(c.id, zoneAt(c.position, zones));
  const best = new Map<string, AdjacentSuggestion>();
  for (const from of chosen) {
    const fz = zoneOf.get(from.id) ?? null;
    for (const c of cameras) {
      if (pickedSet.has(c.id)) continue;
      const cz = zoneOf.get(c.id) ?? null;
      const distance = Math.hypot(c.position.x - from.position.x, c.position.y - from.position.y);
      let relation: AdjacentRelation | null = null;
      if (fz && cz && cz.id === fz.id) relation = 'same_zone';
      else if (fz && cz && zonesTouch(fz.polygon, cz.polygon)) relation = 'adjacent_zone';
      else if (distance <= radius) relation = 'nearby';
      if (!relation) continue;
      const prev = best.get(c.id);
      if (!prev || RANK[relation] < RANK[prev.relation] || (RANK[relation] === RANK[prev.relation] && distance < prev.distance)) {
        best.set(c.id, { id: c.id, relation, distance: Math.round(distance * 1000) / 1000, from: from.id, zoneId: cz?.id ?? null, zoneName: cz?.name ?? null });
      }
    }
  }
  return [...best.values()].sort((a, b) => RANK[a.relation] - RANK[b.relation] || a.distance - b.distance || (a.id < b.id ? -1 : 1));
}

/** The `picks=` route parameter: the picked anchor ids, comma-separated, in pick order (the map restores them on "back"). */
export function serializePicks(ids: readonly string[]): string {
  return ids.join(',');
}

export function parsePicks(value: string | null | undefined, known: ReadonlySet<string>): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const id of value.split(',')) {
    const t = id.trim();
    if (t && known.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}
