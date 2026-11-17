/**
 * Spatial zones (design M13): named rooms and areas as normalized polygons on a floor. A data layer next
 * to the plan image; candidates come from local room detection on the plan and are saved only once the
 * editor accepts them.
 */
import { api, del, get, patch, path, post, put, query } from './client';
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

interface RoomCandidate {
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

export const listZones = (floorId: string) => get<{ zones: SpatialZone[] }>(path`floors/${floorId}/zones`);
export const createZone = (floorId: string, body: { name: string; kind?: ZoneKind; polygon: ZonePoint[]; color?: string; searchable?: boolean }) =>
  post<SpatialZone>(path`floors/${floorId}/zones`, body);
/** `signal`: an abort (a timeout) for a caller that must not wait forever - the editor's zone saves (review of T085, R4).
 * `fromFloorId` (CR-009): a shared room edited on another floor's map - its polygon is in that plan's coordinates. */
export const updateZone = (id: string, body: { revision: number; name?: string; kind?: ZoneKind; polygon?: ZonePoint[]; color?: string; searchable?: boolean; label_pos?: string; level_id?: string; ceiling_height_m?: number; tags?: string[]; area_id?: string | null }, signal?: AbortSignal, fromFloorId?: string) => {
  const url = path`zones/${id}` + query({ from_floor_id: fromFloorId });
  return signal ? api<SpatialZone>(url, { method: 'PATCH', body: JSON.stringify(body), signal }) : patch<SpatialZone>(url, body);
};

// ---------------------------------------------------------------- the zone's camera (CAMSUGGEST138-295)

/** The camera pin an editor accepted for a zone from the nearest-camera suggestions (null = none). Never set automatically. */
export interface ZoneCameraLink {
  zone_id: string;
  anchor_id: string | null;
  updated_at: string | null;
}
export const getZoneCamera = (zoneId: string) => get<ZoneCameraLink>(path`zones/${zoneId}/suggested-camera`);
export const acceptZoneCamera = (zoneId: string, anchorId: string) => put<ZoneCameraLink>(path`zones/${zoneId}/suggested-camera`, { anchor_id: anchorId });
export const clearZoneCamera = (zoneId: string) => api<ZoneCameraLink>(path`zones/${zoneId}/suggested-camera`, { method: 'DELETE' });

// ---------------------------------------------------------------- shared space (CR-009)

export interface ShareRequest {
  floor_id: string;
  duplicate_zone_id?: string | null;
  rotation_deg?: number;
  auto?: boolean;
}
interface ShareCandidate {
  zone_id: string;
  name: string;
  name_score: number;
  overlap: number | null;
  score: number;
}
interface ShareAnchorFate {
  anchor_id: string;
  floor_id: string;
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  name: string | null;
  /** member: stays where it is anchored and is shown on both floors; drop_duplicate: the other floor's copy of a camera the
   * room already has (removed); kept: anchored elsewhere on the room's floor too - stays, not shared. */
  action: 'member' | 'drop_duplicate' | 'kept';
}
/** What "הפוך לחלל משותף" will do (POST /zones/{id}/share/preview); the apply answers the same plus the ids it wrote. */
export interface SharePreview {
  zone: { id: string; name: string; floor_id: string; floor_name: string; floor_level: number };
  other_floor: { id: string; name: string; level: number; version_id: string; revision: number };
  same_frame: boolean;
  placement: Record<string, unknown>;
  duplicate: { zone_id: string; name: string; polygon: ZonePoint[] } | null;
  candidates: ShareCandidate[];
  /** The other floor's own outline of the room (its duplicate room, kept - the hall may be wider there), or one drawn from
   * the room's when there is none. */
  outline: { zone_id: string | null; kept: boolean; polygon: ZonePoint[] };
  remove: { walls: number; openings: number; objects: number; labels: number; connectors: number; circuits: number; groups: number; zone: number };
  /** The other floor's walls along its outline: they bound the room at that floor and stay. */
  boundary_walls_kept: string[];
  anchors: ShareAnchorFate[];
  members: { resource_type: 'camera' | 'ha_entity'; resource_id: string }[];
  /** The two outlines agree (the lower one inside the upper one); false = "ודא את יישור הקומות". */
  aligned: boolean;
  alignment_warning: string | null;
  attach: { objects: number; labels: number; connectors: number; circuits: number; members: number };
  share_id?: string;
}
export const previewShare = (zoneId: string, body: ShareRequest) => post<SharePreview>(path`zones/${zoneId}/share/preview`, body);
export const shareZone = (zoneId: string, body: ShareRequest) => post<SharePreview>(path`zones/${zoneId}/share`, body);
export const unshareZone = (zoneId: string, floorId: string) => del(path`zones/${zoneId}/share/${floorId}`);
/** Members of a shared room (security review B1): reach follows this list, never where an anchor lies. Adding one needs
 * the share rights on every floor of the room. */
export const addShareMember = (zoneId: string, resourceType: ShareMember['resource_type'], resourceId: string) =>
  post<{ zone_id: string; added: boolean }>(path`zones/${zoneId}/share/members`, { resource_type: resourceType, resource_id: resourceId });
export const removeShareMember = (zoneId: string, resourceType: ShareMember['resource_type'], resourceId: string) =>
  del(path`zones/${zoneId}/share/members/${resourceType}/${resourceId}`);

/** One member of a shared space as the READER may see it (owner 2026-09-30: each member filtered by the reader's own
 * permissions - a camera they may not view is not listed). `floors`: where it is anchored ("קומה אחרת" and no id for a
 * floor the reader may not read - integration review L6). */
export interface ShareMember {
  /** 'wiskey_station' (CR-009 §13): a WisKey station listed by name - not placed on any map, it grants no reach. */
  resource_type: 'camera' | 'ha_entity' | 'wiskey_station';
  resource_id: string;
  kind: 'camera' | 'door' | 'device' | 'station';
  name: string;
  added_at?: string;
  floors: { floor_id: string | null; name: string }[];
}
export interface ShareMembers {
  zone_id: string;
  /** Only the room's floors the reader may read (integration review L6). */
  floors: { floor_id: string; name: string }[];
  members: ShareMember[];
  /** The share rights on every floor of the room: add and remove. Without them the list is read-only. */
  can_manage: boolean;
  /** can_manage only: the anchors of the room's floors that are not members yet. */
  candidates?: ShareMember[];
}
export const listShareMembers = (zoneId: string) => get<ShareMembers>(path`zones/${zoneId}/share/members`);
/** `withUnshare` (CR-009 §14): a shared room, from its HOME floor - ends every share and its members and deletes the room in one
 * server transaction. Without it a shared room answers 409 `zone_shared`. */
export const deleteZone = (id: string, signal?: AbortSignal, withUnshare = false) => {
  const url = path`zones/${id}` + query({ with_unshare: withUnshare || undefined });
  return signal ? api<void>(url, { method: 'DELETE', signal }) : del(url);
};
export const detectZones = (floorId: string, strength: 'light' | 'medium' | 'strong' = 'medium') => post<DetectResult>(path`floors/${floorId}/zones/detect`, { strength });
export const acceptZones = (floorId: string, candidates: { polygon: ZonePoint[]; name?: string; kind?: ZoneKind }[], replaceAuto: boolean) =>
  post<{ zones: SpatialZone[]; created: string[] }>(path`floors/${floorId}/zones/accept`, { candidates, replace_auto: replaceAuto });

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

