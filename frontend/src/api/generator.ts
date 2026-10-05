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
export interface PoliciesResponse {
  groups: { key: string; title: string }[];
  items: PolicyItem[];
  available: number;
  total: number;
  channels: string[];
  channels_reserved: string[];
  quiet_modes: string[];
  note: string;
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
  limits: Record<string, [number, number]>;
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
export const resetPolicies = (id: string) => post<{ reset: number }>(`generator/devices/${encodeURIComponent(id)}/policies/reset`);

export const getSettings = () => get<GenSettings>('generator/settings');
export const putSettings = (patch: Partial<Pick<GenSettings, 'integration_domains' | 'thresholds' | 'alert_retention_days' | 'history_retention_days' | 'stale_after_s'>>) => put<GenSettings>('generator/settings', patch);

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
  summary: Record<string, { value: number | string | boolean | null; unit: string }>;
}
/** One call for the picker of any number of generators: availability, engine state, load, fuel and open alerts of each. */
export const listLive = () => get<{ devices: LiveSummaryItem[]; open_alerts: number; at: string }>('generator/devices/live');

/** The message as it would read with sample values; nothing is stored or sent (generator.manage). */
export const previewPolicy = (id: string, key: string, template_he: string | null) => post<{ text: string }>(`generator/devices/${encodeURIComponent(id)}/policies/${encodeURIComponent(key)}/preview`, { template_he });
