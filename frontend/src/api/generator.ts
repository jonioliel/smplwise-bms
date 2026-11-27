/**
 * CR-031 GEN1 generator control: the ONLY module of the frontend that talks to `/api/v1/generator/...` (smplwise_vms/backend/smplwise/routers/generator.py)
 * and to the per-user preference `generator.view_mode`. View and alerts only: there is no call that sends anything to the controller.
 * Live values come by polling `/live` (no websocket). Entity ids are returned only by the two manage routes of the sensor mapping; the operator
 * screens speak in display names and role keys.
 */
import { api, get, post, put } from './client';
import type * as Wire from './generated/wire-generator';

export type Availability = 'online' | 'offline' | 'stale';
export type DeviceStatus = 'detected' | 'partial' | 'unavailable' | 'removed';
export type Severity = 'critical' | 'alert' | 'info';
export type GenRange = '1h' | '24h' | '7d' | '30d' | 'custom';
export type ViewMode = 'gauges' | 'charts';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/generator.py), generated into
 * ./generated/wire-generator.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: a live value (`value`: a number, an enum text or a bool by its role's kind), a device's `status` (DeviceStatus also names
 * the demo's `unavailable`), the alert timeline's `kind`, the history / run-log `range`, the settings' limit pairs ([low, high]).
 * Kept optional on purpose (an older server / the demo data lack them): the GENLOG092 / GENWIDGET additions (`log_enabled`, `log`,
 * `log_specs`, `open_critical`, `roles`), a policy's `message_sample` and `template_he` (sent only when edited). */
export interface GenValue extends Omit<Wire.GeneratorValue, 'value'> {
  value: number | string | boolean | null;
}
export type GenValues = Record<string, GenValue>;

export interface GenDevice extends Omit<Wire.GeneratorDevice, 'status' | 'values'> {
  status: DeviceStatus;
  values?: GenValues;
}

export interface DevicesResponse extends Omit<Wire.GeneratorDeviceList, 'devices' | 'log_enabled'> {
  devices: GenDevice[];
  /** GENLOG092-295 (additive): the run-log page is offered only while its switch is on (default off). */
  log_enabled?: boolean;
}

export interface LiveResponse extends Omit<Wire.GeneratorLive, 'values'> {
  values: GenValues;
}

export type HistoryPoint = Wire.GeneratorHistoryPoint;
export interface HistoryResponse extends Omit<Wire.GeneratorHistory, 'range'> {
  range: GenRange;
}

export type GenAlert = Wire.GeneratorAlert;
type AlertsResponse = Wire.GeneratorAlertList;
export interface TimelineEntry {
  at: string;
  kind: 'raised' | 'escalated' | 'delivery_failed' | 'folded' | 'acknowledged' | 'cleared';
  step?: number | null;
  count?: number | null;
  channel?: string | null;
  by?: string | null;
  note?: string | null;
}
export interface GenAlertDetail extends Omit<Wire.GeneratorAlertDetail, 'timeline'> {
  timeline: TimelineEntry[];
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

export type RoleItem = Wire.GeneratorRoleMapping;

/** `escalate_after_s`: seconds before an unacknowledged alert of this type goes to the system administrators (0 = the generator's
 * critical delay). `template_he`: the message text of this type for this generator; null = the built-in text. Sent only when edited. */
export interface PolicyBodyValue extends Omit<Wire.GeneratorPolicy, 'severity' | 'template_he'> {
  /** The routing editor's draft starts with null = the type's default severity (the server always answers one). */
  severity: Severity | null;
  template_he?: string | null;
}
/** `message_sample`: the built-in text rendered with sample values. */
export interface PolicyItem extends Omit<Wire.GeneratorPolicyItem, 'message_sample' | 'policy'> {
  message_sample?: string;
  policy: PolicyBodyValue | null;
}
/** The default recipients / channels of one severity on one generator; a type without its own inherits them. null = nothing chosen. */
type SeverityDefault = Wire.GeneratorSeverityRouting;
export type SeverityDefaults = Record<Severity, SeverityDefault | null>;
/** `severity_channels`: the channels a severity default may carry (WhatsApp is chosen per alert type). `critical_escalate_after_min`:
 * minutes before an unacknowledged CRITICAL alert goes to the system administrators. `placeholders`: placeholder -> Hebrew description. */
export interface PoliciesResponse extends Omit<Wire.GeneratorPolicies, 'items' | 'severity_defaults' | 'placeholders' | 'template_max'> {
  items: PolicyItem[];
  severity_defaults: SeverityDefaults;
  placeholders?: Record<string, string>;
  template_max?: number;
}
type PolicyPatch = Partial<Omit<PolicyBodyValue, 'row_version'>> & { row_version?: number };

export interface GenSettings extends Omit<Wire.GeneratorSettings, 'threshold_limits' | 'limits' | 'log_enabled' | 'log' | 'log_specs'> {
  threshold_limits: Record<string, [number, number]>;
  limits: Record<string, [number, number]>;
  /** GENLOG092-295 (additive): the run-log switch, its settings in force and their specs. */
  log_enabled?: boolean;
  log?: Wire.GeneratorSettings['log'];
  log_specs?: Wire.GeneratorSettings['log_specs'];
}

export type DeviceCandidate = Wire.GeneratorDeviceCandidate;

const q = (o: Record<string, string | number | boolean | undefined | null>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listDevices = () => get<DevicesResponse>('generator/devices');
export const getDevice = (id: string) => get<GenDevice>(`generator/devices/${encodeURIComponent(id)}`);
export const getLive = (id: string) => get<LiveResponse>(`generator/devices/${encodeURIComponent(id)}/live`);
export const runDetect = () => post<Wire.GeneratorDetect>('generator/devices/detect');
export const deviceCandidates = (text = '') => get<Wire.GeneratorDeviceCandidates>(`generator/device-candidates${q({ q: text })}`);
export const addDevice = (ha_device_id: string, name?: string) => post<GenDevice>('generator/devices', { ha_device_id, name });
// DATA-RULES-2-2550: `battery_nominal_v` - the starter battery's system (12 / 24; null = automatic, the default)
export const updateDevice = (id: string, body: { name?: string; rated_kw?: number | null; rated_kva?: number | null; thresholds?: Record<string, number>; battery_nominal_v?: 12 | 24 | null; revision?: number }) =>
  put<GenDevice>(`generator/devices/${encodeURIComponent(id)}`, body);
export const getRoles = (id: string) => get<Wire.GeneratorRoleMappings>(`generator/devices/${encodeURIComponent(id)}/roles`);
export const putRoles = (id: string, roles: Record<string, string | null>) => put<GenDevice>(`generator/devices/${encodeURIComponent(id)}/roles`, { roles });

export function getHistory(id: string, roles: string[], range: GenRange, from?: string, to?: string) {
  return get<HistoryResponse>(`generator/devices/${encodeURIComponent(id)}/history${q({ roles: roles.join(','), range, from, to })}`);
}

export const listAlerts = (o: AlertsQuery = {}) => get<AlertsResponse>(`generator/alerts${q({ ...o })}`);
export const getAlert = (id: string) => get<GenAlertDetail>(`generator/alerts/${encodeURIComponent(id)}`);
export const ackAlert = (id: string, note?: string) => post<GenAlertDetail>(`generator/alerts/${encodeURIComponent(id)}/ack`, note ? { note } : {});
export const muteAlert = (id: string, hours = 24) => post<Wire.GeneratorMuted>(`generator/alerts/${encodeURIComponent(id)}/mute`, { hours });
/** RELEASE-2540-TRAIN (DATA-RULES-2540 D-03): end the mute of the alert's type now (generator.view; idempotent); answers the alert detail. */
export const unmuteAlert = (id: string) => api<GenAlertDetail>(`generator/alerts/${encodeURIComponent(id)}/mute`, { method: 'DELETE' });
export const ackAll = (deviceId: string) => post<Wire.GeneratorAcknowledged>(`generator/devices/${encodeURIComponent(deviceId)}/alerts/ack-all`);

export const getPolicies = (id: string) => get<PoliciesResponse>(`generator/devices/${encodeURIComponent(id)}/policies`);
export const putPolicy = (id: string, key: string, patch: PolicyPatch) => put<PolicyItem['policy']>(`generator/devices/${encodeURIComponent(id)}/policies/${encodeURIComponent(key)}`, patch);
export const putSeverityRouting = (id: string, severity: Severity, patch: { recipients?: { roles: string[]; users: string[] }; channels?: string[]; row_version?: number }) =>
  put<SeverityDefault>(`generator/devices/${encodeURIComponent(id)}/severity-routing/${encodeURIComponent(severity)}`, patch);
export const resetPolicies = (id: string) => post<Wire.GeneratorPoliciesReset>(`generator/devices/${encodeURIComponent(id)}/policies/reset`);

export const getSettings = () => get<GenSettings>('generator/settings');
export const putSettings = (patch: Partial<Pick<GenSettings, 'integration_domains' | 'thresholds' | 'alert_retention_days' | 'history_retention_days' | 'stale_after_s' | 'critical_escalate_after_min' | 'log_enabled' | 'log'>>) => put<GenSettings>('generator/settings', patch);

/** GENLOG092-295: the run log (start tests, mains-failure runs, run hours, fuel). Derived on the server from the controller's readings; read only. */
export type RunKind = 'test' | 'mains_failure' | 'manual' | 'other';
export type RunRange = '7d' | '30d' | '90d' | '365d';
export interface GenRun extends Omit<Wire.GeneratorRun, 'kind'> {
  kind: RunKind;
}
export interface RunsResponse extends Omit<Wire.GeneratorRuns, 'runs' | 'summary' | 'range'> {
  runs: GenRun[];
  summary: Omit<Wire.GeneratorRunSummary, 'by_kind' | 'last_test' | 'last_mains_failure' | 'current'> & {
    by_kind: Record<RunKind, number>;
    last_test: GenRun | null;
    last_mains_failure: GenRun | null;
    current: GenRun | null;
  };
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

export interface LiveSummaryItem extends Omit<Wire.GeneratorLiveBrief, 'status' | 'open_critical' | 'roles' | 'summary'> {
  status: DeviceStatus;
  /** GENWIDGET 2.9.3 (additive; absent from an older server): the open critical alerts, and the mapped role keys (capability set, no entity ids). */
  open_critical?: number;
  roles?: string[];
  summary: Record<string, Omit<Wire.GeneratorSummaryValue, 'value'> & { value: GenValue['value'] }>;
}
/** One call for the picker of any number of generators and the home widget: availability, engine state, supply, mains, load, fuel and open alerts of each. */
export const listLive = () => get<Omit<Wire.GeneratorLiveAll, 'devices'> & { devices: LiveSummaryItem[] }>('generator/devices/live');

/** The message as it would read with sample values; nothing is stored or sent (generator.manage). */
export const previewPolicy = (id: string, key: string, template_he: string | null) => post<Wire.GeneratorPreview>(`generator/devices/${encodeURIComponent(id)}/policies/${encodeURIComponent(key)}/preview`, { template_he });
