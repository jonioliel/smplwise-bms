/**
 * CR-INFRA-ELEVATORS: the ONLY module of the frontend that talks to `/api/v1/infra/elevators...` (smplwise_vms/backend/smplwise/routers/elevators.py).
 * View only: nothing is ever sent to an elevator. The operator routes speak in role keys and labels; entity ids come only from the manage routes.
 */
import { del, get, post, put } from './client';
import type * as Wire from './generated/wire-elevators';

/** The closed list of roles in the settings dialog's order (out_of_service = the owner's shutdown, "השבתה"); mirrors services/elevators.py ROLES. */
export const ELEVATOR_ROLES = ['waiting', 'fault', 'fire_service', 'out_of_service', 'moving_up', 'moving_down', 'door_open'] as const;
export type ElevatorRole = (typeof ELEVATOR_ROLES)[number];
/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/elevators.py), generated into
 * ./generated/wire-elevators.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: role keys (`roles`, `flags`, `sensors`) to ElevatorRole, the alert states / channels to their closed lists, the history
 * segment's `state` (a stored text) to ElevatorState; `flags`, `uses_travel`, `show_travel`, `can_whatsapp` stay optional (an older server). */
export type ElevatorState = Wire.ElevatorOperator['state'];
export const MAX_EXTRAS = 4;

interface ElevatorLive extends Pick<Wire.ElevatorOperator, 'state' | 'reason' | 'partial' | 'stale' | 'since' | 'extras'> {
  roles: ElevatorRole[];
  /** 2.8.0: each visible mapped role's live value (true / false / null = no live value) - the screen's sensor lights. */
  flags?: Partial<Record<ElevatorRole, boolean | null>>;
}
/** 2.8.0: one stretch of the state history (ISO UTC); only with `?history=24` and only for an elevator the caller sees whole (else null). */
export type HistorySegment = Omit<Wire.ElevatorHistorySegment, 'state'> & { state: ElevatorState };
export interface Elevator extends ElevatorLive, Pick<Wire.ElevatorOperator, 'id' | 'name' | 'area_id' | 'area_name'> {
  /** ELEVTRAVEL-291: this elevator uses the "show travelling" option (absent on an older server = false). */
  uses_travel?: boolean;
  history?: HistorySegment[] | null;
}
export type ElevatorsResponse = Omit<Wire.ElevatorList, 'elevators' | 'summary'> & {
  elevators: Elevator[];
  summary: Record<ElevatorState, number>;
};
type ManagedSensor = Wire.ElevatorSensorLink;
/** The manage listing: the live fields plus the mapping. Its `extras` are the mapping (entity id, label), not the live on / off. */
export interface ManagedElevator extends Omit<Elevator, 'extras'>, Pick<Wire.ElevatorManaged, 'enabled' | 'sort_order' | 'revision'> {
  /** ELEVTRAVEL-291: the option "show travelling when not on standby and without a fault" (default off). */
  show_travel?: boolean;
  sensors: Partial<Record<ElevatorRole, ManagedSensor>>;
  extras: Wire.ElevatorExtraLink[];
}
export type Candidate = Wire.ElevatorCandidate;
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
export type AlertChannel = Wire.ElevatorAlerts['channels'][number];
export type AlertRecipients = Wire.ElevatorAlertRecipients;
export type AlertStateSettings = Omit<Wire.ElevatorAlertState, 'channels'> & { channels: AlertChannel[] };
export type AlertSettings = Omit<Wire.ElevatorAlerts, 'states' | 'states_order' | 'can_whatsapp'> & {
  states: Record<AlertState, AlertStateSettings>;
  states_order: AlertState[];
  /** GENELEV-295: the viewer may add WhatsApp / change who it reaches (notify.manage); without it the WhatsApp box is read-only. */
  can_whatsapp?: boolean;
};
export interface AlertSettingsBody {
  enabled?: boolean;
  states?: Partial<Record<AlertState, Partial<AlertStateSettings>>>;
  row_version?: number;
}
export const getAlertSettings = () => get<AlertSettings>('infra/elevators/alerts');
export const putAlertSettings = (body: AlertSettingsBody) => put<AlertSettings>('infra/elevators/alerts', body);

export const listElevators =(history: 0 | 24 = 0) => get<ElevatorsResponse>(history ? `infra/elevators?history=${history}` : 'infra/elevators');
export const listManaged = () => get<Omit<Wire.ElevatorManageList, 'elevators' | 'roles'> & { elevators: ManagedElevator[]; roles: ElevatorRole[] }>('infra/elevators/manage');
export const listCandidates = (q = '') => get<Wire.ElevatorCandidates>(`infra/elevators/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const createElevator = (body: ElevatorBody) => post<ManagedElevator>('infra/elevators', body);
export const updateElevator = (id: string, body: ElevatorBody) => put<ManagedElevator>(`infra/elevators/${encodeURIComponent(id)}`, body);
export const deleteElevator = (id: string) => del(`infra/elevators/${encodeURIComponent(id)}`);
export const reorderElevators = (ids: string[]) => put<Omit<Wire.ElevatorManageList, 'elevators' | 'roles'> & { elevators: ManagedElevator[]; roles: ElevatorRole[] }>('infra/elevators/order', { ids });
