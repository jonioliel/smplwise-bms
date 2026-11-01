/**
 * CR-INFRA-TEMPERATURE 2.9.1: the ONLY module of the frontend that talks to `/api/v1/infra/temperature...`
 * (smplwise_vms/backend/smplwise/routers/temperature.py). Read-only against the infrastructure: nothing is ever sent to a device.
 * Operator routes carry friendly sensor names; entity ids come only to holders of infra.temperature.manage (owner decision 7).
 */
import { api, ApiError, apiUrl, del, get, post, put, type ApiErrorBody } from './client';
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
/** phase 3: predict (an early warning), battery / frozen / recovery / duty (health), maint / escalate / ticket (acts) */
export type EventKind = 'high' | 'low' | 'door' | 'offline' | 'defrost' | 'ack' | 'mute' | 'predict' | 'battery' | 'frozen' | 'recovery' | 'duty' | 'maint' | 'escalate' | 'ticket';
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
  suppressed: 'quiet' | 'mute' | 'defrost' | 'off' | 'maintenance' | null;
  ack_at: string | null;
  ack_by_name: string | null;
  notified: boolean;
  /** for an open warning: when it turns into an alarm if it does not end (null = the alarm is off) */
  alarm_at?: string | null;
  detail: {
    minutes?: number; until?: string; hard_max?: boolean; window?: boolean; closed?: string;
    /** phase 3 */
    reason?: string; ended_early?: boolean; level?: number; of?: string; side?: 'high' | 'low'; eta_min?: number; rate_h?: number; battery?: number | null;
    median_recovery_min?: number | null; recent?: number | null; before?: number | null; number?: number; absorbed?: boolean;
  };
  /** phase 3: how many steps of the escalation chain this alarm reached; the service ticket opened from it */
  escalation_level?: number;
  ticket_id?: string | null;
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
  alerts_enabled?: boolean;
  quiet_includes_alarms?: boolean;
  mute_includes_alarms?: boolean;
  learn_days?: number;
  /** phase 3 (every one a setting: installation default + per unit) */
  predict_enabled?: boolean;
  predict_horizon_min?: number;
  predict_warn?: boolean;
  /** owner 2026-10-20: the early warning's lead time (minutes before the projected crossing) */
  predict_warn_min?: number;
  maintenance_includes_alarms?: boolean;
  maintenance_max_min?: number;
  escalation_enabled?: boolean;
  health_warn?: boolean;
  battery_low_pct?: number;
  frozen_min?: number;
  recovery_slow_min?: number;
  recovery_alert?: boolean;
  compressor_on_w?: number;
  duty_rise_pts?: number;
  duty_alert?: boolean;
}

/** Phase 3 (idea 5): the projection of the slope of the last 30 minutes towards an edge of the band. */
export interface Prediction {
  side: 'high' | 'low';
  threshold: number;
  eta_min: number;
  rate_h: number;
}
/** Phase 3 (idea 8): the temperature sensor's own device - battery, signal, reading age, a frozen value; `issues` adds recovery / duty. */
export type HealthIssue = 'battery' | 'frozen' | 'signal' | 'recovery' | 'duty';
export interface Health {
  battery: number | null;
  battery_low: boolean;
  signal: number | null;
  signal_unit: 'dBm' | 'lqi' | null;
  signal_weak: boolean;
  age_min: number | null;
  frozen_since: string | null;
  issues: HealthIssue[];
}
export interface DoorEffect {
  opened: number;
  closed: number;
  open_min: number;
  base: number;
  peak: number;
  rise: number;
  recovery_min: number | null;
  interrupted: boolean;
}
export interface DoorInsight {
  opens: number;
  avg_rise: number | null;
  max_rise: number | null;
  median_recovery_min: number | null;
  unrecovered: number;
  slow: boolean;
  last: DoorEffect[];
}
export interface DutyInsight {
  recent: number | null;
  before: number | null;
  rising: boolean;
  today: number | null;
  pct_24h: number | null;
  days: { day: string; pct: number | null; minutes: number }[];
}
/** Phase 3 (ideas 2 and 6): recomputed hourly from the stored history. */
export interface Insights {
  door: DoorInsight | null;
  duty: DutyInsight | null;
  computed_at: string | null;
}
export interface Maintenance {
  until: string;
  reason: string;
  by_name: string | null;
}
export interface LinkedTicket {
  ticket_id: string;
  number: number;
  event_id: string | null;
  status: string | null;
  created_at: string;
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
  power_entity_id?: string | null;
  /** phase 3 (an older server: absent) */
  floor_id?: string | null;
  floor_name?: string | null;
  floor_level?: number | null;
  prediction?: Prediction | null;
  health?: Health;
  insights?: Insights;
  power?: { w: number | null; on: boolean | null; sensor_name: string } | null;
  maintenance?: Maintenance | null;
  tickets?: LinkedTicket[];
}

export interface UnitsResponse {
  units: TempUnit[];
  summary: Record<UnitStatus, number>;
  stale: boolean;
  at: string;
  can_manage: boolean;
  can_ack: boolean;
  /** phase 3: the grid's grouping (idea 7) and whether the home widget is offered (idea 12) */
  grouping?: 'area' | 'none';
  home_widget?: boolean;
  ticket_department_id?: string | null;
  /** TEMPEXPLAIN093-295 (additive): the "why?" explanation of an excursion is offered (installation setting explain_enabled) */
  explain?: boolean;
}

/** TEMPEXPLAIN093-295: one factor of a rule-based excursion explanation - a key (the words live in i18n/temperature), its score and its evidence. */
export type ExplainKey = 'maint' | 'defrost' | 'door' | 'outage' | 'compressor_off' | 'compressor_no_power' | 'compressor_on' | 'unit_off' | 'setpoint' | 'gap' | 'spike' | 'shared' | 'local' | 'gradual';
export interface ExplainFactor {
  key: ExplainKey;
  score: number;
  vars: Record<string, string | number | boolean | null | string[]>;
}
export interface Explanation {
  unit_id: string;
  event_id: string | null;
  kind: 'high' | 'low';
  started_at: string | null;
  ended_at: string | null;
  peak: number | null;
  factors: ExplainFactor[];
  primary: ExplainKey | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason: 'no_samples' | null;
  profile: { rate_h: number | null; duration_min: number; ongoing: boolean } | null;
  generated_at: string;
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
  /** phase 3: a smart plug / current meter (read only) for the compressor duty cycle */
  power_entity_id?: string | null;
  power_sensor_name?: string;
  power_missing?: boolean;
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
  type: 'bool' | 'int' | 'float' | 'hhmm' | 'choice' | 'id' | 'text' | 'ids';
  min: number | null;
  max: number | null;
  choices?: string[];
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
  /** temp candidates: `sensor` or `climate` (grouped in the wizard); door candidates: `door`; phase 3 power candidates: `power` */
  group: 'sensor' | 'climate' | 'door' | 'power';
  setpoint: number | null;
  hvac_mode: string | null;
  watts?: number | null;
}

export interface UnitBody {
  name: string;
  area_id?: string | null;
  kind: UnitKind;
  temp_entity_id: string;
  door_entity_id?: string | null;
  door_invert?: boolean;
  power_entity_id?: string | null;
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
  rules: Record<string, boolean | number | string | string[]>;
  code_defaults: Record<string, boolean | number | string | string[]>;
  row_version: number;
  rule_specs: Record<string, RuleSpec>;
}

export type AlertKind = 'alarm' | 'warning' | 'offline' | 'health';
export type AlertChannel = 'push' | 'app' | 'email' | 'whatsapp';
export interface AlertKindSettings {
  enabled: boolean;
  recipients: Recipients;
  channels: AlertChannel[];
}
/** Phase 3 (idea 4): an alarm nobody acknowledged climbs a tier per step (its own notification and log row). */
export interface EscalationStep {
  after_min: number;
  recipients: Recipients;
}
export interface Escalation {
  enabled: boolean;
  channels: AlertChannel[];
  steps: EscalationStep[];
}
export interface AlertSettings {
  kinds: Record<AlertKind, AlertKindSettings>;
  /** an older server: absent */
  escalation?: Escalation;
  steps_max?: number;
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
export const listCandidates = (kind: 'temp' | 'door' | 'power', q = '') => get<{ items: Candidate[] }>(`${B}/candidates${logQs({}, q ? { kind, q } : { kind })}`);
export const createUnit = (body: UnitBody) => post<ManagedUnit>(B, body);
export const updateUnit = (id: string, body: UnitBody) => put<ManagedUnit>(`${B}/${enc(id)}`, body);
export const deleteUnit = (id: string) => del(`${B}/${enc(id)}`);
export const reorderUnits = (ids: string[]) => put<ManageResponse>(`${B}/order`, { ids });
export const getSettings = () => get<SettingsResponse>(`${B}/settings`);
export const putSettings = (rules: Record<string, unknown>, row_version?: number) => put<SettingsResponse>(`${B}/settings`, { rules, row_version });
export const getAlertSettings = () => get<AlertSettings>(`${B}/alerts`);
export const putAlertSettings = (body: { kinds?: Partial<Record<AlertKind, Partial<AlertKindSettings>>>; escalation?: Partial<Escalation>; row_version?: number }) =>
  put<AlertSettings>(`${B}/alerts`, body);
export const decideWindow = (id: string, startMin: number, decision: 'confirm' | 'reject') => post<{ windows: DefrostWindow[] }>(`${B}/${enc(id)}/defrost/${startMin}/${decision}`);
export const clearLearned = (id: string) => del(`${B}/${enc(id)}/defrost/learned`);
/** phase 3 (idea 9): the maintenance window - a reason and who; holds WARNINGS (alarms only when the setting says so) */
export const startMaintenance = (id: string, minutes: number, reason: string) => post<{ maintenance: Maintenance }>(`${B}/${enc(id)}/maintenance`, { minutes, reason });
export const endMaintenance = (id: string) => del(`${B}/${enc(id)}/maintenance`);
/** TEMPEXPLAIN093-295: why an excursion happened (an alert-log row, or a moment). Read only, rule-based. */
export const getExplanation = (id: string, o: { eventId?: string; at?: string }) =>
  get<Explanation>(`${B}/${enc(id)}/explain${logQs({}, o.eventId ? { event_id: o.eventId } : { at: o.at ?? '' })}`);
/** phase 3 (idea 11): a service ticket from the unit or one of its alert rows */
export interface TicketDraft {
  title: string;
  description: string;
  departments: { id: string; name: string }[];
  department_id: string | null;
  attach_chart: boolean;
}
export const getTicketDraft = (id: string, eventId?: string | null, lang: 'he' | 'en' = 'he') =>
  get<TicketDraft>(`${B}/${enc(id)}/ticket/draft${logQs({}, eventId ? { event_id: eventId, lang } : { lang })}`);
export const openTicket = (id: string, body: { department_id: string; title?: string; description?: string; event_id?: string | null; attach_chart?: boolean; lang?: 'he' | 'en' }) =>
  post<{ ticket_id: string; number: number; result: 'created' | 'absorbed'; chart_attached: boolean }>(`${B}/${enc(id)}/ticket`, body);

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

// ---------------------------------------------------------------- phase 2: the report (PDF) and the WhatsApp text summary

export type ReportRange = '24h' | 'week' | '7d' | 'month' | '30d' | 'prev_week' | 'prev_month' | 'custom';
export interface ReportParams {
  units: string[];
  range: ReportRange;
  from?: string;
  to?: string;
  lang: 'he' | 'en';
  chart?: boolean;
  events?: boolean;
  signature?: boolean;
  /** phase 3 (idea 3): the HACCP compliance layout - a daily table per unit */
  layout?: 'standard' | 'haccp';
  /** TEMPREP-295: append the list of every recorded sample (capped on the server) */
  samples?: boolean;
  /** TEMPVENDOR-295: the text as a vendor gets it (no "available in the system" note) */
  external?: boolean;
}
export interface ReportUnit {
  id: string;
  name: string;
  area: string | null;
  low: number;
  high: number;
  band_mode: BandMode;
  tolerance: number | null;
  source: SourceKind;
  sensor: string;
  door: string | null;
  excl_defrost: boolean;
  /** TEMPREP-295: false = no sample at all in the range (an honest empty report, not a broken one) */
  has_data?: boolean;
  stats: Stats;
  points?: [number, number, number | null][];
  doors?: [number, number][];
  defrost?: [number, number][];
  events?: { kind: EventKind; severity: Severity; started_at: string; ended_at: string | null; value: number | null; peak: number | null; threshold: number | null; reason?: string | null; by_name?: string | null }[];
  events_more?: number;
  /** TEMPREP-295: every recorded sample (the dialog's preview holds only the first rows; total / shown are true): [instant, value, flags]
   * with the flag bits 1 defrost, 2 door open, 4 switched off, 8 out of range, 16 alert open, 32 five-minute average (older than the raw history) */
  samples?: { rows: [number, number, number][]; total: number; shown: number; capped: boolean; cap: number };
  /** phase 3: the HACCP daily table (layout haccp only) */
  daily?: { day: string; min: number | null; max: number | null; avg: number | null; out_min: number; out_min_raw: number; alarms: number; door_opens: number | null; coverage: number; verdict: 'ok' | 'exc' | 'none' }[];
}
export interface ReportModel {
  v: number;
  lang: 'he' | 'en';
  from: number;
  to: number;
  zone: string;
  generated: number;
  units: ReportUnit[];
  chart: boolean;
  events: boolean;
  /** a LINE only today (owner decision 4); a future electronic signature is a new mode */
  signature: { mode: 'line' } | null;
  layout?: 'standard' | 'haccp';
  samples?: boolean;
  digest: string;
  range_text: string;
  text_summary: string;
  filename: string;
}
export interface ReportRecipient {
  id: string;
  name: string;
  /** users: whether the summary can reach them (warned, still selectable) */
  reach?: 'ok' | 'no_address' | 'no_consent';
  company?: string | null;
  has_phone?: boolean;
  selectable: boolean;
  /** vendors: `coming_later` while vendor reports are off; else why no channel can carry the report (no_whatsapp | no_email | no_contact) */
  reason?: string | null;
  /** vendors, while vendor reports are on: per channel `ok` or the reason (no_whatsapp | no_email | reports_email_off | no_contact) */
  channels?: Partial<Record<VendorChannel, string>>;
  /** vendors: the channel offered first */
  channel?: VendorChannel;
}
export type VendorChannel = 'whatsapp' | 'email';
export interface RecipientPick {
  kind: 'user' | 'vendor';
  id: string;
  /** vendors only: the channel chosen for this report (never switched automatically) */
  channel?: VendorChannel;
}
export interface RecipientsResponse {
  users: ReportRecipient[];
  vendors: ReportRecipient[];
  send_hours: { from: string; to: string };
  attachment: string;
  /** TEMPREPORT-297: the summary to a system user carries a temporary link to his PDF (mode on and this sender may send links) */
  user_attachment?: string;
  attachment_modes: string[];
  /** TEMPVENDOR-295: vendor reports on / e-mail on (both off by default) */
  vendor_reports?: { enabled: boolean; email: boolean };
}
export interface SendRow {
  id: string;
  name: string;
  status: 'queued' | 'held' | 'retry' | 'handed' | 'sent' | 'failed' | 'skipped';
  reason: string | null;
  kind?: 'vendor';
  channel?: VendorChannel | null;
  not_before: string;
  finished_at: string | null;
}
export interface Schedule {
  id: string;
  units: string[];
  range_key: ReportRange;
  lang: 'he' | 'en';
  freq: 'daily' | 'weekly' | 'monthly';
  dow: number | null;
  dom: number | null;
  at: string;
  recipients: RecipientPick[];
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
}

export function reportQs(p: ReportParams): string {
  const q = new URLSearchParams({ units: p.units.join(','), range: p.range, lang: p.lang });
  if (p.range === 'custom') {
    if (p.from) q.set('from', p.from);
    if (p.to) q.set('to', p.to);
  }
  if (p.chart === false) q.set('chart', '0');
  if (p.events === false) q.set('events', '0');
  if (p.signature === false) q.set('signature', '0');
  if (p.layout === 'haccp') q.set('layout', 'haccp');
  if (p.samples) q.set('samples', '1');
  if (p.external) q.set('external', '1');
  return `?${q.toString()}`;
}

export const getReportPreview = (p: ReportParams) => get<ReportModel>(`${B}/report/preview${reportQs(p)}`);
export const getReportRecipients = () => get<RecipientsResponse>(`${B}/report/recipients`);
export const sendReport = (body: { units: string[]; range: ReportRange; from?: string; to?: string; lang: 'he' | 'en'; recipients: RecipientPick[] }) =>
  post<{ batch_id: string; queued: number; sends: SendRow[] }>(`${B}/report/send`, body);
export const getSends = (batch: string) => get<{ sends: SendRow[] }>(`${B}/report/sends/${enc(batch)}`);
export const listSchedules = () => get<{ schedules: Schedule[] }>(`${B}/report/schedules`);
export const createSchedule = (body: { units: string[]; range: ReportRange; lang: 'he' | 'en'; freq: string; at: string; dow?: number | null; dom?: number | null; recipients: RecipientPick[] }) =>
  post<Schedule>(`${B}/report/schedules`, body);
export const deleteSchedule = (id: string) => del(`${B}/report/schedules/${enc(id)}`);

/** TEMPLINK-295: the temporary download link of a report (infra.temperature.report_link; off until the settings turn it on). */
export interface ReportLink {
  id: string;
  filename: string;
  created_at: string;
  expires_at: string;
  opens: number;
  max_opens: number;
  state: 'live' | 'expired' | 'revoked' | 'used';
  created_by: string | null;
  /** TEMPREPORT-297: the link went out inside a WhatsApp report, to this recipient (display name) */
  sent?: boolean;
  recipient?: string | null;
}
export interface ReportLinksResponse {
  available: boolean;
  hours: number;
  max_opens: number;
  /** WALINK-295: the plain-text WhatsApp send of a link is offered (setting on, recipients set, and the caller may send) */
  whatsapp?: { available: boolean };
  links: ReportLink[];
}
/** WALINK-295: one recipient's typed result. `not_sendable` is never shown as sent. */
export interface LinkSendResult {
  user_id: string;
  name: string;
  status: 'sent' | 'not_sendable' | 'failed';
  reason: string | null;
}
export interface LinkSendResponse {
  status: 'sent' | 'partial' | 'not_sendable' | 'failed';
  sent: number;
  not_sendable: number;
  failed: number;
  results: LinkSendResult[];
}
export type ReportLinkCreated = ReportLink & { url: string };

/** The create body: the same choices as the PDF; dates travel only with a custom range. */
export function reportLinkBody(p: ReportParams): Record<string, unknown> {
  return { units: p.units, range: p.range, lang: p.lang, chart: p.chart !== false, events: p.events !== false, signature: p.signature !== false,
    layout: p.layout === 'haccp' ? 'haccp' : 'standard', samples: p.samples === true, ...(p.range === 'custom' ? { from: p.from, to: p.to } : {}) };
}
export const getReportLinks = () => get<ReportLinksResponse>(`${B}/report/links`);
export const createReportLink = (p: ReportParams) => post<ReportLinkCreated>(`${B}/report/links`, reportLinkBody(p));
export const revokeReportLink = (id: string) => del(`${B}/report/links/${enc(id)}`);
/** TEMPREPORT-297 (Settings): revoke every live link at once - a manager all of them, anyone else his own. */
export const revokeAllReportLinks = () => api<{ revoked: number }>(`${B}/report/links`, { method: 'DELETE' });
export const sendReportLink = (id: string) => post<LinkSendResponse>(`${B}/report/links/${enc(id)}/send`, {});

/** The PDF (the browser's own download). */
export async function downloadReportPdf(p: ReportParams): Promise<void> {
  const res = await fetch(apiUrl(`${B}/report.pdf${reportQs(p)}`), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(res.status, body ?? { code: `http_${res.status}`, user_message: res.statusText, retryable: false, correlation_id: '', details: {} });
  }
  saveBlob(await res.blob(), dispositionName(res.headers.get('Content-Disposition'), 'temperature-report.pdf'));
}
