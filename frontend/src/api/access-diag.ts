/**
 * WISKEY-ACCESS-DIAG-2400 (plan 2026-11-03 T10): the "אבחון הרשאות" screen's data path - typed reads of
 * `/api/v1/access-control/diag/...` (backend routers/access_control_diag.py, services/wiskey_access_diag.py) and the one write, the periodic
 * review decision. The browser never names an access-control command; the server decides every permission (access.read at installation
 * scope; people views access.people.read; the decision access.people.manage on the door's station) and drops what nobody may see (PINs,
 * card numbers or their digits, phone numbers).
 *
 * Reply head of the reads: `{state, last_error, fetched_at, <key>}`; `<key>` is null unless `state` is `ready`.
 */
import { get, post } from './client';
import { serverNow, type DisplayZone } from './intercom';
import { commandId } from './request-id';

export interface DiagHead {
  state: string;
  last_error: string | null;
  fetched_at: string | null;
}

export type DiagFeature = 'pickers' | 'scenario' | 'compare' | 'compare_doors' | 'reviews' | 'review_decide' | 'quality' | 'lifecycle' | 'sync' | 'permission_audit';

export interface DiagDoor {
  lock_id: 1 | 2;
  name: string | null;
}

export interface DiagStation {
  id: string;
  name: string;
  online: boolean;
  zone: DisplayZone | null;
  doors: DiagDoor[];
}

export interface DiagHome {
  feed: string;
  features: Record<DiagFeature, { available: boolean | null; reason: string | null }>;
  can: { people: boolean; decide: boolean; sensitive: boolean; employee_no: boolean };
  doors: DiagStation[] | null;
  default_zone: DisplayZone | null;
}

export interface DiagOption {
  id: string;
  name: string;
  archived: boolean;
}

export interface DiagPage {
  total: number | null;
  offset: number | null;
  limit: number | null;
  next_offset: number | null;
  previous_offset: number | null;
}

export type ScenarioReason = 'allowed' | 'archived' | 'inactive' | 'no_assignment' | 'lock_not_assigned' | 'outside_validity' | 'outside_schedule' | 'unknown';
export type GrantSource = 'personal_deny' | 'personal_allow' | 'inherited' | 'restricted' | 'assignment' | 'none' | 'group_policy' | 'unknown';

export interface GrantSide {
  granted: boolean;
  configured: boolean;
  source: GrantSource;
  groups: { id: string; name: string }[];
  override: 'allow' | 'deny' | 'unknown' | null;
  sources_known: boolean;
}

export interface DiagLabel {
  kind: 'person' | 'group' | 'unknown';
  id: string | null;
  name: string;
  active?: boolean;
  archived?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  timing_mode?: string;
  enabled?: boolean;
}

export interface Scenario {
  person_revision: number | null;
  station_id: string | null;
  lock_id: 1 | 2 | null;
  at: string | null;
  desired: { allowed: boolean; reason: ScenarioReason; timing_mode: string; draft_ignored: boolean };
  observed: {
    sync_state: string;
    last_sync_at: string | null;
    revision_matches: boolean;
    timing: { status: string; mode: string | null; checked_at: string | null; valid_from: string | null; valid_until: string | null; interval_contains_target: boolean | null };
  };
  station_status: string;
  physical_result: 'not_verified';
  source: GrantSide | null;
  person: DiagLabel | null;
}

export type ScenarioReply = DiagHead & {
  scenario: Scenario | null;
  station: { id: string; name: string; online: boolean; door_name: string | null } | null;
};

export type Relation = 'shared' | 'left_only' | 'right_only' | 'neither' | 'unknown';

export interface CompareRow {
  station_id: string;
  station_name: string;
  lock_id: 1 | 2;
  relation: Relation;
  left: GrantSide;
  right: GrantSide;
}

export interface Comparison {
  left: DiagLabel;
  right: DiagLabel;
  rows: CompareRow[];
  summary: Record<'shared' | 'left_only' | 'right_only' | 'neither', number>;
}

export interface DoorCompareRow {
  user_id: string;
  display_name: string;
  relation: Relation;
  left: boolean;
  right: boolean;
  left_assigned: boolean;
  right_assigned: boolean;
  archived: boolean;
}

export interface DoorComparison {
  rows: DoorCompareRow[];
  summary: Record<'shared' | 'left_only' | 'right_only' | 'neither', number>;
  complete: boolean;
}

export interface Schedule {
  mode: string;
  timezone: string | null;
  days: string[];
  dates: string[];
  periods: { start: string; end: string }[];
}

export interface Central {
  active: boolean;
  archived: boolean;
  valid_from: string | null;
  valid_until: string | null;
  assignment_enabled: boolean;
  granted: boolean;
  timing_mode: string;
  schedule: Schedule | null;
}

export interface Receipt {
  id: string;
  decision: 'keep' | 'followup' | 'unknown';
  reason: string;
  cadence_days: number | null;
  at: string | null;
  due_at: string | null;
  person_revision: number | null;
  /** the Arx user who decided, when the decision was taken in Arx (WisKey's own receipt names only the system identity) */
  arx_actor: string | null;
}

export type ReviewStatus = 'pending' | 'due' | 'stale' | 'completed' | 'followup' | 'archived' | 'unknown';

export interface ReviewRow {
  user_id: string;
  display_name: string;
  person_revision: number | null;
  status: ReviewStatus;
  central: Central;
  latest: Receipt | null;
  sync_state: string;
}

export interface ReviewsPage extends DiagPage {
  snapshot: string;
  stale: boolean;
  records: ReviewRow[];
  summary: Record<Exclude<ReviewStatus, 'unknown'>, number>;
}

export interface ReviewPreview {
  user_id: string | null;
  station_id: string | null;
  lock_id: 1 | 2 | null;
  person_revision: number | null;
  fingerprint: string;
  latest_id: string;
  central: Central;
  history: Receipt[];
}

export type PreviewReply = DiagHead & { preview: ReviewPreview | null; decide: { available: boolean | null; reason: string | null; allowed: boolean } };

export interface DecideResult {
  status: 'saved';
  command_id: string;
  receipt: Receipt;
  access_changed: false;
}

export interface QualityIssue {
  kind: 'missing' | 'invalid' | 'duplicate' | 'unknown';
  code: string;
  field_id: string | null;
  label: string;
  related_count: number;
  related_people: { id: string; display_name: string; archived: boolean; employee_no: string | null }[];
}

export interface QualityRow {
  id: string;
  display_name: string;
  employee_no: string | null;
  revision: number | null;
  archived: boolean;
  issues: QualityIssue[];
}

export interface QualityPage extends DiagPage {
  snapshot: string;
  stale: boolean;
  coverage: { scanned: number; archived: number; unknown_fields: number };
  summary: { people: number; missing: number; invalid: number; duplicate: number };
  records: QualityRow[];
}

export interface LifeRow {
  id: string;
  display_name: string;
  employee_no: string | null;
  access_category: 'staff' | 'visitor' | 'contractor' | 'unknown';
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  assignment_count: number;
  state?: string;
  seconds_remaining?: number | null;
  expiring_soon?: boolean;
}

export interface Lifecycle {
  generated_at: string | null;
  warning_days: number | null;
  summary: Record<'total' | 'active' | 'scheduled' | 'expired' | 'expiring' | 'without_credentials' | 'duplicate_groups' | 'duplicate_users', number>;
  expirations: LifeRow[];
  temporary: { summary: Record<string, number>; users: LifeRow[] };
  duplicates: { reason: 'display_name' | 'phone' | 'card_last4' | 'unknown'; users: { id: string; display_name: string }[] }[];
  without_credentials: LifeRow[] | null;
  truncated: Record<string, boolean>;
}

export interface SyncDiag {
  integration_version: string | null;
  retention: string | null;
  stations: { station_ref: string; state: string; last_error: string | null; loaded: boolean; managed_lock: boolean; worker_active: boolean; pending_request: boolean; reconciliation_targets: number }[];
  recent: { at: string | null; station_ref: string; step: string; outcome: string; error: string | null; status_code: number | null; sub_status: string | null }[];
  failures: Record<string, number>;
}

export interface PermissionAudit {
  station_id: string | null;
  checked_at: string | null;
  device_writes: number;
  complete: boolean;
  total_candidates: number;
  counts: Record<'matched' | 'drift' | 'unmanaged' | 'unverified', number>;
  rows: { user_id: string | null; display_name: string | null; employee_no: string | null; status: 'matched' | 'drift' | 'unmanaged' | 'unverified' | 'unknown'; differences: string[]; error: string | null }[];
}

const q = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const BASE = 'access-control/diag';

export const getDiagHome = () => get<DiagHome>(BASE);
export const getDiagOptions = (kind: 'person' | 'group', query: string, offset = 0, limit = 25) =>
  get<DiagHead & { options: (DiagPage & { records: DiagOption[] }) | null }>(`${BASE}/options${q({ kind, query, offset, limit })}`);
export const getScenario = (userId: string, stationId: string, lockId: number, at?: string | null) =>
  get<ScenarioReply>(`${BASE}/scenario${q({ user_id: userId, station_id: stationId, lock_id: lockId, at })}`);
export const getCompare = (kind: 'person' | 'group', leftId: string, rightId: string) =>
  get<DiagHead & { compare: Comparison | null }>(`${BASE}/compare${q({ left_kind: kind, left_id: leftId, right_kind: kind, right_id: rightId })}`);
export const getCompareDoors = (left: string, right: string) => get<DiagHead & { doors: DoorComparison | null }>(`${BASE}/compare-doors${q({ left, right })}`);
export const getReviews = (stationId: string, lockId: number, state = 'all', offset = 0, snapshot = '') =>
  get<DiagHead & { reviews: ReviewsPage | null }>(`${BASE}/reviews${q({ station_id: stationId, lock_id: lockId, state, offset, limit: 50, snapshot })}`);
export const getReviewPreview = (userId: string, stationId: string, lockId: number) =>
  get<PreviewReply>(`${BASE}/reviews/preview${q({ user_id: userId, station_id: stationId, lock_id: lockId })}`);
export const getQuality = (kind = 'all', state = 'current', offset = 0, snapshot = '') =>
  get<DiagHead & { quality: QualityPage | null }>(`${BASE}/quality${q({ kind, state, offset, limit: 50, snapshot })}`);
export const getLifecycle = (days: number) => get<DiagHead & { lifecycle: Lifecycle | null }>(`${BASE}/lifecycle${q({ days })}`);
export const getSyncDiag = () => get<DiagHead & { diagnostics: SyncDiag | null }>(`${BASE}/sync`);
export const getPermissionAudit = (stationId: string) => get<DiagHead & { audit: PermissionAudit | null }>(`${BASE}/stations/${encodeURIComponent(stationId)}/permission-audit`);

export interface DecideInput {
  user_id: string;
  station_id: string;
  lock_id: number;
  person_revision: number;
  fingerprint: string;
  latest_id: string;
  decision: 'keep' | 'followup';
  reason: string;
  cadence_days: number;
}

/** The review decision - only after the confirmation step (`confirmed: true`); sent once, never retried by the screen. */
export function postDecide(input: DecideInput, nowMs = serverNow()) {
  const expires = new Date(nowMs + 15_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return post<DecideResult>(`${BASE}/reviews/decide`, { ...input, confirmed: true, client_request_id: commandId(), expires_at: expires });
}
