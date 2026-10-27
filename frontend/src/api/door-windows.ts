/**
 * CR-039 / DOORWIN-295: door windows (timed hold-open schedules) and the emergency door controls - the calls of the
 * `#/wiskey/door-windows` screen. The server is the only authority (Arx RBAC per station, the switches, the two-step confirmation);
 * the screen only shapes itself from what these answers say. Every write carries `confirmed: true` from the screen's own confirmation
 * step; the emergency start / release also carry the single-use token the server's `prepare` step returned.
 */
import { get, post, put } from './client';
import { commandId } from './request-id';

export type Tier = 'program' | 'prepared';
export type RuleKind = 'weekly' | 'once' | 'event';
export type TriggerSource = 'ha_event' | 'arx_automation';
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
  /** DOORWIN2-295: an `event` rule's trigger (never the token: only whether one exists) and the Home Assistant action text with a placeholder. */
  trigger?: RuleTrigger | null;
  snippet?: string;
}

export interface RuleTrigger {
  source: TriggerSource;
  duration_s: number;
  automation_id: string | null;
  allowed_from: string | null;
  allowed_to: string | null;
  max_per_day: number;
  cooldown_s: number;
  arm_state: 'simulate' | 'armed';
  has_token: boolean;
  token_set_at: string | null;
  can_arm: boolean;
}

export interface TriggerBody {
  source: TriggerSource;
  duration_s: number;
  allowed_from?: string | null;
  allowed_to?: string | null;
  max_per_day?: number;
  cooldown_s?: number;
  automation_id?: string | null;
  regenerate_token?: boolean;
}

export interface TriggerLogRow {
  at: string;
  source: 'arx_button' | 'arx_automation' | 'ha_event';
  door: string;
  decision: 'started' | 'extended' | 'simulated' | 'refused';
  reason: string | null;
  end_at: string | null;
}

export interface ForeignPaused {
  door: string;
  station_id: string;
  relay: number;
  label: string;
  incident_id: string | null;
  paused_at: string | null;
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
  /** DOORWIN2-295 */
  automation_actor?: boolean;
  foreign_paused?: ForeignPaused[];
  triggers?: TriggerLogRow[];
}

export interface RuleBody {
  name: string;
  kind: RuleKind;
  calendar_policy: CalendarPolicy;
  notes?: string;
  doors: { station_id: string; relay: number }[];
  periods: { weekday?: number; on_date?: string; start: string; end: string }[];
  trigger?: TriggerBody;
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
export const createRule = (body: RuleBody) => post<RuleSaved>(`${W}/rules`, { ...body, confirmed: true });
export const updateRule = (id: string, body: RuleBody) => put<RuleSaved>(`${W}/rules/${encodeURIComponent(id)}`, { ...body, confirmed: true });
export const ruleAction = (id: string, action: 'enable' | 'pause' | 'retire') => post<{ rule: Rule }>(`${W}/rules/${encodeURIComponent(id)}/${action}`, { confirmed: true });
export const endNow = (occurrenceId: string) => post<{ occurrence: Occurrence }>(`${W}/occurrences/${encodeURIComponent(occurrenceId)}/end-now`, { confirmed: true });
export const confirmClosed = (occurrenceId: string, checked: 'camera' | 'door') =>
  post<{ occurrence: Occurrence }>(`${W}/occurrences/${encodeURIComponent(occurrenceId)}/confirm-closed`, { checked, confirmed: true });
/** DOORWIN2-295: the answer of a save carries the trigger token ONCE (and the Home Assistant action text with it) for a new `ha_event` rule. */
export interface RuleSaved {
  rule: Rule;
  token?: string;
  snippet?: string;
}
export const armRule = (id: string, armed: boolean) => post<{ rule: Rule }>(`${W}/rules/${encodeURIComponent(id)}/arm`, { armed, confirmed: true });
export const newToken = (id: string) => post<{ token: string; snippet: string }>(`${W}/rules/${encodeURIComponent(id)}/token`, { confirmed: true });
export const openFor = (station: string, relay: number, durationS: number) =>
  post<{ decision: { decision: string; end_at: string | null } }>(`${W}/doors/${encodeURIComponent(station)}/${relay}/open-for`, { duration_s: durationS, confirmed: true });
export const foreignHandled = (station: string, relay: number) => post<{ handled: boolean }>(`${W}/doors/${encodeURIComponent(station)}/${relay}/foreign-handled`, { confirmed: true });

export interface HolidayRow {
  date: string;
  kind: 'holiday' | 'holiday_eve' | 'regular' | 'closed';
  name_he: string;
  source: 'generated' | 'manual';
  generated_kind: 'holiday' | 'holiday_eve' | null;
}
export interface CalendarReply {
  days: { on_date: string; scope_key: string; day_type: string; label: string | null }[];
  generator: 'israel' | 'none';
  holidays: HolidayRow[];
}
export const getCalendar = () => get<CalendarReply>(`${W}/calendar`);
export const putCalendarDay = (onDate: string, dayType: HolidayRow['kind'] | 'none', label = '') =>
  put<{ saved: number }>(`${W}/calendar`, { days: [{ on_date: onDate, day_type: dayType, label }], confirmed: true });

/** SPLITSWITCH-297: `go_live_permitted` = the permit AND the door-window program engine's own flag (independent of emergency buttons). */
export const getWindowSettings = () => get<{ settings: Record<string, string>; go_live_permitted: boolean; program_engine_built?: boolean }>(`${W}/settings`);
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
  foreign_paused?: { door: string; label: string }[];
  can_release?: boolean;
  /** WKOPENUNK-295 / EMROLE-295: a system administrator, or a holder of the emergency-open role, may start one explicit new OPEN attempt for a door whose OPEN ended unknown. */
  can_retry_open?: boolean;
  doors?: { door: string; label: string; phase: 'apply' | 'release'; state: DoorResult; attempts: number; code: string | null }[];
}

export interface EmergencyState {
  enabled: boolean;
  open_enabled: boolean;
  hold_ms: number;
  /** `grant` (EMROLE-295): the person may give / take away the emergency-open role (a system administrator or a security manager). */
  can: { lock: boolean; open: boolean; grant?: boolean };
  active: Incident | null;
  drill?: Incident | null;
  scopes?: Record<EmergencyKind, Scope[]>;
  recent?: Incident[];
  /** DOORWIN2-295: the optional home-screen entry (`doors.emergency.home_widget`); the doors whose own program an emergency LOCK paused. */
  home_widget?: boolean;
  foreign_paused?: ForeignPaused[];
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
  'doors.emergency.announce_phrase'?: string;
  'doors.emergency.home_widget'?: string;
  /** EMROLE-295: the expiry offered when a grant names none (hours, 0 = none), the longest a security manager may give, and the two switches. */
  'doors.emergency.grant.default_hours'?: string;
  'doors.emergency.grant.max_hours'?: string;
  'doors.emergency.grant.by_security_manager'?: string;
  'doors.emergency.retry_open.by_holders'?: string;
  /** SPLITSWITCH-297: the permit AND the emergency engine's own flag (independent of door-window programs). */
  go_live_permitted: boolean;
  live_engine_built?: boolean;
  emergency_engine_built?: boolean;
  open_available: boolean;
  attested: boolean;
  attestation: { version: number; text: string };
}

export const getEmergencySettings = () => get<{ settings: EmergencySettings }>(`${E}/settings`);
export const putEmergencySettings = (changes: Record<string, string>) =>
  put<{ settings: EmergencySettings; changed: string[] }>(`${E}/settings`, { changes, confirmed: true });
export const attest = (version: number) => post<{ attested: boolean; version: number }>(`${E}/attestation`, { version, accepted: true, confirmed: true });

/** WKOPENUNK-295: one explicit new OPEN attempt for ONE door whose OPEN ended unknown; the person types the door's name (the server checks it) - never automatic. */
export const retryOpenDoor = (incidentId: string, stationId: string, relay: number, confirmDoor: string) =>
  post<{ incident: Incident }>(`${E}/incidents/${encodeURIComponent(incidentId)}/retry-open`, { station_id: stationId, relay, confirm_door: confirmDoor });

// ---------------------------------------------------------------- EMROLE-295: who holds the emergency-open role

export interface GrantHolder {
  id: string;
  subject_kind: 'user' | 'group';
  subject_id: string;
  name: string;
  scope_type: string;
  scope_id: string;
  scope_name: string;
  expires_at: string | null;
  created_at: string;
  assigned_by: string | null;
  assigned_by_name: string;
  role_name: string;
}

export interface GrantsView {
  basis: 'system_admin' | 'security_manager';
  default_hours: number;
  max_hours: number;
  can_no_expiry: boolean;
  holders: GrantHolder[];
  candidates: { id: string; name: string }[];
  scopes: { scope_type: 'installation' | 'site' | 'building'; scope_id: string; name: string }[];
  role_name: string;
}

export const getEmergencyGrants = () => get<GrantsView>(`${E}/grants`);
/** Give the built-in emergency-open role to one person; `expires_at` is a UTC instant (Z), `noExpiry` is for a system administrator only. */
export const grantEmergencyOpen = (userId: string, scope: { scope_type: string; scope_id: string }, expiresAt: string | null, noExpiry: boolean) =>
  post<{ grant: { id: string; expires_at: string | null } }>(`${E}/grants`, { user_id: userId, ...scope, expires_at: noExpiry ? null : expiresAt, no_expiry: noExpiry, confirmed: true });
export const revokeEmergencyGrant = (bindingId: string) => post<{ revoked: string }>(`${E}/grants/${encodeURIComponent(bindingId)}/revoke`, { confirmed: true });
