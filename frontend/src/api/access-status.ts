/**
 * CR-036 S10: the typed reads of the Settings page "בקרת כניסה" (status, the intercom's own action log, groups and fields) - the page's
 * only data path to the intercom integration. The browser never names an integration command: every call is one typed Arx endpoint
 * under `/api/v1/access-control/...` (routers/access_control_reads.py), authorized by `access.admin.read` (the groups read by
 * `access.people.read`) and filtered per station by services/intercom_authority.py.
 *   GET status/stations                   the stations the caller sees on the status page (health and sync words, last seen)
 *   GET stations/{id}/health              one station's health card (polling, sync worker, event stream, clock)
 *   GET stations/{id}/health/history      its samples of the last seven days
 *   GET status/sync                       per-station sync COUNTS and their totals - never a person
 *   GET status/conflicts                  sync conflicts and errors (installation-wide administrators only)
 *   GET status/alerts                     fleet alerts, paged (offset / limit), `complete: false` when the integration held more
 *   GET status/audit                      the intercom's own action log, newest first, `before` = the previous page's `next_cursor`
 *   GET groups, groups/versions           the person groups and profile fields, and the history of that policy
 * Every reply is `{state, configured, last_error, fetched_at, <key>, sync}` (+ `fresh`): `<key>` is null unless `state` is `ready`.
 * Nothing here writes, and nothing here asks a device (the integration's own device polls are not offered in this stage).
 */
import { api, get } from './client';
import type { AccessFeedState } from './access-events';
import type { DisplayZone } from './intercom';

/** The integration's connection facts every reply carries (the page's subtitle reads them). */
export interface SyncMeta {
  state?: string | null;
  connected?: boolean | null;
  last_error?: string | null;
  reconnects?: number | null;
  started_at?: string | null;
  fetched_at?: string | null;
  refreshes?: number | null;
  sequence?: number | null;
  wiskey_version?: string | null;
}

export interface StatusHead {
  state: AccessFeedState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  /** False: served from the feed's cache after the integration stopped answering (last known, not current). */
  fresh?: boolean;
  sync?: SyncMeta | null;
}

// ---------------------------------------------------------------- stations

export interface StatusStation {
  id: string;
  name: string;
  online: boolean;
  call_state: string;
  /** offline / pending / syncing / synced / error, or `unknown` for any other value. */
  sync_state: string;
  last_seen: string | null;
  zone: DisplayZone | null;
  /** Null without `access.stations.read` (the model and firmware then do not appear). */
  technical: {
    model: string | null;
    firmware: string | null;
    clock?: { zone?: DisplayZone | null } | null;
  } | null;
  /** Null without `access.admin.read` on the station. */
  errors: { last_error: string | null; scan_error: string | null } | null;
}

export interface StatusStationsReply extends StatusHead {
  stations: StatusStation[] | null;
  default_zone: DisplayZone | null;
}

export const getStatusStations = () => get<StatusStationsReply>('access-control/status/stations');

// ---------------------------------------------------------------- one station's health

export interface StationHealth {
  loaded: boolean | null;
  online: boolean | null;
  firmware: string | null;
  consecutive_poll_failures: number | null;
  requests: { requests: number | null; failures: number | null; last_ms: number | null; p95_ms: number | null };
  access: {
    sync_state: string | null;
    last_error: string | null;
    pending_request: boolean | null;
    worker_active: boolean | null;
    queue_depth: number | null;
    assignment_states: Record<string, number>;
    errors: Record<string, number>;
  };
  /** Null when the station has no event stream to report. */
  events: { stream: string | null; history: string | null; reconnects: number | null; last_frame_at: string | null; storage_failed: boolean | null } | null;
  /** Null when the station's clock was never read. */
  clock: { status: string | null; skew_seconds: number | null; drift_state: string | null; time_mode: string | null; checked_at: string | null; error: string | null } | null;
  generated_at: string | null;
}

export interface StationHealthReply extends StatusHead {
  health: StationHealth | null;
}

export interface HealthSample {
  at: string | null;
  online: boolean | null;
  poll_ms: number | null;
  sync: string | null;
  events: string | null;
}

export interface StationHealthHistory {
  period_days: number | null;
  records: HealthSample[];
  storage_failed: boolean;
}

export interface StationHealthHistoryReply extends StatusHead {
  history: StationHealthHistory | null;
}

export const getStationHealth = (id: string, signal?: AbortSignal) => api<StationHealthReply>(`access-control/stations/${encodeURIComponent(id)}/health`, { signal });
export const getStationHealthHistory = (id: string, signal?: AbortSignal) => api<StationHealthHistoryReply>(`access-control/stations/${encodeURIComponent(id)}/health/history`, { signal });

// ---------------------------------------------------------------- sync

export interface SyncOperations {
  pending: number | null;
  failed: number | null;
  verified: number | null;
  settled: number | null;
}

export interface SyncStationRow {
  station_id: string;
  name: string | null;
  sync_state: string;
  reconciled_at: string | null;
  operations: SyncOperations;
  pending_users: number | null;
  managed_users: number | null;
  revocations_pending: number | null;
  card_removals_pending: number | null;
  pin_removals_pending: number | null;
  deletions_pending: number | null;
  last_error: string | null;
}

export interface SyncTotals {
  pending_users: number | null;
  managed_users: number | null;
  revocations_pending: number | null;
  card_removals_pending: number | null;
  pin_removals_pending: number | null;
  deletions_pending: number | null;
  operations: SyncOperations;
}

export interface SyncStatus {
  stations: SyncStationRow[];
  totals: SyncTotals;
}

export interface SyncStatusReply extends StatusHead {
  sync_status: SyncStatus | null;
}

export const getSyncStatus = () => get<SyncStatusReply>('access-control/status/sync');

// ---------------------------------------------------------------- conflicts

export interface ConflictPerson {
  id: string | null;
  display_name: string | null;
  employee_no: string | null;
}

export interface SyncConflict {
  /** `person`, `revocation`, ... (a kind the screen has no word for is shown as "other"). */
  kind: string;
  station_id: string;
  sync_state: string;
  last_error: string | null;
  person: ConflictPerson | null;
}

export interface ConflictsReply extends StatusHead {
  conflicts: SyncConflict[] | null;
}

export const getConflicts = () => get<ConflictsReply>('access-control/status/conflicts');

// ---------------------------------------------------------------- fleet alerts

export const ALERT_KINDS = ['offline', 'sync_stalled', 'sync_conflict', 'sync_error', 'event_gap', 'clock_drift'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export interface AlertSuppression {
  kind: string | null;
  /** planned_maintenance / network_work / investigating (or `unknown`). */
  reason: string | null;
  until: string | null;
  created_at: string | null;
}

export interface FleetAlert {
  id: string;
  station_id: string | null;
  station_name: string | null;
  kind: string;
  severity: 'warning' | 'error' | string;
  observed_since: string | null;
  observed_seconds: number | null;
  online: boolean | null;
  sync_state: string | null;
  suppressed: boolean;
  suppression: AlertSuppression | null;
}

export interface AlertsPage {
  items: FleetAlert[];
  total: number | null;
  active_count: number | null;
  suppressed_count: number | null;
  offset: number | null;
  limit: number | null;
  next_offset: number | null;
  /** False: the integration held more alerts than it sent (the counts cover what it sent). */
  complete: boolean;
  thresholds_seconds: Record<string, number> | null;
  station_thresholds_seconds: Record<string, Record<string, number>> | null;
  generated_at: string | null;
}

export interface AlertsReply extends StatusHead {
  alerts: AlertsPage | null;
}

export interface AlertsQuery {
  kind?: AlertKind | '';
  includeSuppressed?: boolean;
  offset?: number;
  limit?: number;
}

export const ALERTS_PAGE = 50;

export function alertsQueryString(o: AlertsQuery): string {
  const qs = new URLSearchParams();
  if (o.kind) qs.set('kind', o.kind);
  if (o.includeSuppressed) qs.set('include_suppressed', 'true');
  qs.set('offset', String(o.offset ?? 0));
  qs.set('limit', String(o.limit ?? ALERTS_PAGE));
  return qs.toString();
}

export const getAlerts = (o: AlertsQuery = {}) => get<AlertsReply>(`access-control/status/alerts?${alertsQueryString(o)}`);

// ---------------------------------------------------------------- the intercom's own action log

export interface AuditRecord {
  /** The integration's own sequence number: unique and falling down the page. */
  sequence: number;
  time: string | null;
  /** A machine code (`users/update`...), or `other` for text the server did not echo. */
  action: string | null;
  actor_name: string | null;
  /** The names of the fields that changed (never their values). */
  fields: Array<string | null>;
  revision_before: number | null;
  revision_after: number | null;
  /** Set when the action did not complete (`revision_conflict`...). */
  reason_code: string | null;
  stations: string[];
  person: ConflictPerson;
}

export interface AuditPage {
  records: AuditRecord[];
  /** The `before` of the next (older) page, or null at the end. */
  next_cursor: number | null;
  total: number | null;
  retention_days: number | null;
}

export interface AuditReply extends StatusHead {
  audit: AuditPage | null;
}

export interface AuditQuery {
  station_id?: string;
  action?: string;
  before?: number | null;
  limit?: number;
}

export const AUDIT_PAGE = 50;

export function auditQueryString(o: AuditQuery): string {
  const qs = new URLSearchParams();
  if (o.station_id) qs.set('station_id', o.station_id);
  if (o.action) qs.set('action', o.action);
  if (o.before) qs.set('before', String(o.before));
  qs.set('limit', String(o.limit ?? AUDIT_PAGE));
  return qs.toString();
}

export const getWiskeyAudit = (o: AuditQuery = {}) => get<AuditReply>(`access-control/status/audit?${auditQueryString(o)}`);

// ---------------------------------------------------------------- groups, fields and their history

export interface PersonGroup {
  id: string;
  label: string;
  enabled: boolean;
  /** The stations the group opens, or null when the integration does not say (the group applies to every station it is assigned on). */
  station_ids: string[] | null;
}

export interface ProfileField {
  id: string;
  label: string;
  enabled: boolean;
  /** text / select / number / date (or `unknown`). */
  type: string;
  required: boolean;
  unique: boolean;
  options: string[];
  depends_on: { field_id: string; value: string } | null;
}

export interface GroupsPolicy {
  revision: number | null;
  photo_enabled: boolean | null;
  groups: PersonGroup[];
  /** Null unless the caller holds `access.people.sensitive` or the unrestricted Settings status (they label profile values). */
  fields: ProfileField[] | null;
}

export interface GroupsReply extends StatusHead {
  groups: GroupsPolicy | null;
}

export const getGroups = () => get<GroupsReply>('access-control/groups');

export interface PolicyVersion {
  revision: number;
  saved_at: string | null;
  /** baseline / system / profiles/settings_update / bulk/group_policy / platform/lifecycle_apply (or `unknown`). */
  action: string | null;
  origin: string | null;
  field_changes: number | null;
  group_changes: number | null;
}

export interface PolicyVersions {
  records: PolicyVersion[];
  total: number | null;
  offset: number | null;
  next_offset: number | null;
  previous_offset: number | null;
  current_revision: number | null;
  retained_from_revision: number | null;
}

export interface VersionsReply extends StatusHead {
  versions: PolicyVersions | null;
}

export const VERSIONS_PAGE = 20;

export const getGroupVersions = (offset = 0, limit = VERSIONS_PAGE) => get<VersionsReply>(`access-control/groups/versions?offset=${offset}&limit=${limit}`);
