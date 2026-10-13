/**
 * The native schedules screen's data path (CR-036 slice S9, read only): the typed reads of `/api/v1/access-control/...`
 * (backend routers/access_control_reads.py, services/intercom_adapter.py). The browser never names an integration command and
 * nothing here writes: the door programs and the public-code presence of one station are the stations screen's reads
 * (api/access-stations.ts, `access.stations.read` on that station), and the three installation-wide reads below are the
 * integration's schedule library, its deployment proposals and their check jobs (`access.stations.read` UNRESTRICTED - a caller
 * scoped to some stations is refused with an audited 403, so the screen only asks for them when the caller holds the permission at
 * installation scope).
 *
 * Shapes are W? until the integration's W2 delivery (the rc.37 reference copy was read, never run): every field is optional in
 * practice, so the screen reads them defensively and says "unknown" for what it cannot map, never a guess. Reply head of every
 * read: `{state, configured, last_error, fetched_at, fresh, schedules, sync}`; `schedules` is null unless `state` is `ready`.
 */
import { get } from './client';
import type { Period, ReadHead, StationPolicy, WeekdayName } from './access-stations';

/** A library schedule: the integration's own weekly windows and holidays. In the reference copy these are local drafts the
 * integration keeps - not applied to any station by themselves (the proposals below are how they would reach one). */
export interface LibrarySchedule {
  id: string;
  revision: number | null;
  updated_at: string | null;
  name: string | null;
  weekly: Partial<Record<WeekdayName, Period[]>>;
  holidays: StationPolicy['holidays'];
}

export type PlanSourceState = 'current' | 'changed' | 'missing' | 'unavailable' | 'unknown';
export type ResourceCoverage = 'complete' | 'partial' | 'failed' | 'unsupported' | 'not_checked' | 'unknown';
export type ResourceState = 'matches' | 'different' | 'not_observed' | 'unreadable' | 'unsupported' | 'unknown';

/** A deployment proposal: a library schedule prepared for one station, with the integration's last read-only comparison. */
export interface SchedulePlan {
  id: string;
  revision: number | null;
  station_id: string | null;
  /** The library schedule it was prepared from, and that schedule's revision at the time. */
  draft_id: string | null;
  draft_revision: number | null;
  name: string | null;
  created_at: string | null;
  source_state: PlanSourceState | null;
  can_apply: boolean;
  drifted_resources: (string | null)[];
  report: {
    checked_at: string | null;
    blockers: (string | null)[];
    resources: { kind: string | null; id: number | null; coverage: ResourceCoverage | null; state: ResourceState | null; active: boolean | null }[];
    users: { state: string | null; error: string | null } | null;
  } | null;
}

export type JobStatus = 'pending' | 'queued' | 'checking' | 'blocked' | 'ready' | 'interrupted' | 'failed' | 'cancelled' | 'verified' | 'unknown';

/** A check job of a proposal (the integration's background, read-only preflight). */
export interface ScheduleJob {
  id: string;
  revision: number | null;
  plan_id: string | null;
  station_id: string | null;
  name: string | null;
  status: JobStatus | null;
  error: string | null;
  blockers: (string | null)[];
  ownership: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScheduleOperations {
  jobs: ScheduleJob[];
  archive: ScheduleJob[];
  journal: { id: string; status: string | null; issue: string | null; created_at: string | null; updated_at: string | null; steps: { key: string | null; state: string | null; attempted: boolean }[] }[];
  claims: { id: string; plan_id: string | null; station_id: string | null; created_at: string | null }[];
  writes_enabled: boolean;
}

export type LibraryReply = ReadHead & { schedules: LibrarySchedule[] | null };
export type PlansReply = ReadHead & { schedules: SchedulePlan[] | null };
export type OperationsReply = ReadHead & { schedules: ScheduleOperations | null };

export const getScheduleLibrary = () => get<LibraryReply>('access-control/schedules');
export const getSchedulePlans = () => get<PlansReply>('access-control/schedules/plans');
export const getScheduleOperations = () => get<OperationsReply>('access-control/schedules/operations');
