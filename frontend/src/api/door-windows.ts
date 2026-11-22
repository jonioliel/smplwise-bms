/**
 * CR-039 / DOORWIN-295: door windows (timed hold-open schedules) and the emergency door controls - the calls of the
 * `#/wiskey/door-windows` screen. The server is the only authority (Arx RBAC per station, the switches, the two-step confirmation);
 * the screen only shapes itself from what these answers say. Every write carries `confirmed: true` from the screen's own confirmation
 * step; the emergency start / release also carry the single-use token the server's `prepare` step returned.
 */
import { get, post, put } from './client';
import { commandId } from './request-id';
import type * as Wire from './generated/wire-door-windows';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/door_windows.py), generated into
 * ./generated/wire-door-windows.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: the occurrence / incident / door-result states, the trigger-log source and decision, the holiday kinds and the emergency
 * scope types to their closed lists (stored text on the server). Optional on purpose (an older server, the demo / test stores): a door's
 * `program`, a rule's `hidden_doors`, the DOORWIN2 additions of the states, the incident's `foreign_paused` / `doors`, and the
 * emergency settings added after the first release. */

export type Tier = 'program' | 'prepared';
export type RuleKind = 'weekly' | 'once' | 'event';
export type TriggerSource = 'ha_event' | 'arx_automation';
export type CalendarPolicy = 'skip_holidays' | 'holidays_like_friday' | 'ignore_calendar';
export type OccState =
  | 'prepared' | 'planned' | 'armed' | 'starting' | 'active' | 'not_started' | 'ending' | 'relock_unconfirmed'
  | 'closed_confirmed' | 'cancelled' | 'superseded' | 'elapsed';

export type DoorRow = Omit<Wire.DwDoor, 'program'> & Partial<Pick<Wire.DwDoor, 'program'>>;

export type Period = Wire.DwPeriod;

/** `manageable` only in the screen state; DOORWIN2-295: an `event` rule's `trigger` (never the token: only whether one exists) and
 * `snippet`, the Home Assistant action text with a placeholder. */
export type Rule = Omit<Wire.DwRule, 'hidden_doors'> & Partial<Pick<Wire.DwRule, 'hidden_doors'>>;

export type RuleTrigger = Wire.DwTrigger;

interface TriggerBody {
  source: TriggerSource;
  duration_s: number;
  allowed_from?: string | null;
  allowed_to?: string | null;
  max_per_day?: number;
  cooldown_s?: number;
  automation_id?: string | null;
  regenerate_token?: boolean;
}

export interface TriggerLogRow extends Omit<Wire.DwTriggerLog, 'source' | 'decision'> {
  source: 'arx_button' | 'arx_automation' | 'ha_event';
  decision: 'started' | 'extended' | 'simulated' | 'refused';
}

export type ForeignPaused = Wire.DwForeignPaused;

export type Occurrence = Omit<Wire.DwOccurrence, 'state'> & { state: OccState };

export interface WindowsState extends Omit<Wire.DwState, 'doors' | 'rules' | 'occurrences' | 'automation_actor' | 'foreign_paused' | 'triggers'> {
  doors: DoorRow[];
  rules: Rule[];
  occurrences: Occurrence[];
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

export type PreviewReply = Wire.DwRulePreview;

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
export type RuleSaved = Omit<Wire.DwRuleSaved, 'rule'> & { rule: Rule };
export const armRule = (id: string, armed: boolean) => post<{ rule: Rule }>(`${W}/rules/${encodeURIComponent(id)}/arm`, { armed, confirmed: true });
export const newToken = (id: string) => post<Wire.DwToken>(`${W}/rules/${encodeURIComponent(id)}/token`, { confirmed: true });
export const openFor = (station: string, relay: number, durationS: number) =>
  post<Wire.DwOpenFor>(`${W}/doors/${encodeURIComponent(station)}/${relay}/open-for`, { duration_s: durationS, confirmed: true });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by DOORWIN2 (door windows).
export const foreignHandled = (station: string, relay: number) => post<Wire.DwDoorHandled>(`${W}/doors/${encodeURIComponent(station)}/${relay}/foreign-handled`, { confirmed: true });

export interface HolidayRow extends Omit<Wire.DwHoliday, 'generated_kind'> {
  generated_kind: 'holiday' | 'holiday_eve' | null;
}
export type CalendarReply = Omit<Wire.DwCalendar, 'generator' | 'holidays'> & { generator: 'israel' | 'none'; holidays: HolidayRow[] };
export const getCalendar = () => get<CalendarReply>(`${W}/calendar`);
export const putCalendarDay = (onDate: string, dayType: HolidayRow['kind'] | 'none', label = '') =>
  put<Wire.DwCalendarSaved>(`${W}/calendar`, { days: [{ on_date: onDate, day_type: dayType, label }], confirmed: true });

/** SPLITSWITCH-297: `go_live_permitted` = the permit AND the door-window program engine's own flag (independent of emergency buttons). */
export const getWindowSettings = () => get<Omit<Wire.DwSettings, 'program_engine_built'> & Partial<Pick<Wire.DwSettings, 'program_engine_built'>>>(`${W}/settings`);
export const putWindowSettings = (changes: Record<string, string>) =>
  put<Wire.DwSettingsSaved>(`${W}/settings`, { changes, confirmed: true });

// ---------------------------------------------------------------- emergency

export type EmergencyKind = 'lock_secure' | 'open';
type ScopeType = 'installation' | 'site' | 'building';
export type DoorResult = 'pending' | 'sent' | 'acknowledged' | 'refused' | 'unknown' | 'skipped';

export type Scope = Wire.DwEmergencyScope;

type IncidentDoor = Omit<Wire.DwIncidentDoor, 'state'> & { state: DoorResult };

/** `can_release` / `can_retry_open` (WKOPENUNK-295 / EMROLE-295: a system administrator, or a holder of the emergency-open role, may start
 * one explicit new OPEN attempt for a door whose OPEN ended unknown) only on the active incident of the state. */
export interface Incident extends Omit<Wire.DwIncident, 'state' | 'scope_type' | 'doors' | 'foreign_paused'> {
  state: 'applying' | 'in_effect' | 'in_effect_partial' | 'releasing' | 'released' | 'released_partial';
  scope_type: ScopeType;
  foreign_paused?: Wire.DwIncidentForeign[];
  doors?: IncidentDoor[];
}

/** `can.grant` (EMROLE-295): the person may give / take away the emergency-open role (a system administrator or a security manager).
 * DOORWIN2-295: `home_widget` (the optional home-screen entry) and the doors whose own program an emergency LOCK paused. */
export interface EmergencyState extends Pick<Wire.DwEmergencyState, 'enabled' | 'open_enabled' | 'hold_ms'> {
  can: Omit<Wire.DwEmergencyCan, 'grant'> & Partial<Pick<Wire.DwEmergencyCan, 'grant'>>;
  active: Incident | null;
  drill?: Incident | null;
  scopes?: Record<EmergencyKind, Scope[]>;
  recent?: Incident[];
  home_widget?: boolean;
  foreign_paused?: ForeignPaused[];
}

export type Prepared = Omit<Wire.DwPrepared, 'scope_type'> & { scope_type: ScopeType };

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

/** SPLITSWITCH2-297 `doors.emergency.engine_switch`: the emergency-buttons master switch (absent = on); EMROLE-295: the grant expiry
 * settings and the two switches; SPLITSWITCH-297 `go_live_permitted`: the permit AND the emergency engine's own flag; `build_ready`:
 * permit + engine flag before the settings switch (so the screen can tell "not approved in this version" from "switched off"). */
export type EmergencySettings = Omit<Wire.DwEmergencySettings, LaterSettingKeys> & Partial<Pick<Wire.DwEmergencySettings, LaterSettingKeys>>;
type LaterSettingKeys = 'doors.emergency.announce_phrase' | 'doors.emergency.home_widget' | 'doors.emergency.engine_switch'
  | 'doors.emergency.grant.default_hours' | 'doors.emergency.grant.max_hours' | 'doors.emergency.grant.by_security_manager'
  | 'doors.emergency.retry_open.by_holders' | 'live_engine_built' | 'emergency_engine_built' | 'build_ready' | 'lock_available';

export const getEmergencySettings = () => get<{ settings: EmergencySettings }>(`${E}/settings`);
export const putEmergencySettings = (changes: Record<string, string>, confirmEngineOff = false) =>
  put<{ settings: EmergencySettings; changed: string[] }>(`${E}/settings`, { changes, confirmed: true, ...(confirmEngineOff ? { confirm_engine_off: true } : {}) });
export const attest = (version: number) => post<Wire.DwAttested>(`${E}/attestation`, { version, accepted: true, confirmed: true });

/** WKOPENUNK-295: one explicit new OPEN attempt for ONE door whose OPEN ended unknown; the person types the door's name (the server checks it) - never automatic. */
export const retryOpenDoor = (incidentId: string, stationId: string, relay: number, confirmDoor: string) =>
  post<{ incident: Incident }>(`${E}/incidents/${encodeURIComponent(incidentId)}/retry-open`, { station_id: stationId, relay, confirm_door: confirmDoor });

// ---------------------------------------------------------------- EMROLE-295: who holds the emergency-open role

export type GrantsView = Omit<Wire.DwGrants, 'scopes'> & { scopes: (Omit<Wire.DwGrantScope, 'scope_type'> & { scope_type: ScopeType })[] };

export const getEmergencyGrants = () => get<GrantsView>(`${E}/grants`);
/** Give the built-in emergency-open role to one person; `expires_at` is a UTC instant (Z), `noExpiry` is for a system administrator only. */
export const grantEmergencyOpen = (userId: string, scope: { scope_type: string; scope_id: string }, expiresAt: string | null, noExpiry: boolean) =>
  post<Wire.DwGrantOne>(`${E}/grants`, { user_id: userId, ...scope, expires_at: noExpiry ? null : expiresAt, no_expiry: noExpiry, confirmed: true });
export const revokeEmergencyGrant = (bindingId: string) => post<Wire.DwGrantRevoked>(`${E}/grants/${encodeURIComponent(bindingId)}/revoke`, { confirmed: true });
