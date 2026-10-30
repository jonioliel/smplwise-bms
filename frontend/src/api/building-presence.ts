/**
 * BUILDING-PRESENCE-2271 (board r339, phase 1): anonymous building / room occupancy from the presence sensors the owner tags
 * (backend routers/building_presence.py). Live state only: no person, no history. The feature is invisible while nothing is tagged -
 * `configured: false` - so every screen asks `chipView` / `hasFeature` first and renders nothing otherwise.
 */
import { del, get, put } from './client';

export type OccupancyStatus = 'occupied' | 'clear' | 'unknown';

export type HomeDisplay = 'card' | 'chip' | 'off';
export interface BuildingPresenceSettings {
  /** The master switch (PRESENCE-2280): OFF by default; nothing is read, shown or stored while it is off. */
  enabled: boolean;
  /** Days the room transitions are kept (0 = keep none). */
  retention_days: number;
  /** How the overview shows the building: a card, the thin line, or nothing. */
  home_display: HomeDisplay;
  /** Rooms with a sensor carry a status tag on the plan map. */
  map_tint: boolean;
  /** Seconds a sensor that turned off still counts as occupied (debounce of a PIR that drops while someone sits still). */
  hold_seconds: number;
  /** Minutes of an empty building after which the cockpit's "building empty" trigger fires. */
  empty_minutes: number;
}
export interface BuildingRoom { area_id: string | null; name: string | null; status: OccupancyStatus; sensors: number; empty_since: string | null }
export interface BuildingSensor { entity_id: string; name: string; area_id: string | null; status: OccupancyStatus; since: string | null }
export interface BuildingSnapshot {
  configured: boolean;
  enabled?: boolean;
  settings: BuildingPresenceSettings;
  fresh?: boolean;
  status?: OccupancyStatus;
  occupied_rooms?: number;
  rooms?: BuildingRoom[];
  sensors?: BuildingSensor[];
  empty_since?: string | null;
  empty_minutes?: number | null;
  empty_reached?: boolean;
  at?: string;
}
export interface PresenceCandidate { entity_id: string; name: string; area_id: string | null; area_name: string | null; device_class: string | null; tagged: boolean; state: string | null; placed?: boolean }
export interface PresenceRoomOption { area_id: string; name: string }
export interface CandidateList { sensors: PresenceCandidate[]; rooms?: PresenceRoomOption[]; settings: BuildingPresenceSettings }
export interface PresenceHistorySummary { rows: number; oldest: string | null; retention_days: number; enabled: boolean }

export const HOLD_RANGE = { min: 0, max: 3600 } as const;
export const EMPTY_RANGE = { min: 1, max: 1440 } as const;
export const RETENTION_RANGE = { min: 0, max: 365 } as const;

export const getBuildingPresence = () => get<BuildingSnapshot>('presence/building');
export const getPresenceCandidates = () => get<CandidateList>('presence/building/sensors');
export const putPresenceTags = (entityIds: string[]) => put<CandidateList>('presence/building/sensors', { entity_ids: entityIds });
export const putPresenceSettings = (s: Partial<BuildingPresenceSettings>) => put<{ settings: BuildingPresenceSettings }>('presence/building/settings', s);
export const putPresenceRoom = (entityId: string, areaId: string | null) => put<CandidateList>('presence/building/room', { entity_id: entityId, area_id: areaId });
export const getPresenceHistory = () => get<PresenceHistorySummary>('presence/building/history');
export const purgePresenceHistory = async (): Promise<PresenceHistorySummary> => {
  await del('presence/building/history');
  return getPresenceHistory();
};
