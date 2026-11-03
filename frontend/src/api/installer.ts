/**
 * WISKEY-INSTALLER-NATIVE-2400: WisKey's installer tools in Arx (backend routers/wiskey_installer*.py, all under
 * `/access-control/installer/`, all system.configure at the installation). The browser never names a WisKey command: every call
 * here is one fixed endpoint. A write carries the command envelope (`client_request_id`, `expires_at`), `confirmed: true` - sent only by
 * the confirmation dialog - and, for a dangerous one, the phrase the person typed. Nothing here retries, queues or runs by itself.
 *
 * The pure helpers (outcome reading, the diff of a change, the NTP rules the server applies) are what the unit spec checks.
 */
import { ApiError, get, post, put } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';

const BASE = 'access-control/installer';
const TTL_MS = 20_000; // the server accepts at most 60 s; it sends within 15 s of arrival or not at all

export type ToolName = 'clock' | 'technical' | 'lifecycle' | 'platform';

export interface InstallerOverview {
  feed: string;
  stations: { id: string; name: string; online: boolean }[] | null;
  tools: Partial<Record<ToolName, { available: boolean | null; missing: string[] }>>;
}

export interface PartState<T> {
  state: 'ready' | 'error';
  error: { code: string; wiskey_code: string | null; message: string } | null;
  fetched_at: string | null;
  data: T | null;
}

export interface NtpSettings {
  revision: number;
  server: string | null;
  port: number | null;
  interval: number | null;
}

export interface HostStatus {
  supported: boolean;
  synchronized: boolean | null;
  use_ntp: boolean | null;
  config: { servers: string[]; fallback_servers: string[] } | null;
}

export interface StationClock {
  status: string | null;
  skew_seconds: number | null;
  drift_state: string | null;
  time_mode: string | null;
  checked_at: string | null;
  error: string | null;
}

export interface ClockView {
  settings: PartState<NtpSettings>;
  host: PartState<HostStatus>;
  stations: { id: string; name: string; online: boolean; clock: StationClock | null }[] | null;
  feed: string;
  defaults: { server: string; port: number; interval: number };
  host_typed_phrase: string;
  cooldowns: { host_apply: number };
}

export interface ClockCheck {
  station_id: string;
  name: string | null;
  typed_phrase: string | null;
  cooldown_s: number;
  fetched_at: string | null;
  online: boolean | null;
  clock: StationClock | null;
}

export interface MeasuredClock {
  device_time: string | null;
  checked_at: string | null;
  time_mode: string | null;
  skew_seconds: number | null;
  measurement: { status: string | null; estimated_skew_seconds: number | null; uncertainty_seconds: number | null };
}

export interface StationSyncResult {
  configuration_verified: boolean;
  server: string | null;
  clock_verified: boolean;
  copied_system: boolean;
  clock: MeasuredClock | null;
}

export interface WriteReply<T> {
  operation: string;
  status: 'completed';
  command_id: string;
  at: string | null;
  data: T;
}

/** The envelope of every write. `typed` only for the dangerous ones. */
export function envelope(typed?: string): Record<string, unknown> {
  return {
    confirmed: true,
    client_request_id: commandId(),
    expires_at: new Date(serverNow() + TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ...(typed === undefined ? {} : { typed_confirmation: typed }),
  };
}

export const getOverview = () => get<InstallerOverview>(`${BASE}/overview`);
export const getClock = () => get<ClockView>(`${BASE}/clock`);
export const checkStationClock = (id: string) => get<ClockCheck>(`${BASE}/clock/stations/${encodeURIComponent(id)}`);
export const saveClockSettings = (revision: number, values: { server: string; port: number; interval: number }) =>
  put<WriteReply<NtpSettings>>(`${BASE}/clock/settings`, { ...envelope(), revision, values });
export const applyHostClock = (revision: number, typed: string) =>
  post<WriteReply<{ configuration_verified: boolean; config: HostStatus['config'] }>>(`${BASE}/clock/host-apply`, { ...envelope(typed), revision });
export const syncStationClock = (id: string, revision: number, copySystem: boolean, typed: string) =>
  post<WriteReply<StationSyncResult>>(`${BASE}/clock/stations/${encodeURIComponent(id)}/sync`, { ...envelope(typed), revision, copy_system: copySystem });

// ---------------------------------------------------------------- reading an outcome

/** `completed` from the server; `refused` (WisKey answered a failure - nothing changed), `not_sent` (refused before sending),
 * `unknown` (sent, no clear answer - it may have happened). */
export type WriteStatus = 'completed' | 'refused' | 'not_sent' | 'unknown';

export interface WriteOutcome {
  status: WriteStatus;
  code: string | null;
  message: string;
  retryAfterS: number | null;
  expected: string | null;
}

export function outcomeOf(err: unknown): WriteOutcome {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    const status: WriteStatus =
      raw === 'refused' ? 'refused' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : [400, 403, 404, 409, 415, 422, 429].includes(err.status) ? 'not_sent' : 'unknown';
    const retry = Number(d.retry_after_s);
    return {
      status,
      code: String(d.wiskey_code ?? err.code ?? '') || null,
      message: err.body?.user_message ?? err.message,
      retryAfterS: Number.isFinite(retry) && retry > 0 ? retry : null,
      expected: typeof d.expected === 'string' ? d.expected : null,
    };
  }
  return { status: 'unknown', code: 'network', message: '', retryAfterS: null, expected: null };
}

// ---------------------------------------------------------------- the diff a confirmation shows

export interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/** Every key of `after` against `before`, in `order` (unknown keys after it). */
export function diffRows(before: Record<string, unknown> | null, after: Record<string, unknown>, order: readonly string[] = []): DiffRow[] {
  const keys = [...order.filter((k) => k in after), ...Object.keys(after).filter((k) => !order.includes(k))];
  return keys.map((key) => {
    const b = before ? before[key] : undefined;
    const a = after[key];
    return { key, before: b, after: a, changed: JSON.stringify(b) !== JSON.stringify(a) };
  });
}

export const hasChanges = (rows: readonly DiffRow[]) => rows.some((r) => r.changed);

// ---------------------------------------------------------------- the NTP rules (WisKey ntp_settings.normalize, checked again by the server)

const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function validServer(host: string): boolean {
  if (host.length < 1 || host.length > 64) return false;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((p) => p > 255)) return false;
    if (parts.every((p) => p === 0)) return false; // unspecified
    if (parts[0] >= 224 && parts[0] <= 239) return false; // multicast
    return true;
  }
  if (/^[0-9.]+$/.test(host)) return false;
  return host.split('.').every((l) => LABEL.test(l));
}

export function ntpErrors(v: { server: string; port: number; interval: number }): Array<'server' | 'port' | 'interval'> {
  const out: Array<'server' | 'port' | 'interval'> = [];
  if (!validServer(v.server.trim())) out.push('server');
  if (!Number.isInteger(v.port) || v.port < 2 || v.port > 65535) out.push('port');
  if (!Number.isInteger(v.interval) || v.interval < 1 || v.interval > 10080) out.push('interval');
  return out;
}

/** The skew tone of a station's clock: within 5 s is fine (WisKey's own `clock_verified` bound), up to a minute a warning. */
export function skewTone(skew: number | null | undefined): 'ok' | 'warn' | 'err' | 'unknown' {
  if (skew === null || skew === undefined || !Number.isFinite(skew)) return 'unknown';
  const a = Math.abs(skew);
  return a <= 5 ? 'ok' : a <= 60 ? 'warn' : 'err';
}

// ---------------------------------------------------------------- phase 2: a station's technical settings

export type DoorField = 'doorName' | 'openDuration' | 'relayReverseEnabled';
export interface DoorValues {
  doorName?: string;
  openDuration?: number;
  relayReverseEnabled?: boolean;
}
export type DoorConstraint = { type: 'boolean' } | { type: 'text' | 'integer'; min: number; max: number };

export interface TechnicalDoor {
  door: number | null;
  values: DoorValues | null;
  constraints: Partial<Record<DoorField, DoorConstraint>> | null;
  error: string | null;
}

export interface TechnicalReport {
  checked_at: string | null;
  doors: TechnicalDoor[];
  passwords: { states: Record<string, boolean | null>; public_pin_state: string | null } | null;
  password_error: string | null;
  features: { family: string; name: string; supported: boolean }[];
  relay_selection: { physical_index: number; api_id: number; confirmed: boolean; name: string | null }[];
}

export interface TechnicalView {
  station_id: string;
  name: string | null;
  online: boolean | null;
  typed_phrase: string | null;
  fetched_at: string | null;
  editable_doors: number[];
  dangerous_fields: DoorField[];
  report: TechnicalReport;
}

export const DOOR_FIELDS: readonly DoorField[] = ['doorName', 'openDuration', 'relayReverseEnabled'];

export const getTechnical = (id: string, fresh = false) => get<TechnicalView>(`${BASE}/technical/stations/${encodeURIComponent(id)}${fresh ? '?fresh=true' : ''}`);
export const updateDoor = (id: string, door: number, expected: DoorValues, changes: DoorValues, typed?: string) =>
  put<WriteReply<TechnicalDoor>>(`${BASE}/technical/stations/${encodeURIComponent(id)}/doors/${door}`, { ...envelope(typed), expected, changes });

/** Only the fields that differ from what was read. */
export function doorChanges(before: DoorValues, draft: DoorValues): DoorValues {
  const out: DoorValues = {};
  for (const k of DOOR_FIELDS) {
    if (draft[k] !== undefined && draft[k] !== before[k]) (out as Record<string, unknown>)[k] = draft[k];
  }
  return out;
}

/** The fields of `draft` outside the bounds the device advertised (WisKey client/technical.validate_changes). */
export function doorErrors(draft: DoorValues, constraints: TechnicalDoor['constraints']): DoorField[] {
  const out: DoorField[] = [];
  for (const k of DOOR_FIELDS) {
    const v = draft[k];
    const c = constraints?.[k];
    if (v === undefined) continue;
    if (k === 'doorName') {
      const s = String(v);
      const max = c && c.type !== 'boolean' ? c.max : 64;
      const min = c && c.type !== 'boolean' ? c.min : 1;
      if (s.length < min || s.length > max || /[\u0000-\u001f]/.test(s)) out.push(k);
    } else if (k === 'openDuration') {
      const n = Number(v);
      const max = c && c.type !== 'boolean' ? c.max : 255;
      const min = c && c.type !== 'boolean' ? c.min : 0;
      if (!Number.isInteger(n) || n < min || n > max) out.push(k);
    } else if (typeof v !== 'boolean') out.push(k);
  }
  return out;
}

export const needsTyped = (changes: DoorValues, dangerous: readonly DoorField[]) => Object.keys(changes).some((k) => dangerous.includes(k as DoorField));

// ---------------------------------------------------------------- phase 3: add / re-onboard (WisKey's config-entry flow) and remove / replace

export type FlowStep = 'user' | 'reconfigure' | 'confirm_device' | 'locks' | 'mapping' | 'confirm_mapping' | 'other';

export interface FlowView {
  flow_id: string;
  type: 'form' | 'create_entry' | 'abort' | 'other' | 'aborted';
  step_id: FlowStep | null;
  errors: Record<string, string>;
  choices: Partial<Record<'mode' | 'api_id' | 'result' | 'scheme', Array<string | number>>>;
  defaults: Record<string, string | number | boolean>;
  device: { model: string | null; firmware: string | null; serial: string | null } | null;
  entry: { entry_id: string | null; title: string | null } | null;
  reason: string | null;
}

export const PULSE_PHRASE = 'פתיחת דלת לבדיקה';

export const startOnboarding = (kind: 'add' | 'reconfigure', entryId?: string) =>
  post<WriteReply<FlowView>>(`${BASE}/onboarding`, { ...envelope(), kind, ...(entryId ? { entry_id: entryId } : {}) });
export const onboardingStep = (flowId: string, step: FlowStep, input: Record<string, unknown>, typed?: string) =>
  post<WriteReply<FlowView>>(`${BASE}/onboarding/${encodeURIComponent(flowId)}/steps/${step}`, { ...envelope(typed), input });
export const abortOnboarding = (flowId: string) => post<WriteReply<{ flow_id: string; type: 'aborted' }>>(`${BASE}/onboarding/${encodeURIComponent(flowId)}/abort`, envelope());

/** The steps whose answer can CREATE or CHANGE the station's configuration in WisKey (they get the confirmation dialog); `mapping` pulses
 * the door relay (typed phrase); the others only check (the connection, the device identity). */
export const COMMITTING_STEPS: readonly FlowStep[] = ['locks', 'confirm_mapping'];

/** The connection form's input: the password is sent only when typed (an empty one on reconfigure keeps the stored password). */
export function connectionInput(form: Record<string, string | boolean>, step: FlowStep): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: String(form.name ?? '').trim(),
    host: String(form.host ?? '').trim(),
    username: String(form.username ?? '').trim(),
    scheme: form.scheme === 'https' ? 'https' : 'http',
    port: Number(form.port),
    verify_ssl: form.verify_ssl === true,
    rtsp_port: Number(form.rtsp_port),
  };
  const pw = String(form.password ?? '');
  if (pw || step === 'user') out.password = pw;
  return out;
}

export function connectionErrors(input: Record<string, unknown>, step: FlowStep): string[] {
  const bad: string[] = [];
  const text = (k: string, max: number) => typeof input[k] === 'string' && (input[k] as string).length >= 1 && (input[k] as string).length <= max;
  if (!text('name', 64)) bad.push('name');
  if (!(typeof input.host === 'string' && /^[A-Za-z0-9.:\-[\]]{1,255}$/.test(input.host))) bad.push('host');
  if (!text('username', 64)) bad.push('username');
  if (step === 'user' && !text('password', 128)) bad.push('password');
  for (const k of ['port', 'rtsp_port']) {
    const n = input[k] as number;
    if (!Number.isInteger(n) || n < 1 || n > 65535) bad.push(k);
  }
  return bad;
}

export interface LifecycleImpact {
  mode: 'replacement' | 'retirement' | 'unknown' | null;
  source_id: string | null;
  target_id: string | null;
  affected_people: number | null;
  rows_complete: boolean | null;
  groups: number | null;
  known_bindings: number | null;
  unknown_owners: number | null;
  hold_programs: number | null;
  native_schedules: number | null;
  required_target_locks: number[];
  blockers: string[];
  device_writes: number | null;
  stations?: { id: string | null; name: string | null; identity_verified: boolean; error: string | null }[];
}

export type JobState = 'prepared' | 'approved' | 'rejected' | 'applied' | 'verified' | 'removing' | 'removed' | 'expired' | 'failed' | 'unknown';

export interface LifecycleJob {
  id: string | null;
  fingerprint: string | null;
  source_id: string | null;
  target_id: string | null;
  source_name: string | null;
  target_name: string | null;
  state: JobState | null;
  created_at: string | null;
  expires_at: string | null;
  applied_at: string | null;
  verified_at: string | null;
  removed_at: string | null;
  require_approval: boolean | null;
  approval_state: string | null;
  affected_people: number | null;
}

export interface LifecycleList {
  records: LifecycleJob[];
  fetched_at: string | null;
  stations: { id: string; name: string; online: boolean }[] | null;
}

export const getLifecycle = () => get<LifecycleList>(`${BASE}/lifecycle`);
export const reviewLifecycle = (source: string, target = '') =>
  get<{ review: LifecycleImpact; fetched_at: string | null }>(`${BASE}/lifecycle/review?source_id=${encodeURIComponent(source)}&target_id=${encodeURIComponent(target)}`);
export const prepareLifecycle = (source: string, target?: string) =>
  post<WriteReply<{ job: LifecycleJob; impact?: LifecycleImpact }>>(`${BASE}/lifecycle/prepare`, { ...envelope(), source_id: source, ...(target ? { target_id: target } : {}) });
export const lifecycleAction = (job: LifecycleJob, action: 'apply' | 'verify' | 'remove', typed?: string) =>
  post<WriteReply<{ job: LifecycleJob }>>(`${BASE}/lifecycle/jobs/${encodeURIComponent(job.id ?? '')}/${action}`, { ...envelope(typed), fingerprint: job.fingerprint });

/** The next action of a job, by WisKey's states: prepared -> apply (typed), applied -> verify, verified -> remove (typed). */
export function nextAction(job: LifecycleJob): 'apply' | 'verify' | 'remove' | null {
  if (job.state === 'prepared' || job.state === 'approved') return 'apply';
  if (job.state === 'applied') return 'verify';
  if (job.state === 'verified' || job.state === 'removing') return 'remove';
  return null;
}

export const JOB_STEPS: readonly JobState[] = ['prepared', 'applied', 'verified', 'removed'];

/** How far along the job is (0..3) for the step indicator. */
export function jobProgress(state: JobState | null): number {
  if (state === 'removing') return 2.5;
  const i = JOB_STEPS.indexOf((state === 'approved' ? 'prepared' : state) as JobState);
  return i < 0 ? -1 : i;
}

// ---------------------------------------------------------------- phase 4: the rest of the platform

export interface MaintWindow {
  enabled: boolean;
  days: number[];
  start: string | null;
  end: string | null;
  timezone: string | null;
}

export interface StationMeta {
  zone: string | null;
  owner: string | null;
  tags: string[];
  thresholds: Record<'offline' | 'sync_stalled' | 'event_gap', number | null>;
  window: MaintWindow | null;
}

export interface Receipt {
  at: string | null;
  station_id: string | null;
  state: 'verified' | 'failed' | 'unknown' | null;
  code: string | null;
}

export interface PlatformData {
  revision: number;
  retention: { days: number | null; count: number | null; bytes: number | null };
  webhook: { enabled: boolean; url: string; kinds: string[] };
  stations: Record<string, { revision: number; values: StationMeta | null }>;
  catalog: Record<string, string | null>;
  templates: number | null;
  door_presets: number | null;
  receipts: Receipt[];
  event_usage: Record<string, number | boolean | null>;
  capabilities: string[];
}

export interface CapacityKind {
  count: number | null;
  advertised_limit: number | null;
  used_percent: number | null;
  remaining: number | null;
  observed_growth_per_day: number | null;
  estimated_days_to_limit: number | null;
  alert: string | null;
}

export interface CapacityData {
  records: { station_id: string | null; name: string | null; sampled_at: string | null; fresh: boolean | null; sample_count: number | null; users: CapacityKind; cards: CapacityKind }[];
  forecast_is_estimate: boolean;
}

export interface IntegrityData {
  checks: { component: string | null; state: string | null; remedy: string | null }[];
  writes_performed: boolean;
}

export interface MaintJob {
  id: string | null;
  fingerprint: string | null;
  state: string | null;
  created_at: string | null;
  expires_at: string | null;
  own_request: boolean | null;
  dual_required: boolean | null;
  rows: { station_id: string | null; name: string | null; door: number | null; changes: DoorValues | null; state: string | null; code: string | null; window: MaintWindow | null }[];
}

export interface PlatformView {
  platform: PartState<PlatformData>;
  capacity: PartState<CapacityData>;
  integrity: PartState<IntegrityData>;
  maintenance: PartState<{ records: MaintJob[] }>;
  demo: PartState<{ demo: boolean; steps: string[]; device_writes: number | null }>;
  stations: { id: string; name: string; online: boolean }[] | null;
  typed: Record<string, string>;
}

export interface ChangePreview {
  review_id: string | null;
  count: number | null;
  rows: { station_id: string | null; name: string | null; before: DoorValues | null; after: DoorValues | null; window: MaintWindow | null; error: string | null }[];
}

export interface ImportReview {
  review_id: string;
  templates: number | null;
  replaces_templates: boolean;
  stations: { source: string | null; name: string | null; target: string | null; replaces: boolean }[];
}

const P = `${BASE}/platform`;
type Read<T> = { data: T; fetched_at: string | null };

export const getPlatform = () => get<PlatformView>(P);
export const exportPlatform = () => get<Read<Record<string, unknown>>>(`${P}/export`);
export const saveStationMeta = (id: string, revision: number, values: StationMeta) =>
  put<WriteReply<{ revision: number | null }>>(`${P}/stations/${encodeURIComponent(id)}`, { ...envelope(), revision, values });
export const saveWebhook = (revision: number, values: PlatformData['webhook']) => put<WriteReply<{ revision: number | null; enabled: boolean }>>(`${P}/webhook`, { ...envelope(), revision, values });
export const revealWebhookKey = (typed: string) => post<WriteReply<{ key: string }>>(`${P}/webhook/key`, envelope(typed));
export const previewImport = (content: string, mapping: Record<string, string>) => post<Read<ImportReview>>(`${P}/import/preview`, { content, mapping });
export const applyImport = (reviewId: string, typed: string) => post<WriteReply<{ revision: number | null; stations: number | null }>>(`${P}/import/apply`, { ...envelope(typed), review_id: reviewId });
export const previewRetention = (values: { days: number; count: number; bytes: number }) =>
  post<Read<{ review_id: string; before: number | null; after: number | null; removed: number | null }>>(`${P}/retention/preview`, { values });
export const applyRetention = (reviewId: string, typed: string) => post<WriteReply<Record<string, number | null>>>(`${P}/retention/apply`, { ...envelope(typed), review_id: reviewId });
export const previewChange = (mode: 'config' | 'maintenance', stationIds: string[], door: number, changes: DoorValues) =>
  post<Read<ChangePreview>>(`${P}/${mode}/preview`, { station_ids: stationIds, door, changes });
export const applyChange = (reviewId: string, typed: string) =>
  post<WriteReply<{ receipts: Receipt[]; verified: number; failed: number }>>(`${P}/config/apply`, { ...envelope(typed), review_id: reviewId });
export const enqueueMaintenance = (reviewId: string, typed: string) =>
  post<WriteReply<{ job_id: string | null; state: string | null }>>(`${P}/maintenance/enqueue`, { ...envelope(typed), review_id: reviewId });
export const cancelMaintenance = (job: MaintJob) =>
  post<WriteReply<{ records: MaintJob[] }>>(`${P}/maintenance/jobs/${encodeURIComponent(job.id ?? '')}/cancel`, { ...envelope(), fingerprint: job.fingerprint });

/** WisKey's maintenance-window rule (operations_center.window). */
export function windowErrors(w: MaintWindow): string[] {
  const bad: string[] = [];
  const hhmm = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (w.enabled && w.days.length === 0) bad.push('days');
  if (!w.start || !hhmm.test(w.start)) bad.push('start');
  if (!w.end || !hhmm.test(w.end)) bad.push('end');
  if (!bad.length && (w.start ?? '') >= (w.end ?? '')) bad.push('end');
  if (!w.timezone || !/^[A-Za-z0-9_+\-/]{1,100}$/.test(w.timezone)) bad.push('timezone');
  return bad;
}

/** WisKey's webhook rule (operations_center.webhook_settings): https, port 443 / 8443, no credentials, query or fragment; a kind when on. */
export function webhookErrors(v: PlatformData['webhook']): string[] {
  const bad: string[] = [];
  if (v.enabled && v.kinds.length === 0) bad.push('kinds');
  if (v.url || v.enabled) {
    try {
      const u = new URL(v.url);
      if (u.protocol !== 'https:' || !u.hostname || u.username || u.password || u.search || u.hash || !['', '443', '8443'].includes(u.port)) bad.push('url');
    } catch {
      bad.push('url');
    }
  }
  return bad;
}

/** The per-station result of a fleet change: verified / failed with the code - a partial failure is never summarised as success. */
export function receiptSummary(receipts: readonly Receipt[]): { verified: number; failed: number; partial: boolean } {
  const verified = receipts.filter((r) => r.state === 'verified').length;
  const failed = receipts.length - verified;
  return { verified, failed, partial: verified > 0 && failed > 0 };
}
