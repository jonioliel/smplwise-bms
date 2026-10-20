/**
 * CR-039 / DOORWIN-295: door windows (timed hold-open schedules) and the emergency door controls - the calls of the
 * `#/wiskey/door-windows` screen. The server is the only authority (Arx RBAC per station, the switches, the two-step confirmation);
 * the screen only shapes itself from what these answers say. Every write carries `confirmed: true` from the screen's own confirmation
 * step; the emergency start / release also carry the single-use token the server's `prepare` step returned.
 */
import { get, post, put } from './client';
import { commandId } from './request-id';

export type Tier = 'program' | 'prepared';
export type RuleKind = 'weekly' | 'once';
export type RuleState = 'draft' | 'enabled' | 'paused' | 'retired';
export type CalendarPolicy = 'skip_holidays' | 'holidays_like_friday' | 'ignore_calendar';
export type OccState =
  | 'prepared' | 'planned' | 'armed' | 'starting' | 'active' | 'not_started' | 'ending' | 'relock_unconfirmed'
  | 'closed_confirmed' | 'cancelled' | 'superseded' | 'elapsed';

export interface DoorRow {
  key: string;
  station_id: string;
  relay: number;
  label: string;
  station_name: string;
  name: string;
  zone: string;
  manage: boolean;
  cancel: boolean;
  exterior: boolean;
}

export interface Period {
  weekday: number | null;
  on_date: string | null;
  start: string;
  end: string;
}

export interface Rule {
  id: string;
  name: string;
  kind: RuleKind;
  state: RuleState;
  calendar_policy: CalendarPolicy;
  notes: string;
  revision: number;
  updated_at: string | null;
  approved: boolean;
  manageable?: boolean;
  doors: { station_id: string; relay: number; key: string; label: string; visible: boolean }[];
  periods: Period[];
}

export interface Occurrence {
  id: string;
  door: string;
  label: string;
  rule_id: string | null;
  rule_name: string;
  start_at: string;
  end_at: string;
  zone: string;
  state: OccState;
  tier: Tier;
  retries: number;
  unconfirmed_at: string | null;
  last_reason: string | null;
  resolution: string | null;
  resolved_at: string | null;
}

export interface WindowsState {
  enabled: boolean;
  tier: Tier;
  go_live_permitted: boolean;
  settings: Record<string, string>;
  can: { manage: boolean; cancel: boolean; configure: boolean };
  doors: DoorRow[];
  rules: Rule[];
  occurrences: Occurrence[];
  now: string;
}

export interface RuleBody {
  name: string;
  kind: RuleKind;
  calendar_policy: CalendarPolicy;
  notes?: string;
  doors: { station_id: string; relay: number }[];
  periods: { weekday?: number; on_date?: string; start: string; end: string }[];
  revision?: number;
  enable?: boolean;
}

export interface PreviewReply {
  tier: Tier;
  doors: { door: string; label: string; zone: string; errors: string[]; occurrences: { start_at: string; end_at: string; token: string }[] }[];
}

const W = 'doors/windows';

export const getWindowsState = () => get<WindowsState>(`${W}/state`);
export const previewRule = (body: RuleBody) => post<PreviewReply>(`${W}/rules/preview`, body);
export const createRule = (body: RuleBody) => post<{ rule: Rule }>(`${W}/rules`, { ...body, confirmed: true });
export const updateRule = (id: string, body: RuleBody) => put<{ rule: Rule }>(`${W}/rules/${encodeURIComponent(id)}`, { ...body, confirmed: true });
export const ruleAction = (id: string, action: 'enable' | 'pause' | 'retire') => post<{ rule: Rule }>(`${W}/rules/${encodeURIComponent(id)}/${action}`, { confirmed: true });
export const endNow = (occurrenceId: string) => post<{ occurrence: Occurrence }>(`${W}/occurrences/${encodeURIComponent(occurrenceId)}/end-now`, { confirmed: true });
export const confirmClosed = (occurrenceId: string, checked: 'camera' | 'door') =>
  post<{ occurrence: Occurrence }>(`${W}/occurrences/${encodeURIComponent(occurrenceId)}/confirm-closed`, { checked, confirmed: true });
export const getWindowSettings = () => get<{ settings: Record<string, string>; go_live_permitted: boolean }>(`${W}/settings`);
export const putWindowSettings = (changes: Record<string, string>) =>
  put<{ settings: Record<string, string>; changed: string[] }>(`${W}/settings`, { changes, confirmed: true });

// ---------------------------------------------------------------- emergency

export type EmergencyKind = 'lock_secure' | 'open';
export type ScopeType = 'installation' | 'site' | 'building';
export type DoorResult = 'pending' | 'sent' | 'acknowledged' | 'refused' | 'unknown' | 'skipped';

export interface Scope {
  scope_type: ScopeType;
  scope_id: string;
  name: string;
  doors: number;
}

export interface Incident {
  id: string;
  kind: EmergencyKind;
  kind_label: string;
  drill: boolean;
  state: 'applying' | 'in_effect' | 'in_effect_partial' | 'releasing' | 'released' | 'released_partial';
  scope_type: ScopeType;
  scope_id: string;
  scope_name: string;
  requested_at: string;
  released_at: string | null;
  reason: string;
  counts: { total: number; ok: number; failed: number; unknown: number };
  first_sent_ms: number | null;
  last_sent_ms: number | null;
  superseded_by: string | null;
  can_release?: boolean;
  doors?: { door: string; label: string; phase: 'apply' | 'release'; state: DoorResult; attempts: number; code: string | null }[];
}

export interface EmergencyState {
  enabled: boolean;
  open_enabled: boolean;
  hold_ms: number;
  can: { lock: boolean; open: boolean };
  active: Incident | null;
  drill?: Incident | null;
  scopes?: Record<EmergencyKind, Scope[]>;
  recent?: Incident[];
}

export interface Prepared {
  confirm_token: string;
  expires_at: string;
  doors: number;
  kind: EmergencyKind;
  action: 'start' | 'release';
  drill: boolean;
  scope_type: ScopeType;
  scope_id: string;
  scope_name: string;
}

const E = 'doors/emergency';

export const getEmergencyState = () => get<EmergencyState>(`${E}/state`);
export const prepareStart = (kind: EmergencyKind, scope: { scope_type: ScopeType; scope_id: string }, drill: boolean) =>
  post<Prepared>(`${E}/prepare`, { action: 'start', kind, ...scope, drill });
export const prepareRelease = (incident: Pick<Incident, 'id' | 'kind' | 'drill'>) =>
  post<Prepared>(`${E}/prepare`, { action: 'release', kind: incident.kind, incident_id: incident.id, drill: incident.drill });
/** The second step: the token from `prepare`, the explicit confirmation and a fresh request id (never retried by the screen). */
export const startIncident = (token: string, reason = '') =>
  post<{ incident: Incident }>(`${E}/incidents`, { confirm_token: token, confirmed: true, reason, client_request_id: commandId() });
export const releaseIncident = (id: string, token: string) =>
  post<{ incident: Incident }>(`${E}/incidents/${encodeURIComponent(id)}/release`, { confirm_token: token, confirmed: true, client_request_id: commandId() });
export const getIncident = (id: string) => get<{ incident: Incident }>(`${E}/incidents/${encodeURIComponent(id)}`);

export interface EmergencySettings {
  'doors.emergency.enabled': string;
  'doors.emergency.open_enabled': string;
  'doors.emergency.automations': string;
  'doors.emergency.hold_ms': string;
  go_live_permitted: boolean;
  open_available: boolean;
  attested: boolean;
  attestation: { version: number; text: string };
}

export const getEmergencySettings = () => get<{ settings: EmergencySettings }>(`${E}/settings`);
export const putEmergencySettings = (changes: Record<string, string>) =>
  put<{ settings: EmergencySettings; changed: string[] }>(`${E}/settings`, { changes, confirmed: true });
export const attest = (version: number) => post<{ attested: boolean; version: number }>(`${E}/attestation`, { version, accepted: true, confirmed: true });
