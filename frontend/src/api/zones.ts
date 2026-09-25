/**
 * Spatial zones (design M13): named rooms and areas as normalized polygons on a floor. A data layer next
 * to the plan image; candidates come from local room detection on the plan and are saved only once the
 * editor accepts them.
 */
import { del, get, patch, post } from './client';
import type { SpatialZone, ZonePoint } from './types';

export type { SpatialZone, ZonePoint } from './types';

export type ZoneKind = SpatialZone['kind'];

export const ZONE_KINDS: { id: ZoneKind; label: string }[] = [
  { id: 'room', label: 'חדר' },
  { id: 'zone', label: 'אזור' },
  { id: 'corridor', label: 'מסדרון' },
  { id: 'outdoor', label: 'חוץ' },
  { id: 'service', label: 'שירות / טכני' },
];

export const zoneKindLabel = (kind: string) => ZONE_KINDS.find((k) => k.id === kind)?.label ?? kind;

export interface RoomCandidate {
  index: number;
  polygon: ZonePoint[];
  area_ratio: number;
  centroid: ZonePoint;
}

export interface DetectResult {
  rooms: RoomCandidate[];
  width_px: number;
  height_px: number;
  strength: 'light' | 'medium' | 'strong';
  plan_version_id: string;
  existing_auto: number;
}

export const listZones = (floorId: string) => get<{ zones: SpatialZone[] }>(`floors/${floorId}/zones`);
export const createZone = (floorId: string, body: { name: string; kind?: ZoneKind; polygon: ZonePoint[]; color?: string; searchable?: boolean }) =>
  post<SpatialZone>(`floors/${floorId}/zones`, body);
export const updateZone = (id: string, body: { revision: number; name?: string; kind?: ZoneKind; polygon?: ZonePoint[]; color?: string; searchable?: boolean; label_pos?: string; level_id?: string; ceiling_height_m?: number }) =>
  patch<SpatialZone>(`zones/${id}`, body);
export const deleteZone = (id: string) => del(`zones/${id}`);
export const detectZones = (floorId: string, strength: 'light' | 'medium' | 'strong' = 'medium') => post<DetectResult>(`floors/${floorId}/zones/detect`, { strength });
export const acceptZones = (floorId: string, candidates: { polygon: ZonePoint[]; name?: string; kind?: ZoneKind }[], replaceAuto: boolean) =>
  post<{ zones: SpatialZone[]; created: string[] }>(`floors/${floorId}/zones/accept`, { candidates, replace_auto: replaceAuto });

/** Ray-casting point-in-polygon test (normalized coordinates). */
export function pointInPolygon(p: ZonePoint, poly: ZonePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Polygon centroid (area-weighted; falls back to the vertex mean for degenerate rings). */
export function zoneCentroid(poly: ZonePoint[]): ZonePoint {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
