/**
 * CR-INFRA-ELEVATORS: the ONLY module of the frontend that talks to `/api/v1/infra/elevators...` (smplwise_vms/backend/smplwise/routers/elevators.py).
 * View only: nothing is ever sent to an elevator. The operator routes speak in role keys and labels; entity ids come only from the manage routes.
 */
import { del, get, post, put } from './client';

/** The closed list of roles in the settings dialog's order (out_of_service = the owner's shutdown, "השבתה"); mirrors services/elevators.py ROLES. */
export const ELEVATOR_ROLES = ['waiting', 'fault', 'fire_service', 'out_of_service', 'moving_up', 'moving_down', 'door_open'] as const;
export type ElevatorRole = (typeof ELEVATOR_ROLES)[number];
export type ElevatorState = 'fire_service' | 'fault' | 'out_of_service' | 'active' | 'moving_up' | 'moving_down' | 'door_open' | 'waiting' | 'unknown';
export const MAX_EXTRAS = 4;

export interface ElevatorLive {
  state: ElevatorState;
  reason: string;
  partial: boolean;
  stale: boolean;
  since: string | null;
  roles: ElevatorRole[];
  extras: { position: number; label: string; on: boolean | null }[];
}
export interface Elevator extends ElevatorLive {
  id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
}
export interface ElevatorsResponse {
  elevators: Elevator[];
  summary: Record<ElevatorState, number>;
  stale: boolean;
  at: string;
}
export interface ManagedSensor {
  entity_id: string;
  entity_name: string;
  missing: boolean;
}
/** The manage listing: the live fields plus the mapping. Its `extras` are the mapping (entity id, label), not the live on / off. */
export interface ManagedElevator extends Omit<Elevator, 'extras'> {
  enabled: boolean;
  sort_order: number;
  revision: number;
  sensors: Partial<Record<ElevatorRole, ManagedSensor>>;
  extras: (ManagedSensor & { label: string })[];
}
export interface Candidate {
  entity_id: string;
  name: string;
  device_class: string | null;
  area_name: string | null;
}
export interface ElevatorBody {
  name: string;
  area_id?: string | null;
  enabled?: boolean;
  sensors: Partial<Record<ElevatorRole, string | null>>;
  extras: { entity_id: string; label: string }[];
  revision?: number;
}

export const listElevators = () => get<ElevatorsResponse>('infra/elevators');
export const listManaged = () => get<{ elevators: ManagedElevator[]; roles: ElevatorRole[]; max_extras: number }>('infra/elevators/manage');
export const listCandidates = (q = '') => get<{ items: Candidate[] }>(`infra/elevators/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const createElevator = (body: ElevatorBody) => post<ManagedElevator>('infra/elevators', body);
export const updateElevator = (id: string, body: ElevatorBody) => put<ManagedElevator>(`infra/elevators/${encodeURIComponent(id)}`, body);
export const deleteElevator = (id: string) => del(`infra/elevators/${encodeURIComponent(id)}`);
export const reorderElevators = (ids: string[]) => put<{ elevators: ManagedElevator[] }>('infra/elevators/order', { ids });
