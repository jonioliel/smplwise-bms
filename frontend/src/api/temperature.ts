/**
 * CR-INFRA-TEMPERATURE 2.9.1: the ONLY module of the frontend that talks to `/api/v1/infra/temperature...`
 * (smplwise_vms/backend/smplwise/routers/temperature.py). Read-only against the infrastructure: nothing is ever sent to a device.
 * Operator routes carry friendly sensor names; entity ids come only to holders of infra.temperature.manage (owner decision 7).
 */
import { ApiError, apiUrl, del, get, post, put, type ApiErrorBody } from './client';
import { dispositionName, saveBlob } from './tickets-costs';

export type UnitKind = 'fridge' | 'freezer' | 'coldroom' | 'pharma' | 'server' | 'room';
export const UNIT_KINDS: readonly UnitKind[] = ['fridge', 'freezer', 'coldroom', 'pharma', 'server', 'room'];
/** off = a climate unit switched off (a state, not an alarm; owner 2026-10-19) */
export type UnitStatus = 'ok' | 'warning' | 'alarm' | 'offline' | 'off' | 'unknown';
export type BandMode = 'fixed' | 'setpoint';
export type SourceKind = 'sensor' | 'climate';
export interface Hvac {
  setpoint: number | null;
  setpoint_low: number | null;
  setpoint_high: number | null;
  hvac_mode: string | null;
  hvac_action: string | null;
}
export type EventKind = 'high' | 'low' | 'door' | 'offline' | 'defrost' | 'ack' | 'mute';
export type Severity = 'info' | 'warning' | 'alarm';
export type DefrostMode = 'fixed' | 'learn' | 'none';
export type DefrostState = 'learning' | 'learned' | 'none_found' | 'fixed' | 'none';
export type RangeKey = '24h' | '7d' | '30d' | 'custom';

export interface TempEvent {
  id: string;
  unit_id: string;
  unit_name?: string;
  kind: EventKind;
  severity: Severity;
  started_at: string;
  warned_at: string | null;
  alarmed_at: string | null;
  ended_at: string | null;
  value: number | null;
  peak: number | null;
  threshold: number | null;
  suppressed: 'quiet' | 'mute' | 'defrost' | 'off' | null;
  ack_at: string | null;
  ack_by_name: string | null;
  notified: boolean;
  /** for an open warning: when it turns into an alarm if it does not end (null = the alarm is off) */
  alarm_at?: string | null;
  detail: { minutes?: number; until?: string; hard_max?: boolean; window?: boolean; closed?: string };
}

export interface DefrostWindow {
  start_min: number;
  minutes: number;
  status: 'fixed' | 'learned' | 'confirmed' | 'rejected';
  repeats?: number;
}

export interface UnitRules {
  warn_on_excursion: boolean;
  high_alarm: boolean;
  high_alarm_min: number;
  low_alarm: boolean;
  low_alarm_min: number;
  door_alarm: boolean;
  door_alarm_min: number;
  offline_warn: boolean;
  offline_min: number;
  quiet_enabled: boolean;
  quiet_from: string;
  quiet_to: string;
  exclude_defrost_stats: boolean;
  setpoint_tolerance: number;
  alert_when_off: boolean;
  learn_min_repeats?: number;
  learn_days?: number;
}

export interface Stats {
  min: number | null;
  max: number | null;
  avg: number | null;
  out_min: number;
  out_min_raw: number;
  door_opens: number;
  door_total_min: number;
  door_longest_min: number;
  alarms: number;
  warnings: number;
}

export interface TempUnit {
  id: string;
  name: string;
  kind: UnitKind;
  area_id: string | null;
  area_name: string | null;
  low: number;
  high: number;
  hard_max: number;
  band_mode: BandMode;
  /** a sensor, or a climate entity (current temperature + setpoint + mode / action) */
  source: SourceKind;
  hvac: Hvac | null;
  status: UnitStatus;
  value: number | null;
  /** the last recorded reading while the infrastructure is disconnected (shown grey) */
  value_last: number | null;
  updated_at: string | null;
  trend: 'up' | 'down' | 'flat' | null;
  temp_sensor_name: string;
  door: { open: boolean | null; since: string | null; sensor_name: string } | null;
  events: TempEvent[];
  defrost: { mode: DefrostMode; in_window: boolean; next_at: string | null; state: DefrostState; days: number; windows: DefrostWindow[] };
  muted_until: string | null;
  rules: UnitRules;
  stats_24h: Stats;
  stale: boolean;
  /** [ts (unix s), value] five-minute points of the last 24 h; a climate unit adds the setpoint: [ts, value, setpoint] */
  spark?: ([number, number] | [number, number, number | null])[];
  doors_24h?: [number, number][];
  defrost_24h?: [number, number][];
  /** managers only */
  temp_entity_id?: string;
  door_entity_id?: string | null;
}

export interface UnitsResponse {
  units: TempUnit[];
  summary: Record<UnitStatus, number>;
  stale: boolean;
  at: string;
  can_manage: boolean;
  can_ack: boolean;
}

export interface HistoryResponse {
  from: number;
  to: number;
  step: number;
  source: 'raw' | '5m';
  /** [ts, avg, min, max, defrost 0/1, setpoint (climate units; null otherwise)] */
  points: [number, number, number, number, number, number | null][];
  low: number;
  high: number;
  doors: [number, number][];
  defrost: [number, number][];
  stats: Stats;
  zone: string;
}

export interface Recipients {
  roles: string[];
  users: string[];
  groups: string[];
}

export interface ManagedUnit {
  id: string;
  name: string;
  kind: UnitKind;
  area_id: string | null;
  enabled: boolean;
  sort_order: number;
  revision: number;
  temp_entity_id: string;
  temp_sensor_name: string;
  temp_missing: boolean;
  door_entity_id: string | null;
  door_sensor_name: string;
  door_missing: boolean;
  door_invert: boolean;
  low: number;
  high: number;
  band_mode: BandMode;
  source: SourceKind;
  rules: Partial<Record<string, boolean | number | string>>;
  recipients: Recipients | null;
  defrost_mode: DefrostMode;
  defrost_windows: { start: string; minutes: number }[];
}

export interface RuleSpec {
  type: 'bool' | 'int' | 'float' | 'hhmm';
  min: number | null;
  max: number | null;
}

export interface ManageResponse {
  units: ManagedUnit[];
  defaults: Record<string, boolean | number | string>;
  rule_specs: Record<string, RuleSpec>;
  kinds: UnitKind[];
  templates: Record<string, [number, number]>;
  areas: { area_id: string; name: string; floor_name: string | null }[];
}

export interface Candidate {
  entity_id: string;
  name: string;
  device_class: string | null;
  area_name: string | null;
  value: number | null;
  state: 'on' | 'off' | null;
  /** temp candidates: `sensor` or `climate` (grouped in the wizard); door candidates: `door` */
  group: 'sensor' | 'climate' | 'door';
  setpoint: number | null;
  hvac_mode: string | null;
}

export interface UnitBody {
  name: string;
  area_id?: string | null;
  kind: UnitKind;
  temp_entity_id: string;
  door_entity_id?: string | null;
  door_invert?: boolean;
  low: number;
  high: number;
  band_mode?: BandMode;
  rules?: Record<string, boolean | number | string | null>;
  recipients?: Recipients | null;
  defrost_mode: DefrostMode;
  defrost_windows?: { start: string; minutes: number }[];
  enabled?: boolean;
  revision?: number;
}

export interface SettingsResponse {
  rules: Record<string, boolean | number | string>;
  code_defaults: Record<string, boolean | number | string>;
  row_version: number;
  rule_specs: Record<string, RuleSpec>;
}

export type AlertKind = 'alarm' | 'warning' | 'offline';
export type AlertChannel = 'push' | 'app' | 'email' | 'whatsapp';
export interface AlertKindSettings {
  enabled: boolean;
  recipients: Recipients;
  channels: AlertChannel[];
}
export interface AlertSettings {
  kinds: Record<AlertKind, AlertKindSettings>;
  row_version: number;
  roles: { id: string; label: string }[];
  channels: AlertChannel[];
  kinds_order: AlertKind[];
  can_edit: boolean;
}

export interface LogQuery {
  unit?: string;
  kind?: string;
  severity?: string;
  range?: RangeKey;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const B = 'infra/temperature';
const enc = encodeURIComponent;

export function logQs(q: LogQuery, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const listUnits = (spark = true) => get<UnitsResponse>(spark ? B : `${B}?spark=0`);
export const getUnit = (id: string) => get<TempUnit>(`${B}/${enc(id)}`);
export const getHistory = (id: string, range: RangeKey, from?: string, to?: string, points = 600) =>
  get<HistoryResponse>(`${B}/${enc(id)}/history${logQs({ range, from, to }, { points: String(points) })}`);
export const listEvents = (q: LogQuery) => get<{ events: TempEvent[]; total: number }>(`${B}/events${logQs(q)}`);
export const ackUnit = (id: string, eventId?: string) => post<{ acked: number; at: string }>(`${B}/${enc(id)}/ack`, eventId ? { event_id: eventId } : {});
export const muteUnit = (id: string, body: { minutes?: number; until_defrost_end?: boolean }) => post<{ muted_until: string }>(`${B}/${enc(id)}/mute`, body);
export const unmuteUnit = (id: string) => del(`${B}/${enc(id)}/mute`);

export const listManaged = () => get<ManageResponse>(`${B}/manage`);
export const listCandidates = (kind: 'temp' | 'door', q = '') => get<{ items: Candidate[] }>(`${B}/candidates${logQs({}, q ? { kind, q } : { kind })}`);
export const createUnit = (body: UnitBody) => post<ManagedUnit>(B, body);
export const updateUnit = (id: string, body: UnitBody) => put<ManagedUnit>(`${B}/${enc(id)}`, body);
export const deleteUnit = (id: string) => del(`${B}/${enc(id)}`);
export const reorderUnits = (ids: string[]) => put<ManageResponse>(`${B}/order`, { ids });
export const getSettings = () => get<SettingsResponse>(`${B}/settings`);
export const putSettings = (rules: Record<string, unknown>, row_version?: number) => put<SettingsResponse>(`${B}/settings`, { rules, row_version });
export const getAlertSettings = () => get<AlertSettings>(`${B}/alerts`);
export const putAlertSettings = (body: { kinds?: Partial<Record<AlertKind, Partial<AlertKindSettings>>>; row_version?: number }) => put<AlertSettings>(`${B}/alerts`, body);
export const decideWindow = (id: string, startMin: number, decision: 'confirm' | 'reject') => post<{ windows: DefrostWindow[] }>(`${B}/${enc(id)}/defrost/${startMin}/${decision}`);
export const clearLearned = (id: string) => del(`${B}/${enc(id)}/defrost/learned`);

/** The alert log as CSV (the browser's own download). */
export async function downloadLogCsv(q: LogQuery, lang: 'he' | 'en' = 'he'): Promise<void> {
  const res = await fetch(apiUrl(`${B}/events.csv${logQs({ ...q, limit: undefined, offset: undefined }, { lang })}`), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(res.status, body ?? { code: `http_${res.status}`, user_message: res.statusText, retryable: false, correlation_id: '', details: {} });
  }
  saveBlob(await res.blob(), dispositionName(res.headers.get('Content-Disposition'), 'temperature-log.csv'));
}
