/**
 * CR-036 S10: the pure logic of the Settings page "בקרת כניסה" - what each word, dot and number of the status, the intercom's action
 * log and the groups view is made of, with no DOM and no Hebrew: every function answers with a KEY (the page's strings live in
 * i18n/access-status.ts) or with plain data, so the node unit tests (tests/unit-access-status-logic.spec.ts) run without a browser.
 *
 * What the page never does with a value: show a code the integration sent as its own sentence (a code is looked up; an unknown one
 * is shown as the code, in a muted technical style - a Settings page keeps the technical truth); count or sum a person (the sync
 * reads are counts only); colour by anything but a state the server named (an unknown state is "unknown", never "ok").
 */
import type {
  AlertsPage,
  AuditPage,
  FleetAlert,
  HealthSample,
  PersonGroup,
  PolicyVersions,
  ProfileField,
  AuditRecord,
  StatusStation,
  SyncConflict,
  SyncMeta,
  SyncStationRow,
  SyncStatus,
} from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import type { StateKind } from '../components/sw-badge';
import { addDays, dateLabel, dateOf, localDate, localTime } from './events-logic';

// ---------------------------------------------------------------- stations: the dot and the sync word

export type Dot = 'ok' | 'warn' | 'err' | 'off' | 'unk';

/** The colour of a station's dot in the health list: green only for a station that is online AND synced. */
export function stationDot(s: Pick<StatusStation, 'online' | 'sync_state'>): Dot {
  if (!s.online) return 'off';
  switch (s.sync_state) {
    case 'synced':
      return 'ok';
    case 'pending':
    case 'syncing':
      return 'warn';
    case 'error':
      return 'err';
    case 'offline':
      return 'off';
    default:
      return 'unk';
  }
}

export type SyncWord = 'synced' | 'pending' | 'syncing' | 'error' | 'offline' | 'conflict' | 'delete_pending' | 'unknown';
const SYNC_WORDS: SyncWord[] = ['synced', 'pending', 'syncing', 'error', 'offline', 'conflict', 'delete_pending'];

/** A sync state as a pill: the badge kind and the key of its word (`sync_<word>`). Any other value is "unknown". */
export function syncPill(state: string | null | undefined, online = true): { kind: StateKind; word: SyncWord } {
  if (online === false) return { kind: 'offline', word: 'offline' };
  const word: SyncWord = (SYNC_WORDS as string[]).includes(state ?? '') ? (state as SyncWord) : 'unknown';
  const kind: Record<SyncWord, StateKind> = {
    synced: 'live',
    pending: 'stale',
    syncing: 'recorded',
    error: 'error',
    conflict: 'error',
    offline: 'offline',
    delete_pending: 'stale',
    unknown: 'unknown',
  };
  return { kind: kind[word], word };
}

// ---------------------------------------------------------------- time words

export type Age =
  | { key: 'none' }
  | { key: 'now' }
  | { key: 'minute' }
  | { key: 'minutes'; n: number }
  | { key: 'hours'; n: number }
  | { key: 'today'; time: string }
  | { key: 'yesterday'; time: string }
  | { key: 'date'; date: string; time: string };

/** How long ago `iso` was, in the words a status page uses ("now", "a minute ago", "12 min ago", "3 h ago", "yesterday 19:02", a date).
 * Day boundaries are the zone's; a future instant (a clock a little ahead) reads as "now". */
export function age(iso: string | null | undefined, now: Date, zone: DisplayZone): Age {
  if (!iso || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(iso)) return { key: 'none' };
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { key: 'none' };
  const diff = (now.getTime() - ms) / 1000;
  if (diff < 45) return { key: 'now' };
  if (diff < 90) return { key: 'minute' };
  if (diff < 3600) return { key: 'minutes', n: Math.round(diff / 60) };
  if (diff < 6 * 3600) return { key: 'hours', n: Math.floor(diff / 3600) };
  const time = localTime(iso, zone);
  const day = dateOf(iso, zone);
  const today = localDate(now.getTime(), zone);
  if (day === today) return { key: 'today', time };
  if (day === addDays(today, -1)) return { key: 'yesterday', time };
  return { key: 'date', date: dateLabel(day).replace(/\.\d{4}$/, ''), time };
}

export type When = { key: 'none' } | { key: 'today'; time: string } | { key: 'yesterday'; time: string } | { key: 'tomorrow'; time: string } | { key: 'date'; date: string; time: string };

/** An instant (past or future) against the zone's calendar: today, yesterday, tomorrow, or a date - with its time. */
export function whenOf(iso: string | null | undefined, now: Date, zone: DisplayZone): When {
  if (!iso || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(iso) || !Number.isFinite(Date.parse(iso))) return { key: 'none' };
  const time = localTime(iso, zone);
  const day = dateOf(iso, zone);
  const today = localDate(now.getTime(), zone);
  if (day === today) return { key: 'today', time };
  if (day === addDays(today, -1)) return { key: 'yesterday', time };
  if (day === addDays(today, 1)) return { key: 'tomorrow', time };
  return { key: 'date', date: dateLabel(day).replace(/\.\d{4}$/, ''), time };
}

export type Duration = { key: 'minutes'; n: number } | { key: 'hours'; n: number } | { key: 'days'; n: number };

/** A length of time in seconds as the nearest whole unit (minutes below an hour - an alert is never "0 seconds" - hours below a day). */
export function duration(seconds: number | null | undefined): Duration | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 3600) return { key: 'minutes', n: Math.max(1, Math.round(seconds / 60)) };
  if (seconds < 86_400) return { key: 'hours', n: Math.round(seconds / 3600) };
  return { key: 'days', n: Math.round(seconds / 86_400) };
}

/** The zone a station's times are read in: its own clock zone, else the installation's default, else UTC. */
export function zoneOfStation(stations: StatusStation[] | null, id: string | null | undefined, fallback: DisplayZone | null): DisplayZone {
  return stations?.find((s) => s.id === id)?.zone ?? fallback ?? { kind: 'iana', name: 'UTC' };
}

// ---------------------------------------------------------------- the page's headline

export interface Headline {
  version: string | null;
  /** true / false when the integration said; null when it did not. */
  connected: boolean | null;
  checked: Age;
}

/** The subtitle facts the Settings page keeps: the integration's version, whether it is connected, when it was last asked. */
export function headline(meta: SyncMeta | null | undefined, now: Date, zone: DisplayZone): Headline {
  const version = typeof meta?.wiskey_version === 'string' && meta.wiskey_version ? meta.wiskey_version : null;
  const connected = typeof meta?.connected === 'boolean' ? meta.connected : null;
  return { version, connected, checked: age(meta?.fetched_at ?? null, now, zone) };
}

// ---------------------------------------------------------------- the four tiles

export interface Kpis {
  online: number;
  total: number;
  /** People waiting to be synced (the sync totals); null when the sync read is not there. */
  pending: number | null;
  /** Sync conflicts and errors; null when the caller has no installation-wide view of them. */
  conflicts: number | null;
  /** The newest reconciliation across the stations, an aware ISO instant. */
  lastSync: string | null;
}

export function kpis(stations: StatusStation[] | null, sync: SyncStatus | null, conflicts: SyncConflict[] | null): Kpis {
  const rows = stations ?? [];
  const stamps = (sync?.stations ?? []).map((r) => r.reconciled_at).filter((v): v is string => !!v && Number.isFinite(Date.parse(v)));
  const last = stamps.length ? stamps.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
  return {
    online: rows.filter((s) => s.online).length,
    total: rows.length,
    pending: sync ? (sync.totals.pending_users ?? 0) : null,
    conflicts: conflicts ? conflicts.length : null,
    lastSync: last,
  };
}

// ---------------------------------------------------------------- sync table

export interface SyncRowView {
  id: string;
  name: string;
  managed: number | null;
  pending: number;
  /** Removals still waiting: revocations, card and PIN removals, deletions. */
  removals: number;
  failed: number;
  reconciledAt: string | null;
  state: string;
  error: string | null;
}

const n0 = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function syncRows(sync: SyncStatus | null, nameOf: (id: string) => string): SyncRowView[] {
  return (sync?.stations ?? []).map((r: SyncStationRow) => ({
    id: r.station_id,
    name: r.name || nameOf(r.station_id),
    managed: r.managed_users,
    pending: n0(r.pending_users),
    removals: n0(r.revocations_pending) + n0(r.card_removals_pending) + n0(r.pin_removals_pending) + n0(r.deletions_pending),
    failed: n0(r.operations?.failed),
    reconciledAt: r.reconciled_at,
    state: r.sync_state,
    error: r.last_error,
  }));
}

// ---------------------------------------------------------------- codes (errors, actions, fields)

/** Error codes the page has a word for; any other code is shown as the code. */
export const ERROR_CODES = [
  'device_unavailable',
  'revision_conflict',
  'rate_limited',
  'timeout',
  'unauthorized',
  'authentication_failed',
  'station_offline',
  'invalid_response',
  'other',
] as const;

export const errorKey = (code: string | null | undefined): string | null => (code && (ERROR_CODES as readonly string[]).includes(code) ? `err_${code}` : null);

/** The intercom's action codes the page has a word for (`act_<name>`, `/` as `_`); any other code is shown as the code. */
export const AUDIT_ACTIONS = [
  'users/create',
  'users/update',
  'users/delete',
  'users/set_active',
  'users/archive',
  'users/pin_generate',
  'cards/add',
  'cards/remove',
  'profiles/settings_update',
  'profiles/settings_apply',
  'bulk/group_policy',
  'stations/test_unlock',
  'stations/technical_update',
  'stations/rescan',
  'stations/clock_refresh',
  'conflicts/resolve',
  'sync/run',
] as const;

export const actionKey = (code: string | null | undefined): string | null => (code && (AUDIT_ACTIONS as readonly string[]).includes(code) ? `act_${code.replace('/', '_')}` : null);

/** The names of the fields an action changed that the page has a word for (`fld_<name>`); any other is shown as the name. */
export const AUDIT_FIELDS = ['display_name', 'employee_no', 'valid_until', 'valid_from', 'phone', 'groups', 'stations', 'photo', 'pin', 'cards', 'profile', 'access_timing', 'active', 'archived'] as const;
export const fieldKey = (name: string | null | undefined): string | null => (name && (AUDIT_FIELDS as readonly string[]).includes(name) ? `fld_${name}` : null);

// ---------------------------------------------------------------- fleet alerts

export const alertKindKey = (kind: string | null | undefined): string => (kind && ['offline', 'sync_stalled', 'sync_conflict', 'sync_error', 'event_gap', 'clock_drift'].includes(kind) ? `alert_${kind}` : 'alert_other');

export type AlertTone = 'err' | 'warn' | 'muted';

/** A suppressed alert is muted whatever its severity; otherwise the server's severity (an unknown one is a warning, never an error). */
export function alertTone(a: Pick<FleetAlert, 'severity' | 'suppressed'>): AlertTone {
  if (a.suppressed) return 'muted';
  return a.severity === 'error' ? 'err' : 'warn';
}

export const suppressionKey = (reason: string | null | undefined): string => (reason && ['planned_maintenance', 'network_work', 'investigating'].includes(reason) ? `sup_${reason}` : 'sup_other');

/** The next page appended to the shown one (an alert already shown is not repeated); the counts and the cursor are the new page's. */
export function appendAlerts(prev: AlertsPage | null, next: AlertsPage): AlertsPage {
  if (!prev) return next;
  const seen = new Set(prev.items.map((i) => i.id));
  return { ...next, items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))] };
}

// ---------------------------------------------------------------- conflicts

export const conflictKindKey = (kind: string | null | undefined): string => (kind && ['person', 'removal', 'revocation'].includes(kind) ? `conflict_${kind}` : 'conflict_other');

/** Who a conflict concerns, as far as the server said: the name, else the employee number, else nobody the page can name. */
export function conflictWho(c: Pick<SyncConflict, 'person'>): { kind: 'name'; text: string } | { kind: 'employee'; text: string } | { kind: 'unnamed' } {
  const p = c.person;
  if (p?.display_name) return { kind: 'name', text: p.display_name };
  if (p?.employee_no) return { kind: 'employee', text: p.employee_no };
  return { kind: 'unnamed' };
}

// ---------------------------------------------------------------- the intercom's action log

/** The next (older) page appended to the shown one; a record already shown (the same sequence) is not repeated. */
export function appendAudit(prev: AuditPage | null, next: AuditPage): AuditPage {
  if (!prev) return next;
  const seen = new Set(prev.records.map((r) => r.sequence));
  return { ...next, records: [...prev.records, ...next.records.filter((r) => !seen.has(r.sequence))] };
}

export type AuditTarget =
  | { kind: 'person'; name: string | null; employee: string | null }
  | { kind: 'stations'; ids: string[]; more: number }
  | { kind: 'none' };

/** What an action was done to: the person when the record names one, else the stations it touched (the first two and a count). */
export function auditTarget(r: Pick<AuditRecord, 'person' | 'stations'>): AuditTarget {
  const p = r.person;
  if (p && (p.display_name || p.employee_no)) return { kind: 'person', name: p.display_name, employee: p.employee_no };
  if (r.stations.length) return { kind: 'stations', ids: r.stations.slice(0, 2), more: Math.max(0, r.stations.length - 2) };
  return { kind: 'none' };
}

/** `done` for an action that completed; otherwise the failure code the record carries. */
export const auditResult = (r: Pick<AuditRecord, 'reason_code'>): { kind: 'done' } | { kind: 'failed'; code: string } => (r.reason_code ? { kind: 'failed', code: r.reason_code } : { kind: 'done' });

/** The fields an action changed, named (an empty or unknown field name is dropped). */
export const auditFields = (r: Pick<AuditRecord, 'fields'>): string[] => r.fields.filter((f): f is string => typeof f === 'string' && f.length > 0);

// ---------------------------------------------------------------- groups and fields

export type GroupRule = { kind: 'all' } | { kind: 'none' } | { kind: 'unknown' } | { kind: 'stations'; ids: string[] };

/** The station rule of a group: every station the page knows, none, "not stated", or the named ones. */
export function groupRule(g: Pick<PersonGroup, 'station_ids'>, knownStationIds: string[]): GroupRule {
  const ids = g.station_ids;
  if (ids === null || ids === undefined) return { kind: 'unknown' };
  if (!ids.length) return { kind: 'none' };
  if (knownStationIds.length && knownStationIds.every((s) => ids.includes(s))) return { kind: 'all' };
  return { kind: 'stations', ids };
}

export const fieldTypeKey = (type: string | null | undefined): string => (type && ['text', 'select', 'number', 'date'].includes(type) ? `ftype_${type}` : 'ftype_unknown');

/** What a profile field says about itself beyond its type: required, unique, depends on another field. */
export function fieldFlags(f: Pick<ProfileField, 'required' | 'unique' | 'depends_on' | 'enabled'>): Array<'required' | 'unique' | 'depends' | 'disabled'> {
  const out: Array<'required' | 'unique' | 'depends' | 'disabled'> = [];
  if (f.required) out.push('required');
  if (f.unique) out.push('unique');
  if (f.depends_on) out.push('depends');
  if (!f.enabled) out.push('disabled');
  return out;
}

/** The options of a select field for one line: the first few and how many more. */
export function optionsLine(options: string[], shown = 4): { shown: string[]; more: number } {
  return { shown: options.slice(0, shown), more: Math.max(0, options.length - shown) };
}

export const versionActionKey = (action: string | null | undefined): string =>
  action && ['baseline', 'system', 'profiles/settings_update', 'bulk/group_policy', 'platform/lifecycle_apply'].includes(action) ? `ver_${action.replace('/', '_')}` : 'ver_other';

/** The next page of the policy history appended to the shown one (a revision already shown is not repeated). */
export function appendVersions(prev: PolicyVersions | null, next: PolicyVersions): PolicyVersions {
  if (!prev) return next;
  const seen = new Set(prev.records.map((r) => r.revision));
  return { ...next, records: [...prev.records, ...next.records.filter((r) => !seen.has(r.revision))] };
}

/** How many entries of the policy history the integration still holds beyond the shown ones; 0 at the end. */
export function versionsLeft(v: PolicyVersions | null): number {
  if (!v || v.next_offset === null || v.next_offset === undefined) return 0;
  return Math.max(0, (v.total ?? v.next_offset) - v.next_offset);
}

// ---------------------------------------------------------------- one station's health

export type Tone = 'ok' | 'warn' | 'err' | 'off' | 'unk';

export function streamTone(stream: string | null | undefined): Tone {
  switch (stream) {
    case 'connected':
      return 'ok';
    case 'connecting':
      return 'warn';
    case 'disconnected':
    case 'authentication_failed':
    case 'unavailable':
      return 'err';
    case 'stopped':
      return 'off';
    default:
      return 'unk';
  }
}

export function historyTone(history: string | null | undefined): Tone {
  switch (history) {
    case 'recovered':
      return 'ok';
    case 'pending':
      return 'warn';
    case 'offline':
    case 'incomplete':
    case 'unavailable':
    case 'authentication_failed':
      return 'err';
    default:
      return 'unk';
  }
}

export function driftTone(drift: string | null | undefined): Tone {
  switch (drift) {
    case 'within_tolerance':
      return 'ok';
    case 'not_measured':
    case 'uncertain':
      return 'warn';
    case 'ahead':
    case 'behind':
    case 'repeated_ahead':
    case 'repeated_behind':
      return 'err';
    default:
      return 'unk';
  }
}

export function clockTone(status: string | null | undefined): Tone {
  return status === 'ready' ? 'ok' : status === 'stale' ? 'warn' : status === 'unavailable' ? 'err' : 'unk';
}

/** The key of a closed-set word (`stream_connected`, `drift_ahead`...) or `<prefix>unknown`. */
export function wordKey(prefix: string, value: string | null | undefined, allowed: readonly string[]): string {
  return `${prefix}${value && allowed.includes(value) ? value : 'unknown'}`;
}

export const STREAMS = ['connecting', 'connected', 'disconnected', 'authentication_failed', 'unavailable', 'stopped'] as const;
export const HISTORIES = ['pending', 'offline', 'unavailable', 'recovered', 'authentication_failed', 'incomplete'] as const;
export const DRIFTS = ['not_measured', 'within_tolerance', 'uncertain', 'ahead', 'behind', 'repeated_ahead', 'repeated_behind'] as const;
export const CLOCKS = ['ready', 'stale', 'unavailable'] as const;
export const TIME_MODES = ['NTP', 'manual', 'satellite', 'platform', 'NONE', 'GB28181', 'unknown'] as const;

export interface DayHealth {
  /** YYYY-MM-DD in the station's zone. */
  date: string;
  samples: number;
  /** The share of samples that were online, 0..100; null when none said. */
  onlinePct: number | null;
  /** The mean poll time of the samples that carried one, rounded; null when none did. */
  pollMs: number | null;
  tone: 'none' | 'ok' | 'warn' | 'err';
}

/** The last `days` local days (the oldest first, today last) of a station's samples: how much of each day it was online, how fast it
 * answered, and one tone - ok (always online, nothing wrong), warn (a gap or a sync problem), err (online less than half the day). */
export function dailyHealth(records: HealthSample[], zone: DisplayZone, now: Date, days = 7): DayHealth[] {
  const today = localDate(now.getTime(), zone);
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
  return dates.map((date) => {
    const mine = records.filter((r) => dateOf(r.at, zone) === date);
    const known = mine.filter((r) => r.online !== null);
    const onlinePct = known.length ? Math.round((known.filter((r) => r.online).length / known.length) * 100) : null;
    const polls = mine.map((r) => r.poll_ms).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const trouble = mine.some((r) => r.sync === 'error' || r.sync === 'conflict');
    let tone: DayHealth['tone'] = 'none';
    if (onlinePct !== null) tone = onlinePct < 50 ? 'err' : onlinePct < 99 || trouble ? 'warn' : 'ok';
    return { date, samples: mine.length, onlinePct, pollMs: polls.length ? Math.round(polls.reduce((a, b) => a + b, 0) / polls.length) : null, tone };
  });
}

// ---------------------------------------------------------------- how a read that did not answer is spoken of

export type PanelKind = 'not_configured' | 'connecting' | 'unavailable' | 'not_installed' | 'unsupported' | 'forbidden' | 'rate' | 'error';

/** A reply that is not `ready` (or a failure the page met), reduced to the one panel it shows. */
export function panelKind(state: string, lastError: string | null): PanelKind {
  switch (state) {
    case 'ha_not_configured':
      return 'not_configured';
    case 'connecting':
      return 'connecting';
    case 'not_installed':
      return 'not_installed';
    case 'forbidden':
      return 'forbidden';
    case 'unsupported':
      return 'unsupported';
    default:
      if (lastError === 'rate_limited' || lastError === 'busy' || lastError === 'timeout') return 'rate';
      return state === 'ready' ? 'error' : 'unavailable';
  }
}
