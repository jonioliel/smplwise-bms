/**
 * WISKEY-MANAGED-INSTALL-2382: the typed calls and the pure rules of "WisKey installs and upgrades through Arx"
 * (routers/wiskey_managed.py). The server decides everything (system administrator + system.configure, the typed phrases, the plan,
 * the Core gate, the backup check); nothing here grants anything. The screen only words what the server says.
 */
import { ApiError, get, post, put } from './client';

export type OnOff = 'off' | 'on';
/** `startup`: owner decision 04.11 (round 18 Q3 = B) - a run may also start when the add-on starts (default off, same phrase as `enabled`). */
export type SwitchName = 'enabled' | 'core_risk' | 'startup';
export type StepState = 'running' | 'done' | 'failed' | 'skipped';
export type JobState = 'running' | 'succeeded' | 'aborted' | 'rolled_back' | 'rollback_failed' | 'interrupted' | 'failed';

export interface ManagedStep {
  name: string;
  state: StepState;
  code: string | null;
  at?: string;
}

export interface ManagedJob {
  id: string;
  kind: 'install' | 'upgrade' | 'convert' | 'rollback';
  state: JobState;
  code: string | null;
  plan?: string;
  from_version: string | null;
  to_version: string | null;
  steps: ManagedStep[];
  started_at?: string;
  finished_at?: string | null;
  core_gate?: string | null;
  risk_accepted?: boolean;
  storage_restored?: boolean;
  rollback_of?: string | null;
  /** `startup` when the add-on start-up started it (owner decision 04.11 Q3 = B); `owner` (or absent) for a request. */
  origin?: 'owner' | 'startup';
}

export interface ManagedView {
  /** `startup` is absent on a server before 2.40.0 (read as off). */
  switches: Record<'enabled' | 'core_risk', OnOff> & { startup?: OnOff };
  phrases: { enabled: string; core_risk: string; startup?: string; adopt: string };
  /** Owner decision 04.11 Q8 = B: how many recent runs keep their previous tree and private backup (default 5, range 1-10). */
  keep_runs?: number;
  keep_runs_range?: [number, number];
  /** Owner decision 04.11 Q4 = A: the full backup may be at most this many hours old. */
  backup_max_age_h?: number;
  /** The last start-up attempt (one per shipped bundle). */
  startup_attempt?: { digest: string | null; job: string | null; at: string | null } | null;
  bundle: { state: string; code?: string | null; version: string | null; digest?: string | null; product_CODE?: string | null; files?: number | null };
  installed: {
    state: string;
    ownership: string;
    version: string | null;
    label?: string | null;
    digest?: string | null;
    profile?: string | null;
    markers: { component?: string; config?: string };
  };
  plan: string;
  runnable: boolean;
  adoptable: boolean;
  adoption: { version: string | null; label: string | null; digest: string; at: string; backup: string } | null;
  job: ManagedJob | null;
  running: boolean;
  rollback_available: boolean;
  unattended_permitted: boolean;
}

export interface CheckItem {
  name: 'preflight' | 'supervisor' | 'core_gate' | 'backup_check' | string;
  state: 'pass' | 'warn' | 'fail';
  code: string | null;
  plan?: string;
}

export interface CheckResult {
  plan: string | null;
  items: CheckItem[];
  ready: boolean;
}

const BASE = 'wiskey/managed';
export const getManaged = () => get<ManagedView>(BASE);
export const putManagedSwitch = (name: SwitchName, value: OnOff, confirm?: string) =>
  put<ManagedView>(`${BASE}/switch`, value === 'on' ? { switch: name, value, confirm: confirm ?? '' } : { switch: name, value });
export const putKeepRuns = (value: number) => put<ManagedView>(`${BASE}/keep-runs`, { value });
export const checkManaged = () => post<CheckResult>(`${BASE}/check`);
export const adoptManaged = (confirm: string) => post<ManagedView>(`${BASE}/adopt`, { confirm });
export const startUpgrade = () => post<{ job: ManagedJob }>(`${BASE}/upgrade`);
export const startRollback = () => post<{ job: ManagedJob }>(`${BASE}/rollback`);

/** The typed phrase matches the server's exactly (trimmed, NFC); the server checks again. */
export function phraseMatches(typed: string, phrase: string): boolean {
  return typed.trim().normalize('NFC') === phrase.normalize('NFC') && phrase.length > 0;
}

/** The default and the range of the kept-runs setting (owner decision 04.11 Q8 = B: the last 5). */
export const KEEP_RUNS_DEFAULT = 5;
export const KEEP_RUNS_RANGE: readonly [number, number] = [1, 10];

/** The kept-runs number the screen shows: the server's, or the default when an older server does not send it. */
export function keepRunsOf(v: ManagedView | null): number {
  const n = v?.keep_runs;
  return typeof n === 'number' && Number.isInteger(n) && n >= KEEP_RUNS_RANGE[0] && n <= KEEP_RUNS_RANGE[1] ? n : KEEP_RUNS_DEFAULT;
}

/** The state of a switch; `off` when the server does not send it. */
export function switchState(v: ManagedView | null, name: SwitchName): OnOff {
  const all = (v?.switches ?? {}) as Partial<Record<SwitchName, OnOff>>;
  return all[name] === 'on' ? 'on' : 'off';
}

/** The plans a run can carry out; the rest are closed refusals the screen words. */
export const RUNNABLE_PLANS = ['install', 'upgrade', 'convert'] as const;

/** What the screen offers, from the view alone. */
export function offers(v: ManagedView | null): { adopt: boolean; upgrade: boolean; rollback: boolean } {
  if (!v || v.switches.enabled !== 'on' || v.running) return { adopt: false, upgrade: false, rollback: false };
  return { adopt: v.adoptable, upgrade: v.runnable && (RUNNABLE_PLANS as readonly string[]).includes(v.plan), rollback: v.rollback_available };
}

/** The order the progress view lists the steps in; unknown names keep the server's order after these. */
export const STEP_ORDER = ['preflight', 'core_gate', 'backup_check', 'snapshot_before', 'stop_core', 'backup_local', 'swap', 'start_core', 'verify',
  'rollback', 'start_core_after_rollback', 'verify_after_rollback'] as const;

/** A finished job is one whose state is not `running`. */
export const isFinished = (job: ManagedJob | null | undefined): boolean => !!job && job.state !== 'running';

/** The tone of a finished job's banner. */
export function jobTone(job: ManagedJob | null | undefined): 'ok' | 'warn' | 'danger' | 'info' {
  if (!job || job.state === 'running') return 'info';
  if (job.state === 'succeeded') return 'ok';
  if (job.state === 'rolled_back' || job.state === 'aborted' || job.state === 'interrupted') return 'warn';
  return 'danger';
}

export type ManagedRefusal = 'forbidden' | 'confirm' | 'conflict' | 'invalid' | 'other';

/** The closed refusals of the routes (never the server's text). */
export function managedRefusal(err: unknown): ManagedRefusal {
  if (!(err instanceof ApiError)) return 'other';
  if (err.status === 403) return 'forbidden';
  if (err.code === 'confirmation_required') return 'confirm';
  if (err.status === 409) return 'conflict';
  if (err.status === 422) return 'invalid';
  return 'other';
}

/** The closed code of a refusal (to word it), or null. */
export const refusalCode = (err: unknown): string | null => (err instanceof ApiError ? err.code : null);
