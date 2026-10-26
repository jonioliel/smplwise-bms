/**
 * CR-INFRA-ELEVATORS: the ONLY module of the frontend that talks to `/api/v1/infra/elevators...` (smplwise_vms/backend/smplwise/routers/elevators.py).
 * View only: nothing is ever sent to an elevator. The operator routes speak in role keys and labels; entity ids come only from the manage routes.
 */
import { del, get, post, put } from './client';

/** The closed list of roles in the settings dialog's order (out_of_service = the owner's shutdown, "השבתה"); mirrors services/elevators.py ROLES. */
export const ELEVATOR_ROLES = ['waiting', 'fault', 'fire_service', 'out_of_service', 'moving_up', 'moving_down', 'door_open'] as const;
export type ElevatorRole = (typeof ELEVATOR_ROLES)[number];
export type ElevatorState = 'fire_service' | 'fault' | 'out_of_service' | 'active' | 'moving_up' | 'moving_down' | 'door_open' | 'waiting' | 'travelling' | 'unknown';
export const MAX_EXTRAS = 4;

export interface ElevatorLive {
  state: ElevatorState;
  reason: string;
  partial: boolean;
  stale: boolean;
  since: string | null;
  roles: ElevatorRole[];
  /** 2.8.0: each visible mapped role's live value (true / false / null = no live value) - the screen's sensor lights. */
  flags?: Partial<Record<ElevatorRole, boolean | null>>;
  extras: { position: number; label: string; on: boolean | null }[];
}
/** 2.8.0: one stretch of the state history (ISO UTC); only with `?history=24` and only for an elevator the caller sees whole (else null). */
export interface HistorySegment {
  state: ElevatorState;
  from: string;
  to: string;
}
export interface Elevator extends ElevatorLive {
  id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  /** ELEVTRAVEL-291: this elevator uses the "show travelling" option (absent on an older server = false). */
  uses_travel?: boolean;
  history?: HistorySegment[] | null;
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
  /** ELEVTRAVEL-291: the option "show travelling when not on standby and without a fault" (default off). */
  show_travel?: boolean;
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
  show_travel?: boolean;
  sensors: Partial<Record<ElevatorRole, string | null>>;
  extras: { entity_id: string; label: string }[];
  revision?: number;
}

/** 2.8.0 (owner decision 2026-10-18): the elevator alert settings - everything OFF by default; recipients chosen per state (roles, users,
 * groups; none = nobody); extra channels push / app (the inbox always). Read: elevator managers and system configurators; write: system.configure. */
export type AlertState = 'fire_service' | 'fault' | 'out_of_service';
export type AlertChannel = 'push' | 'app' | 'whatsapp';
export interface AlertRecipients {
  roles: string[];
  users: string[];
  groups: string[];
}
export interface AlertStateSettings {
  enabled: boolean;
  recipients: AlertRecipients;
  channels: AlertChannel[];
}
export interface AlertSettings {
  enabled: boolean;
  states: Record<AlertState, AlertStateSettings>;
  row_version: number;
  roles: { id: string; label: string }[];
  channels: AlertChannel[];
  states_order: AlertState[];
  can_edit: boolean;
  /** GENELEV-295: the viewer may add WhatsApp / change who it reaches (notify.manage); without it the WhatsApp box is read-only. */
  can_whatsapp?: boolean;
}
export interface AlertSettingsBody {
  enabled?: boolean;
  states?: Partial<Record<AlertState, Partial<AlertStateSettings>>>;
  row_version?: number;
}
export const getAlertSettings = () => get<AlertSettings>('infra/elevators/alerts');
export const putAlertSettings = (body: AlertSettingsBody) => put<AlertSettings>('infra/elevators/alerts', body);

export const listElevators =(history: 0 | 24 = 0) => get<ElevatorsResponse>(history ? `infra/elevators?history=${history}` : 'infra/elevators');
export const listManaged = () => get<{ elevators: ManagedElevator[]; roles: ElevatorRole[]; max_extras: number }>('infra/elevators/manage');
export const listCandidates = (q = '') => get<{ items: Candidate[] }>(`infra/elevators/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const createElevator = (body: ElevatorBody) => post<ManagedElevator>('infra/elevators', body);
export const updateElevator = (id: string, body: ElevatorBody) => put<ManagedElevator>(`infra/elevators/${encodeURIComponent(id)}`, body);
export const deleteElevator = (id: string) => del(`infra/elevators/${encodeURIComponent(id)}`);
export const reorderElevators = (ids: string[]) => put<{ elevators: ManagedElevator[] }>('infra/elevators/order', { ids });
