/**
 * CR-031 GEN1 generator control: the ONLY module of the frontend that talks to `/api/v1/generator/...` (smplwise_vms/backend/smplwise/routers/generator.py)
 * and to the per-user preference `generator.view_mode`. View and alerts only: there is no call that sends anything to the controller.
 * Live values come by polling `/live` (no websocket). Entity ids are returned only by the two manage routes of the sensor mapping; the operator
 * screens speak in display names and role keys.
 */
import { get, post, put } from './client';

export type Availability = 'online' | 'offline' | 'stale';
export type DeviceStatus = 'detected' | 'partial' | 'unavailable' | 'removed';
export type Severity = 'critical' | 'alert' | 'info';
export type GenRange = '1h' | '24h' | '7d' | '30d' | 'custom';
export type ViewMode = 'gauges' | 'charts';

export interface GenValue {
  value: number | string | boolean | null;
  unit: string;
  available: boolean;
  updated_at: string | null;
  label: string;
}
export type GenValues = Record<string, GenValue>;

export interface GenAlertType {
  key: string;
  group: string;
  title: string;
  available: boolean;
  needs: string | null;
}

export interface GenDevice {
  id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  status: DeviceStatus;
  source_kind: string;
  rated_kw: number | null;
  rated_kva: number | null;
  fuel_type: string;
  detected_at: string | null;
  last_seen_at: string | null;
  revision: number;
  availability: Availability;
  stale: boolean;
  core_met: boolean;
  open_alerts: number;
  capabilities: {
    roles: string[];
    values: number;
    values_total: number;
    alert_types: number;
    alert_types_total: number;
    disabled_roles: string[];
    missing_core: string[];
    roles_detail?: { role: string; label: string; unit: string; core: boolean }[];
  };
  values?: GenValues;
  alert_types?: GenAlertType[];
  thresholds?: Record<string, number>;
}

export interface DevicesResponse {
  devices: GenDevice[];
  detected: number;
  partial: number;
  open_alerts: number;
  last_detect_at: string | null;
  /** GENLOG092-295 (additive): the run-log page is offered only while its switch is on (default off). */
  log_enabled?: boolean;
}

export interface LiveResponse {
  id: string;
  availability: Availability;
  stale: boolean;
  values: GenValues;
  at: string;
}

export interface HistoryPoint {
  t: number;
  v: number;
  min: number;
  max: number;
}
export interface HistoryResponse {
  step_s: number;
  source: 'raw' | 'rollup_5m';
  from: number;
  to: number;
  series: Record<string, HistoryPoint[]>;
  units: Record<string, string>;
  labels: Record<string, string>;
  range: GenRange;
}

export interface GenAlert {
  id: string;
  device_id: string;
  device_name: string | null;
  key: string;
  group: string | null;
  title: string;
  severity: Severity;
  state: 'open' | 'closed';
  raised_at: string;
  cleared_at: string | null;
  last_at: string;
  count: number;
  acknowledged: boolean;
  acked_by: string | null;
  acked_at: string | null;
  ack_note: string | null;
}
export interface AlertsResponse {
  alerts: GenAlert[];
  next_before: string | null;
  open_count: number;
}
export interface TimelineEntry {
  at: string;
  kind: 'raised' | 'escalated' | 'delivery_failed' | 'folded' | 'acknowledged' | 'cleared';
  step?: number | null;
  count?: number | null;
  channel?: string | null;
  by?: string | null;
  note?: string | null;
}
export interface GenAlertDetail extends GenAlert {
  snapshot: Record<string, unknown>;
  timeline: TimelineEntry[];
  muted_until: string | null;
}
export interface AlertsQuery {
  device_id?: string;
  state?: 'open' | 'closed';
  severity?: Severity;
  type?: string;
  ack?: boolean;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

export interface RoleCandidate {
  entity_id: string;
  name: string;
  unit: string | null;
  score: number;
}
export interface RoleItem {
  role: string;
  label: string;
  kind: string;
  unit: string;
  core: boolean;
  mapped: boolean;
  entity_id: string | null;
  entity_name: string | null;
  mapped_by: string | null;
  unmapped_by_user: boolean;
  disabled_in_source: boolean;
  candidates: RoleCandidate[];
}

export interface PolicyBodyValue {
  enabled: boolean;
  severity: Severity | null;
  recipients: { roles: string[]; users: string[] };
  channels: string[];
  quiet_mode: 'pass' | 'matrix' | 'hold';
  escalate: boolean;
  after_s: number;
  /** Seconds before an unacknowledged alert of this type goes to the system administrators (0 = the generator's critical delay). */
  escalate_after_s: number;
  row_version: number;
  /** The message text of this type for this generator; null = the built-in text. Sent only when edited. */
  template_he?: string | null;
}
export interface PolicyItem {
  key: string;
  group: string;
  title: string;
  title_en: string;
  default_severity: Severity;
  event: string;
  available: boolean;
  needs: string | null;
  message: string;
  /** The built-in text rendered with sample values. */
  message_sample?: string;
  policy: PolicyBodyValue | null;
}
/** The default recipients / channels of one severity on one generator; a type without its own inherits them. null = nothing chosen. */
export interface SeverityDefault {
  recipients: { roles: string[]; users: string[] };
  channels: string[];
  row_version: number;
}
export type SeverityDefaults = Record<Severity, SeverityDefault | null>;
export interface PoliciesResponse {
  groups: { key: string; title: string }[];
  items: PolicyItem[];
  available: number;
  total: number;
  channels: string[];
  channels_reserved: string[];
  quiet_modes: string[];
  note: string;
  severity_defaults: SeverityDefaults;
  /** The channels a severity default may carry (WhatsApp is chosen per alert type). */
  severity_channels: string[];
  /** Minutes before an unacknowledged CRITICAL alert goes to the system administrators. */
  critical_escalate_after_min: number;
  /** Placeholder -> Hebrew description (the server's list). */
  placeholders?: Record<string, string>;
  template_max?: number;
  roles: { id: string; label: string }[];
}
export type PolicyPatch = Partial<Omit<PolicyBodyValue, 'row_version'>> & { row_version?: number };

export interface GenSettings {
  integration_domains: string[];
  known_domains: string[];
  thresholds: Record<string, number>;
  threshold_defaults: Record<string, number>;
  threshold_limits: Record<string, [number, number]>;
  thresholds_set: string[];
  alert_retention_days: number;
  history_retention_days: number;
  stale_after_s: number;
  critical_escalate_after_min: number;
  limits: Record<string, [number, number]>;
  /** GENLOG092-295 (additive): the run-log switch, its settings in force and their specs. */
  log_enabled?: boolean;
  log?: Record<string, number | boolean>;
  log_specs?: Record<string, { type: 'int' | 'float' | 'bool'; default: number | boolean; min: number | null; max: number | null }>;
}

export interface DeviceCandidate {
  ha_device_id: string;
  name: string;
  entities: number;
  mapped_roles: number;
  registered: boolean;
}

const q = (o: Record<string, string | number | boolean | undefined | null>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listDevices = () => get<DevicesResponse>('generator/devices');
export const getDevice = (id: string) => get<GenDevice>(`generator/devices/${encodeURIComponent(id)}`);
export const getLive = (id: string) => get<LiveResponse>(`generator/devices/${encodeURIComponent(id)}/live`);
export const runDetect = () => post<{ found: unknown[]; count: number; last_detect_at: string | null }>('generator/devices/detect');
export const deviceCandidates = (text = '') => get<{ items: DeviceCandidate[] }>(`generator/device-candidates${q({ q: text })}`);
export const addDevice = (ha_device_id: string, name?: string) => post<GenDevice>('generator/devices', { ha_device_id, name });
export const updateDevice = (id: string, body: { name?: string; rated_kw?: number | null; rated_kva?: number | null; thresholds?: Record<string, number>; revision?: number }) =>
  put<GenDevice>(`generator/devices/${encodeURIComponent(id)}`, body);
export const getRoles = (id: string) => get<{ items: RoleItem[] }>(`generator/devices/${encodeURIComponent(id)}/roles`);
export const putRoles = (id: string, roles: Record<string, string | null>) => put<GenDevice>(`generator/devices/${encodeURIComponent(id)}/roles`, { roles });

export function getHistory(id: string, roles: string[], range: GenRange, from?: string, to?: string) {
  return get<HistoryResponse>(`generator/devices/${encodeURIComponent(id)}/history${q({ roles: roles.join(','), range, from, to })}`);
}

export const listAlerts = (o: AlertsQuery = {}) => get<AlertsResponse>(`generator/alerts${q({ ...o })}`);
export const getAlert = (id: string) => get<GenAlertDetail>(`generator/alerts/${encodeURIComponent(id)}`);
export const ackAlert = (id: string, note?: string) => post<GenAlertDetail>(`generator/alerts/${encodeURIComponent(id)}/ack`, note ? { note } : {});
export const muteAlert = (id: string, hours = 24) => post<{ muted_until: string }>(`generator/alerts/${encodeURIComponent(id)}/mute`, { hours });
export const ackAll = (deviceId: string) => post<{ acknowledged: number }>(`generator/devices/${encodeURIComponent(deviceId)}/alerts/ack-all`);

export const getPolicies = (id: string) => get<PoliciesResponse>(`generator/devices/${encodeURIComponent(id)}/policies`);
export const putPolicy = (id: string, key: string, patch: PolicyPatch) => put<PolicyItem['policy']>(`generator/devices/${encodeURIComponent(id)}/policies/${encodeURIComponent(key)}`, patch);
export const putSeverityRouting = (id: string, severity: Severity, patch: { recipients?: { roles: string[]; users: string[] }; channels?: string[]; row_version?: number }) =>
  put<SeverityDefault>(`generator/devices/${encodeURIComponent(id)}/severity-routing/${encodeURIComponent(severity)}`, patch);
export const resetPolicies = (id: string) => post<{ reset: number }>(`generator/devices/${encodeURIComponent(id)}/policies/reset`);

export const getSettings = () => get<GenSettings>('generator/settings');
export const putSettings = (patch: Partial<Pick<GenSettings, 'integration_domains' | 'thresholds' | 'alert_retention_days' | 'history_retention_days' | 'stale_after_s' | 'critical_escalate_after_min' | 'log_enabled' | 'log'>>) => put<GenSettings>('generator/settings', patch);

/** GENLOG092-295: the run log (start tests, mains-failure runs, run hours, fuel). Derived on the server from the controller's readings; read only. */
export type RunKind = 'test' | 'mains_failure' | 'manual' | 'other';
export type RunRange = '7d' | '30d' | '90d' | '365d';
export interface GenRun {
  id: string;
  kind: RunKind;
  kind_reason: string | null;
  started_at: string;
  ended_at: string | null;
  open: boolean;
  end_reason: string | null;
  duration_s: number;
  hours: number;
  hours_from_counter: boolean;
  took_load: boolean;
  fuel_used_pct: number | null;
  fuel_used_l: number | null;
  fuel_start_pct: number | null;
  fuel_end_pct: number | null;
  peak_load_pct: number | null;
  peak_kw: number | null;
  short: boolean;
}
export interface FuelEvent {
  id: string;
  kind: 'refill' | 'drop';
  started_at: string;
  ended_at: string;
  from_pct: number;
  to_pct: number;
  delta_pct: number;
}
export interface RunSummary {
  runs: number;
  by_kind: Record<RunKind, number>;
  run_s: number;
  hours: number;
  fuel_used_pct: number;
  fuel_used_l: number | null;
  refills: number;
  refilled_pct: number;
  drops: number;
  short_tests: number;
  last_test: GenRun | null;
  last_mains_failure: GenRun | null;
  test_interval_days: number;
  next_test_due: string | null;
  test_overdue: boolean;
  current: GenRun | null;
  counters: { run_hours: number | null; starts: number | null; fuel_pct: number | null; fuel_l: number | null };
}
export interface RunsResponse {
  runs: GenRun[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  fuel_events: FuelEvent[];
  summary: RunSummary;
  range: RunRange;
}
export const getRuns = (id: string, o: { range?: RunRange; kind?: RunKind | ''; page?: number; page_size?: number } = {}) =>
  get<RunsResponse>(`generator/devices/${encodeURIComponent(id)}/runs${q({ ...o })}`);

/** The user's own live presentation (PUT /me/prefs `generator.view_mode`): the dials or the charts, one at a time. Null = the default (gauges). */
export function normalizeViewMode(v: unknown): ViewMode {
  return v === 'charts' ? 'charts' : 'gauges';
}
export async function loadViewMode(): Promise<ViewMode> {
  const r = await get<{ prefs: Record<string, unknown> }>('me/prefs');
  return normalizeViewMode(r.prefs['generator.view_mode']);
}
export const saveViewMode = (mode: ViewMode) => put<unknown>('me/prefs', { 'generator.view_mode': mode });

export interface LiveSummaryItem {
  id: string;
  name: string;
  area_id: string | null;
  status: DeviceStatus;
  availability: Availability;
  stale: boolean;
  open_alerts: number;
  /** GENWIDGET 2.9.3 (additive; absent from an older server): the open critical alerts, and the mapped role keys (capability set, no entity ids). */
  open_critical?: number;
  roles?: string[];
  summary: Record<string, { value: number | string | boolean | null; unit: string }>;
}
/** One call for the picker of any number of generators and the home widget: availability, engine state, supply, mains, load, fuel and open alerts of each. */
export const listLive = () => get<{ devices: LiveSummaryItem[]; open_alerts: number; at: string }>('generator/devices/live');

/** The message as it would read with sample values; nothing is stored or sent (generator.manage). */
export const previewPolicy = (id: string, key: string, template_he: string | null) => post<{ text: string }>(`generator/devices/${encodeURIComponent(id)}/policies/${encodeURIComponent(key)}/preview`, { template_he });
