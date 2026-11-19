/**
 * Spatial zones (design M13): named rooms and areas as normalized polygons on a floor. A data layer next
 * to the plan image; candidates come from local room detection on the plan and are saved only once the
 * editor accepts them.
 */
import { api, del, get, patch, path, post, put, query } from './client';
import type { SpatialZone, ZonePoint } from './types';
import type * as ZoneWire from './generated/wire-zones';
import { tr } from '../i18n/msg/api-home';

export type { SpatialZone, ZonePoint } from './types';

export type ZoneKind = SpatialZone['kind'];

export const ZONE_KINDS: { id: ZoneKind; label: string }[] = [
  { id: 'room', label: tr('חדר') },
  { id: 'zone', label: tr('אזור') },
  { id: 'corridor', label: tr('מסדרון') },
  { id: 'outdoor', label: tr('חוץ') },
  { id: 'service', label: tr('שירות / טכני') },
];

export const zoneKindLabel = (kind: string) => ZONE_KINDS.find((k) => k.id === kind)?.label ?? kind;

interface RoomCandidate {
  index: number;
  polygon: ZonePoint[];
  area_ratio: number;
  centroid: ZonePoint;
}

/** `POST /floors/{id}/zones/detect` (wire/zones.py `ZoneDetected`, generated); the room candidates (computed, passed through) typed here. */
export type DetectResult = Omit<ZoneWire.ZoneDetected, 'rooms'> & { rooms: RoomCandidate[] };

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
/** What "הפוך לחלל משותף" will do (POST /zones/{id}/share/preview, wire/zones.py `ZoneSharePlan`, generated); the apply answers the
 * same plus the ids it wrote (`ZoneShared`). `anchors[].action` - member: stays where it is anchored and is shown on both floors;
 * drop_duplicate: the other floor's copy of a camera the room already has (removed); kept: anchored elsewhere on the room's floor too.
 * `boundary_walls_kept`: the other floor's walls along its outline. `aligned` false = "ודא את יישור הקומות". Narrowed on purpose:
 * `members[].resource_type` (only cameras and devices become members by the conversion). */
export type SharePreview = Omit<ZoneWire.ZoneSharePlan, 'members'> & Partial<Pick<ZoneWire.ZoneShared, 'share_id'>> & {
  members: { resource_type: 'camera' | 'ha_entity'; resource_id: string }[];
};
export const previewShare = (zoneId: string, body: ShareRequest) => post<SharePreview>(path`zones/${zoneId}/share/preview`, body);
export const shareZone = (zoneId: string, body: ShareRequest) => post<SharePreview>(path`zones/${zoneId}/share`, body);
export const unshareZone = (zoneId: string, floorId: string) => del(path`zones/${zoneId}/share/${floorId}`);
/** Members of a shared room (security review B1): reach follows this list, never where an anchor lies. Adding one needs
 * the share rights on every floor of the room. */
export const addShareMember = (zoneId: string, resourceType: ShareMember['resource_type'], resourceId: string) =>
  post<ZoneWire.ZoneMemberAdded>(path`zones/${zoneId}/share/members`, { resource_type: resourceType, resource_id: resourceId });
export const removeShareMember = (zoneId: string, resourceType: ShareMember['resource_type'], resourceId: string) =>
  del(path`zones/${zoneId}/share/members/${resourceType}/${resourceId}`);

/** One member of a shared space as the READER may see it (owner 2026-09-30: each member filtered by the reader's own
 * permissions - a camera they may not view is not listed). `floors`: where it is anchored ("קומה אחרת" and no id for a
 * floor the reader may not read - integration review L6). */
/* One member of a shared space as the READER may see it (owner 2026-09-30: each member filtered by the reader's own permissions - a
 * camera they may not view is not listed). `floors`: where it is anchored ("קומה אחרת" and no id for a floor the reader may not read -
 * integration review L6). 'wiskey_station' (CR-009 §13): a WisKey station listed by name - not placed on any map, it grants no reach.
 * `can_manage`: the share rights on every floor of the room (add and remove); `candidates` (can_manage only): the anchors of the room's
 * floors that are not members yet. The backend's response models (wire/zones.py `ZoneMember` / `ZoneMembers`, generated). */
export type ShareMember = ZoneWire.ZoneMember;
export type ShareMembers = ZoneWire.ZoneMembers;
export const listShareMembers = (zoneId: string) => get<ShareMembers>(path`zones/${zoneId}/share/members`);
/** `withUnshare` (CR-009 §14): a shared room, from its HOME floor - ends every share and its members and deletes the room in one
 * server transaction. Without it a shared room answers 409 `zone_shared`. */
export const deleteZone = (id: string, signal?: AbortSignal, withUnshare = false) => {
  const url = path`zones/${id}` + query({ with_unshare: withUnshare || undefined });
  return signal ? api<void>(url, { method: 'DELETE', signal }) : del(url);
};
export const detectZones = (floorId: string, strength: 'light' | 'medium' | 'strong' = 'medium') => post<DetectResult>(path`floors/${floorId}/zones/detect`, { strength });
export const acceptZones = (floorId: string, candidates: { polygon: ZonePoint[]; name?: string; kind?: ZoneKind }[], replaceAuto: boolean) =>
  post<Omit<ZoneWire.ZoneAccepted, 'zones'> & { zones: SpatialZone[] }>(path`floors/${floorId}/zones/accept`, { candidates, replace_auto: replaceAuto });

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

