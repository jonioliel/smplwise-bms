/**
 * The device schedule library's write side (WISKEY-SCHED-WRITE-2390; backend routers/access_control_schedule_writes.py). The browser
 * never names an integration command: every action is one closed Arx name posted to `access-control/schedules/actions/{action}`.
 *
 * - READS (`check`, `import_preview`, `readiness`, `dependencies`, `assess`, `plan_preview`, `claim_preview`): no confirmation; a preview
 *   answer carries a `preview_id` (or `check_id`) that only this user can use, once, for the matching write.
 * - WRITES: the command envelope (`client_request_id`, `expires_at`) and `confirmed: true`, which only a confirmation dialog sends. One
 *   call per deliberate click; nothing here retries, queues or runs by itself.
 * - Deploy: one POST for several proposals; the jobs are then followed with `getJobs` until each reached a final state.
 *
 * The pure helpers (outcome reading) are what the unit spec checks.
 */
import { ApiError, get, post } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';
import type { LibrarySchedule, SchedulePlan, ScheduleJob } from './access-schedules';
import type { Period, WeekdayName } from './access-stations';

export type Week = Record<WeekdayName, Period[]>;
export interface HolidayDraft {
  name: string;
  start: string;
  end: string;
  periods: Period[];
}
export interface Draft {
  name: string;
  weekly: Week;
  holidays: HolidayDraft[];
}
export interface Bindings {
  template: number;
  weekly: number;
  holiday_group: number | null;
  holidays: number[];
}

export interface Capability {
  ids?: [number, number] | null;
  period_ids?: [number, number] | null;
  name_length?: [number, number] | null;
  holiday_ids?: [number, number] | null;
  week_ids?: [number, number] | null;
  group_ids?: [number, number] | null;
  max_periods?: number | null;
  precision?: 'hour' | 'minute' | 'second' | 'unknown' | null;
  weekdays?: WeekdayName[];
}
export type Kind = 'template' | 'weekly' | 'holiday_group' | 'holiday';

export interface PeopleCounts {
  state: 'complete' | 'failed' | 'unknown' | null;
  error: string | null;
  read: number | null;
  explicit: number | null;
  implicit: number | null;
  malformed: number | null;
}
export interface StationImpact {
  id: string;
  name: string | null;
  online: boolean | null;
  doors: { index: number | null; name: string | null }[];
}
export interface ResourceRow {
  kind: Kind | 'unknown' | null;
  id: number | null;
  coverage: string | null;
  state: string | null;
  active: boolean | null;
  fields?: string[];
  externally_referenced?: boolean | null;
}
export interface Impact {
  station: StationImpact | null;
  people?: PeopleCounts | null;
  blockers?: (string | null)[];
  resources?: ResourceRow[];
}

export interface CheckResult {
  date: string | null;
  time: string | null;
  weekday: WeekdayName | 'unknown' | null;
  source: 'weekly' | 'holiday' | 'unknown' | null;
  holiday: string | null;
  periods: Period[];
  within_window: boolean | null;
  applied: false;
}
export interface Readiness {
  checked_at: string | null;
  can_apply: boolean;
  reason: string | null;
  checks: { kind: Kind | null; advertised: boolean | null; capabilities: Capability | null; read_state: string | null; error: string | null; coverage: string | null; read: number | null; total: number | null }[];
}
export interface Assessment {
  checked_at: string | null;
  complete: boolean;
  assessment: {
    state: 'fits' | 'exceeds' | 'unknown' | null;
    requirements: Record<string, number | null>;
    limits: { key: string | null; needed: number | null; available: number | null; state: 'fits' | 'exceeds' | 'unknown' | null }[];
    can_apply: boolean;
    inventory_complete: boolean;
    blockers: (string | null)[];
  };
  baseline: { state: string | null; revision: number | null; checked_at: string | null; checks: { kind: string | null; state: string | null; modified: number | null; added: number | null; removed: number | null }[] };
}
export interface ImportPreview {
  count: number | null;
  name_collisions: number | null;
  expires_in: number | null;
  items: { name: string | null; weekly_periods: number | null; holidays: number | null }[];
}
export type Plan = SchedulePlan & { bindings?: Bindings | null; candidates?: { key: string | null; kind: string | null; id: number | null }[] };
export type Job = ScheduleJob & { plan_revision?: number | null; resource_keys?: (string | null)[] };
export interface Claim {
  id: string;
  revision: number | null;
  plan_id: string | null;
  station_id: string | null;
  created_at: string | null;
  resource_keys: (string | null)[];
}

export interface ReadReply<T> {
  action: string;
  at: string | null;
  data: T;
  check_id?: string;
  preview_id?: string;
  baseline_preview_id?: string | null;
  impact?: Impact;
}
export interface WriteReply<T> {
  action: string;
  status: 'done';
  command_id: string;
  at: string | null;
  data: T;
  impact?: Impact;
}
export interface DeployResult {
  plan_id: string;
  station: StationImpact | null;
  people: PeopleCounts | null;
  status: 'queued' | 'refused' | 'unknown' | 'not_sent';
  code: string | null;
  reason: string | null;
  job?: Job;
}
export interface DeployReply {
  action: 'deploy';
  results: DeployResult[];
  summary: Record<'queued' | 'refused' | 'unknown' | 'not_sent', number>;
}
export interface JobsReply {
  state: string;
  last_error: string | null;
  jobs: Job[] | null;
  missing?: string[];
  writes_enabled: boolean | null;
  done: boolean;
}

const BASE = 'access-control/schedules';
const TTL_MS = 15_000;

function envelope(): { confirmed: true; client_request_id: string; expires_at: string } {
  return { confirmed: true, client_request_id: commandId(), expires_at: new Date(serverNow() + TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

export const readAction = <T>(action: string, body: Record<string, unknown>) => post<ReadReply<T>>(`${BASE}/actions/${action}`, body);
export const writeAction = <T>(action: string, body: Record<string, unknown>) => post<WriteReply<T>>(`${BASE}/actions/${action}`, { ...body, ...envelope() });

export const checkDraft = (data: Draft, date: string, time: string) => readAction<CheckResult>('check', { data, date, time });
export const createSchedule = (data: Draft, checkId: string) => writeAction<LibrarySchedule>('create', { data, check_id: checkId });
export const updateSchedule = (id: string, revision: number, data: Draft, checkId: string) =>
  writeAction<LibrarySchedule>('update', { schedule_id: id, revision, data, check_id: checkId });
export const deleteSchedule = (id: string, revision: number) => writeAction<{ deleted: true }>('delete', { schedule_id: id, revision });
export const previewImport = (document: string) => readAction<ImportPreview>('import_preview', { document });
export const applyImport = (previewId: string) => writeAction<LibrarySchedule[]>('import_apply', { preview_id: previewId });
export const exportLibrary = () => get<{ format: string; version: number; schedules: unknown[] }>(`${BASE}/export`);
export const readReadiness = (stationId: string) => readAction<Readiness>('readiness', { station_id: stationId });
export const readDependencies = (stationId: string) => readAction<{ users: PeopleCounts | null }>('dependencies', { station_id: stationId });
export const assessDraft = (stationId: string, data: Draft) => readAction<Assessment>('assess', { station_id: stationId, data });
export const saveBaseline = (stationId: string, previewId: string) => writeAction<{ revision: number | null }>('baseline_save', { station_id: stationId, preview_id: previewId });
export const clearBaseline = (stationId: string, revision: number) => writeAction<{ revision: number | null }>('baseline_clear', { station_id: stationId, revision });
export const previewPlan = (stationId: string, scheduleId: string, revision: number, bindings: Bindings) =>
  readAction<Plan>('plan_preview', { station_id: stationId, schedule_id: scheduleId, revision, bindings });
export const savePlan = (previewId: string) => writeAction<Plan>('plan_save', { preview_id: previewId });
export const recheckPlan = (planId: string, revision: number) => writeAction<Plan>('plan_recheck', { plan_id: planId, revision });
export const deletePlan = (planId: string, revision: number) => writeAction<{ deleted: true }>('plan_delete', { plan_id: planId, revision });
export const previewClaim = (planId: string, revision: number) => readAction<{ resource_keys: string[] }>('claim_preview', { plan_id: planId, revision });
export const confirmClaim = (previewId: string) => writeAction<Claim>('claim_confirm', { preview_id: previewId });
export const releaseClaim = (claimId: string, revision: number) => writeAction<{ released: true }>('claim_release', { claim_id: claimId, revision });
export const deployPlans = (plans: { plan_id: string; revision: number }[]) =>
  post<DeployReply>(`${BASE}/actions/deploy`, { plans, ...envelope() });
export const jobAction = (action: 'job_check' | 'job_cancel' | 'job_archive', jobId: string, revision: number) =>
  writeAction<Job | { archived: true }>(action, { job_id: jobId, revision });
export const getJobs = (ids: string[]) => get<JobsReply>(`${BASE}/jobs${ids.length ? '?' + ids.map((i) => `ids=${encodeURIComponent(i)}`).join('&') : ''}`);
export const getClaims = () => get<{ state: string; claims: Claim[] | null }>(`${BASE}/claims`);

/** What a failed call says. `refused`: the integration answered a refusal (`code` its reason); `not_sent`: nothing reached it (Arx
 * refused first: permission, confirmation, a missing preview, a draft fault, a limit); `unknown`: sent, no clear answer. */
export interface Outcome {
  status: 'refused' | 'not_sent' | 'unknown';
  code: string | null;
  message: string;
  field: string | null;
  retryAfter: number | null;
}

export function outcomeOf(err: unknown): Outcome {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    const status: Outcome['status'] = raw === 'refused' ? 'refused' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : [400, 403, 404, 409, 415, 422, 429].includes(err.status) ? 'not_sent' : 'unknown';
    const retry = Number(d.retry_after_s);
    return {
      status,
      code: String(d.wiskey_code ?? err.body?.code ?? '') || null,
      message: err.body?.user_message || err.message,
      field: typeof d.field === 'string' ? d.field : null,
      retryAfter: Number.isFinite(retry) && retry >= 0 ? retry : null,
    };
  }
  return { status: 'unknown', code: 'network', message: '', field: null, retryAfter: null };
}

export const JOB_ACTIVE: readonly string[] = ['pending', 'queued', 'checking'];
