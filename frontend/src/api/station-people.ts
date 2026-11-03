/**
 * WISKEY-PEOPLE-COMPLETE-2390: people on door stations that the access control does not manage (routers/access_control_station_people.py),
 * the people screen's duplicate warning and the editor's PIN check. The browser never names a WisKey command and never sees a review
 * token, a PIN or a card number: every call is one typed Arx endpoint that checks Arx permissions on the station and audits the write.
 * Writes carry a fresh command envelope (one per deliberate action, never reused); nothing here retries.
 */
import { get, post } from './client';
import { writeEnvelope } from './access-writes';

export interface StationScopeRow {
  id: string;
  name: string;
  online: boolean;
  ignored: number;
  /** The caller sees PIN / card / face presence on this station. */
  credentials: boolean;
  /** The caller sees the station's user numbers (else the station cannot be reviewed by them). */
  numbers: boolean;
}

export interface StationUser {
  employee_no: string;
  display_name: string;
  first_seen_at: string;
  last_seen_at: string;
  ignored: boolean;
  ignored_at: string | null;
  ignored_in_wiskey: boolean;
  adoptable: boolean;
  import_error: string | null;
  /** null = not shown to this caller (credential presence needs the sensitive level on the station). */
  pin: boolean | null;
  cards: number | null;
  /** true = a face or fingerprint is on the station; null = not reported (or not shown). */
  biometric: boolean | null;
}

export interface StationUsersReply {
  state: string;
  last_error: string | null;
  cached: boolean;
  station: { id: string; name: string };
  read_at: string | null;
  people: StationUser[] | null;
}

export interface DuplicateMatch {
  id: string;
  display_name: string;
  employee_no: string | null;
  reasons: string[];
}

export interface StationCheckReply {
  state: string;
  last_error: string | null;
  checked: boolean;
  matches: DuplicateMatch[];
  total: number;
  same_number: { id: string | null; display_name: string } | null;
  restricted: boolean;
}

export type StepOutcome = 'ok' | 'refused' | 'unknown' | 'not_sent';

export interface StepResult {
  station_id: string;
  outcome: StepOutcome;
  code: string | null;
  message: string | null;
  stored?: boolean;
}

export interface StationWriteReply {
  results: StepResult[];
  summary: Record<StepOutcome, number>;
  person?: { id: string; display_name: string } | null;
  effect?: string;
  pending?: boolean;
  note?: string;
}

export interface DuplicateGroup {
  code: 'duplicate_display_name' | 'duplicate_phone' | 'duplicate_profile';
  field_id: string;
  label: string;
  people: { id: string; display_name: string }[];
  more: number;
}

export interface DuplicatesReply {
  state: string;
  restricted: boolean;
  groups: DuplicateGroup[] | null;
  complete: boolean;
  last_error?: string | null;
}

const enc = encodeURIComponent;

export const getStationScope = () => get<{ state: string; stations: StationScopeRow[] }>('access-control/station-people/stations');
export const getStationUsers = (stationId: string, refresh = false) =>
  get<StationUsersReply>(`access-control/station-people/stations/${enc(stationId)}${refresh ? '?refresh=true' : ''}`);
export const checkStationUser = (stationId: string, employeeNo: string) =>
  post<StationCheckReply>('intercom/station-people/check', { station_id: stationId, employee_no: employeeNo });

/** `confirmed` is sent only from the confirmation step; the server refuses the action without it. */
export const adoptStationUser = (employeeNo: string, stationIds: string[], allowPossibleDuplicate: boolean) =>
  post<StationWriteReply>('intercom/station-people/adopt', { employee_no: employeeNo, station_ids: stationIds, confirmed: true, allow_possible_duplicate: allowPossibleDuplicate, ...writeEnvelope() });
export const ignoreStationUser = (employeeNo: string, stationIds: string[], ignored: boolean) =>
  post<StationWriteReply>('intercom/station-people/ignore', { employee_no: employeeNo, station_ids: stationIds, ignored, confirmed: true, ...writeEnvelope() });
/** `typed`: the station user number, typed again by the operator (the server compares it). */
export const deleteStationUser = (employeeNo: string, stationIds: string[], typed: string) =>
  post<StationWriteReply>('intercom/station-people/delete', { employee_no: employeeNo, station_ids: stationIds, typed, confirmed: true, ...writeEnvelope() });

export const getPeopleDuplicates = () => get<DuplicatesReply>('access-control/people-duplicates');
/** Whether a typed PIN is free (the value goes to the server once and is never kept). */
export const checkPin = (userId: string, pin: string) => post<{ state: string; last_error: string | null; available: boolean | null }>('intercom/people/pin-check', { user_id: userId, pin });
