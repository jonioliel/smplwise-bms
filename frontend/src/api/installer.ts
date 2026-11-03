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
