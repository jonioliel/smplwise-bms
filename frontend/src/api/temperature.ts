/**
 * CR-INFRA-TEMPERATURE 2.9.1: the ONLY module of the frontend that talks to `/api/v1/infra/temperature...`
 * (smplwise_vms/backend/smplwise/routers/temperature.py). Read-only against the infrastructure: nothing is ever sent to a device.
 * Operator routes carry friendly sensor names; entity ids come only to holders of infra.temperature.manage (owner decision 7).
 */
import { api, apiBlob, del, get, post, put } from './client';
import { dispositionName, saveBlob } from './download';
import type * as Wire from './generated/wire-temperature';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/temperature.py, generated into
 * ./generated/wire-temperature.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose (each noted where it is declared): the known sets of kinds, states and reasons, the point tuples, and the computed documents the
 * server passes through untyped (a unit's rules, the sensor health, the insights, a report unit, an explanation's evidence). */

export type UnitKind = 'fridge' | 'freezer' | 'coldroom' | 'pharma' | 'server' | 'room';
/** off = a climate unit switched off (a state, not an alarm; owner 2026-10-19) */
export type UnitStatus = 'ok' | 'warning' | 'alarm' | 'offline' | 'off' | 'unknown';
type BandMode = 'fixed' | 'setpoint';
export type SourceKind = 'sensor' | 'climate';
/** phase 3: predict (an early warning), battery / frozen / recovery / duty (health), maint / escalate / ticket (acts) */
export type EventKind = 'high' | 'low' | 'door' | 'offline' | 'defrost' | 'ack' | 'mute' | 'predict' | 'battery' | 'frozen' | 'recovery' | 'duty' | 'maint' | 'escalate' | 'ticket';
export type Severity = 'info' | 'warning' | 'alarm';
type DefrostMode = 'fixed' | 'learn' | 'none';
type DefrostState = 'learning' | 'learned' | 'none_found' | 'fixed' | 'none';
export type RangeKey = '24h' | '7d' | '30d' | 'custom';

/** One alert-log row; narrowed: the kinds, severities and suppressions the runtime writes, the detail keys of each kind. The phase-3
 * fields stay optional here (an older server, and the report's own rows built into this shape, have none of them). */
export type TempEvent = Omit<Wire.TempEvent, 'kind' | 'severity' | 'suppressed' | 'detail' | 'escalation_level' | 'ticket_id'> &
  Partial<Pick<Wire.TempEvent, 'escalation_level' | 'ticket_id'>> & {
  kind: EventKind;
  severity: Severity;
  suppressed: 'quiet' | 'mute' | 'defrost' | 'off' | 'maintenance' | null;
  detail: {
    minutes?: number; until?: string; hard_max?: boolean; window?: boolean; closed?: string;
    /** phase 3 */
    reason?: string; ended_early?: boolean; level?: number; of?: string; side?: 'high' | 'low'; eta_min?: number; rate_h?: number; battery?: number | null;
    median_recovery_min?: number | null; recent?: number | null; before?: number | null; number?: number; absorbed?: boolean;
  };
};

export type DefrostWindow = Omit<Wire.TempDefrostWindow, 'status'> & { status: 'fixed' | 'learned' | 'confirmed' | 'rejected' };

interface UnitRules {
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

/** Phase 3 (idea 8): the temperature sensor's own device - battery, signal, reading age, a frozen value; `issues` adds recovery / duty. */
type HealthIssue = 'battery' | 'frozen' | 'signal' | 'recovery' | 'duty';
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
interface DoorEffect {
  opened: number;
  closed: number;
  open_min: number;
  base: number;
  peak: number;
  rise: number;
  recovery_min: number | null;
  interrupted: boolean;
}
interface DoorInsight {
  opens: number;
  avg_rise: number | null;
  max_rise: number | null;
  median_recovery_min: number | null;
  unrecovered: number;
  slow: boolean;
  last: DoorEffect[];
}
interface DutyInsight {
  recent: number | null;
  before: number | null;
  rising: boolean;
  today: number | null;
  pct_24h: number | null;
  days: { day: string; pct: number | null; minutes: number }[];
}
/** Phase 3 (ideas 2 and 6): recomputed hourly from the stored history. */
export type Insights = Omit<Wire.TempInsights, 'door' | 'duty'> & { door: DoorInsight | null; duty: DutyInsight | null };
export type Maintenance = Wire.TempMaintenance;

type Stats = Wire.TempStats24h;

/** Phase 3 of a unit's answer: optional on the client (an older server sent none of it). */
type TempPhase3 = 'floor_id' | 'floor_name' | 'floor_level' | 'prediction' | 'power' | 'maintenance' | 'tickets';

/** One unit with its live status; narrowed: the unit kinds, the effective rules, the defrost states, the health / insight documents, the
 * spark tuples ([ts, value] or a climate unit's [ts, value, setpoint]). */
export type TempUnit = Omit<Wire.TempUnit, 'kind' | 'events' | 'defrost' | 'rules' | 'health' | 'insights' | 'spark' | 'doors_24h' | 'defrost_24h' | TempPhase3> &
  Partial<Pick<Wire.TempUnit, TempPhase3>> & {
  kind: UnitKind;
  events: TempEvent[];
  defrost: { mode: DefrostMode; in_window: boolean; next_at: string | null; state: DefrostState; days: number; windows: DefrostWindow[] };
  rules: UnitRules;
  /** phase 3 (an older server: absent) */
  health?: Health;
  insights?: Insights;
  /** [ts (unix s), value] five-minute points of the last 24 h; a climate unit adds the setpoint: [ts, value, setpoint] */
  spark?: ([number, number] | [number, number, number | null])[];
  doors_24h?: [number, number][];
  defrost_24h?: [number, number][];
};

export type UnitsResponse = Omit<Wire.TempUnits, 'units' | 'summary' | 'grouping'> & {
  units: TempUnit[];
  summary: Record<UnitStatus, number>;
  /** phase 3: the grid's grouping (idea 7) */
  grouping: 'area' | 'none';
};

/** TEMPEXPLAIN093-295: one factor of a rule-based excursion explanation - a key (the words live in i18n/temperature), its score and its evidence. */
export type ExplainKey = 'maint' | 'defrost' | 'door' | 'outage' | 'compressor_off' | 'compressor_no_power' | 'compressor_on' | 'unit_off' | 'setpoint' | 'gap' | 'spike' | 'shared' | 'local' | 'gradual';
export interface ExplainFactor {
  key: ExplainKey;
  score: number;
  vars: Record<string, string | number | boolean | null | string[]>;
}
export type Explanation = Omit<Wire.TempExplanation, 'factors' | 'primary'> & { factors: ExplainFactor[]; primary: ExplainKey | null };

/** points: [ts, avg, min, max, defrost 0/1, setpoint (climate units; null otherwise)] */
export type HistoryResponse = Omit<Wire.TempHistory, 'points' | 'doors' | 'defrost'> & {
  points: [number, number, number, number, number, number | null][];
  doors: [number, number][];
  defrost: [number, number][];
};

export type Recipients = Wire.TempRecipients;

/** The power sensor (phase 3) stays optional on the client (an older server sent none). */
export type ManagedUnit = Omit<Wire.TempManagedUnit, 'kind' | 'rules' | 'power_entity_id' | 'power_sensor_name' | 'power_missing'> &
  Partial<Pick<Wire.TempManagedUnit, 'power_entity_id' | 'power_sensor_name' | 'power_missing'>> & {
  kind: UnitKind;
  rules: Partial<Record<string, boolean | number | string>>;
};

type RuleSpec = Omit<Wire.TempRuleSpec, 'type'> & { type: 'bool' | 'int' | 'float' | 'hhmm' | 'choice' | 'id' | 'text' | 'ids' };

export type ManageResponse = Omit<Wire.TempManage, 'units' | 'defaults' | 'rule_specs' | 'kinds' | 'templates'> & {
  units: ManagedUnit[];
  defaults: Record<string, boolean | number | string>;
  rule_specs: Record<string, RuleSpec>;
  kinds: UnitKind[];
  templates: Record<string, [number, number]>;
};

export type Candidate = Omit<Wire.TempCandidate, 'state'> & { state: 'on' | 'off' | null };

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

export type SettingsResponse = Omit<Wire.TempSettings, 'rules' | 'code_defaults' | 'rule_specs'> & {
  rules: Record<string, boolean | number | string | string[]>;
  code_defaults: Record<string, boolean | number | string | string[]>;
  rule_specs: Record<string, RuleSpec>;
};

export type AlertKind = 'alarm' | 'warning' | 'offline' | 'health';
export type AlertChannel = 'push' | 'app' | 'email' | 'whatsapp';
interface AlertKindSettings {
  enabled: boolean;
  recipients: Recipients;
  channels: AlertChannel[];
}
/** Phase 3 (idea 4): an alarm nobody acknowledged climbs a tier per step (its own notification and log row). */
interface EscalationStep {
  after_min: number;
  recipients: Recipients;
}
export interface Escalation {
  enabled: boolean;
  channels: AlertChannel[];
  steps: EscalationStep[];
}
export type AlertSettings = Omit<Wire.TempAlertSettings, 'kinds' | 'escalation' | 'channels' | 'kinds_order'> & {
  kinds: Record<AlertKind, AlertKindSettings>;
  escalation: Escalation;
  channels: AlertChannel[];
  kinds_order: AlertKind[];
};

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

function logQs(q: LogQuery, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const listUnits = (spark = true) => get<UnitsResponse>(spark ? B : `${B}?spark=0`);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by CR-INFRA-TEMPERATURE (2.9.1).
export const getUnit = (id: string) => get<TempUnit>(`${B}/${enc(id)}`);
export const getHistory = (id: string, range: RangeKey, from?: string, to?: string, points = 600) =>
  get<HistoryResponse>(`${B}/${enc(id)}/history${logQs({ range, from, to }, { points: String(points) })}`);
export const listEvents = (q: LogQuery) => get<{ events: TempEvent[]; total: number }>(`${B}/events${logQs(q)}`);
export const ackUnit = (id: string, eventId?: string) => post<Wire.TempAcked>(`${B}/${enc(id)}/ack`, eventId ? { event_id: eventId } : {});
export const muteUnit = (id: string, body: { minutes?: number; until_defrost_end?: boolean }) => post<{ muted_until: string }>(`${B}/${enc(id)}/mute`, body);
export const unmuteUnit = (id: string) => del(`${B}/${enc(id)}/mute`);

export const listManaged = () => get<ManageResponse>(`${B}/manage`);
export const listCandidates = (kind: 'temp' | 'door' | 'power', q = '') => get<{ items: Candidate[] }>(`${B}/candidates${logQs({}, q ? { kind, q } : { kind })}`);
export const createUnit = (body: UnitBody) => post<ManagedUnit>(B, body);
export const updateUnit = (id: string, body: UnitBody) => put<ManagedUnit>(`${B}/${enc(id)}`, body);
export const deleteUnit = (id: string) => del(`${B}/${enc(id)}`);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by CR-INFRA-TEMPERATURE (2.9.1).
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
export type TicketDraft = Wire.TempTicketDraft;
export const getTicketDraft = (id: string, eventId?: string | null, lang: 'he' | 'en' = 'he') =>
  get<TicketDraft>(`${B}/${enc(id)}/ticket/draft${logQs({}, eventId ? { event_id: eventId, lang } : { lang })}`);
export const openTicket = (id: string, body: { department_id: string; title?: string; description?: string; event_id?: string | null; attach_chart?: boolean; lang?: 'he' | 'en' }) =>
  post<Wire.TempTicketOpened>(`${B}/${enc(id)}/ticket`, body);

/** The alert log as CSV (the browser's own download). */
export async function downloadLogCsv(q: LogQuery, lang: 'he' | 'en' = 'he'): Promise<void> {
  const { blob, headers } = await apiBlob(`${B}/events.csv${logQs({ ...q, limit: undefined, offset: undefined }, { lang })}`);
  saveBlob(blob, dispositionName(headers.get('Content-Disposition'), 'temperature-log.csv'));
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
interface ReportUnit {
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
  daily?: { day: string; min: number | null; max: number | null; avg: number | null; out_min: number; out_min_raw: number; alarms: number; door_opens: number | null; coverage: number; verdict: 'ok' | 'exc' | 'partial' | 'none' }[];
}
export type ReportModel = Omit<Wire.TempReportPreview, 'units'> & { units: ReportUnit[] };
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
/** `user_attachment` (TEMPREPORT-297) and `vendor_reports` (TEMPVENDOR-295) stay optional on the client (an older server: absent). */
export type RecipientsResponse = Omit<Wire.TempReportRecipients, 'users' | 'vendors' | 'user_attachment' | 'vendor_reports'> &
  Partial<Pick<Wire.TempReportRecipients, 'user_attachment' | 'vendor_reports'>> & { users: ReportRecipient[]; vendors: ReportRecipient[] };
export type SendRow = Omit<Wire.TempSendRow, 'status' | 'channel'> & {
  status: 'queued' | 'held' | 'retry' | 'handed' | 'sent' | 'failed' | 'skipped';
  channel?: VendorChannel | null;
};
export type Schedule = Omit<Wire.TempSchedule, 'range_key' | 'recipients'> & { range_key: ReportRange; recipients: RecipientPick[] };

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
  post<Omit<Wire.TempReportSent, 'sends'> & { sends: SendRow[] }>(`${B}/report/send`, body);
export const getSends = (batch: string) => get<{ sends: SendRow[] }>(`${B}/report/sends/${enc(batch)}`);
export const listSchedules = () => get<{ schedules: Schedule[] }>(`${B}/report/schedules`);
export const createSchedule = (body: { units: string[]; range: ReportRange; lang: 'he' | 'en'; freq: string; at: string; dow?: number | null; dom?: number | null; recipients: RecipientPick[] }) =>
  post<Schedule>(`${B}/report/schedules`, body);
export const deleteSchedule = (id: string) => del(`${B}/report/schedules/${enc(id)}`);

/** TEMPLINK-295: the temporary download link of a report (infra.temperature.report_link; off until the settings turn it on). */
export type ReportLink = Wire.TempReportLink;
type ReportLinksResponse = Wire.TempReportLinks;
/** WALINK-295: one recipient's typed result. `not_sendable` is never shown as sent. */
export type LinkSendResponse = Wire.TempLinkSent;
export type ReportLinkCreated = Wire.TempReportLinkCreated;

/** The create body: the same choices as the PDF; dates travel only with a custom range. */
function reportLinkBody(p: ReportParams): Record<string, unknown> {
  return { units: p.units, range: p.range, lang: p.lang, chart: p.chart !== false, events: p.events !== false, signature: p.signature !== false,
    layout: p.layout === 'haccp' ? 'haccp' : 'standard', samples: p.samples === true, ...(p.range === 'custom' ? { from: p.from, to: p.to } : {}) };
}
export const getReportLinks = () => get<ReportLinksResponse>(`${B}/report/links`);
export const createReportLink = (p: ReportParams) => post<ReportLinkCreated>(`${B}/report/links`, reportLinkBody(p));
export const revokeReportLink = (id: string) => del(`${B}/report/links/${enc(id)}`);
/** TEMPREPORT-297 (Settings): revoke every live link at once - a manager all of them, anyone else his own. */
export const revokeAllReportLinks = () => api<Wire.TempRevoked>(`${B}/report/links`, { method: 'DELETE' });
export const sendReportLink = (id: string) => post<LinkSendResponse>(`${B}/report/links/${enc(id)}/send`, {});

/** The PDF (the browser's own download). */
export async function downloadReportPdf(p: ReportParams): Promise<void> {
  const { blob, headers } = await apiBlob(`${B}/report.pdf${reportQs(p)}`);
  saveBlob(blob, dispositionName(headers.get('Content-Disposition'), 'temperature-report.pdf'));
}
