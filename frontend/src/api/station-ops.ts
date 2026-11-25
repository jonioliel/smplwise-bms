/**
 * A station's maintenance (WISKEY-STATION-OPS-2390; backend routers/access_control_station_ops.py): the read-only view and the four
 * actions - sync now, rescan, health refresh, clock check. The browser never names a WisKey command; each action is one typed POST with
 * the command envelope of the physical actions (`client_request_id`, `expires_at`) and `confirmed: true`, which only a confirmation
 * dialog sends. Nothing here retries, queues or runs by itself: one call per deliberate click, per station.
 *
 * The pure helpers below (outcome reading, wording, the list action's loop) are what the unit spec checks.
 *
 * WISKEY-R4-2520: the sync's numbered form. When the server says `sync_mode: 'request_id'`, an accepted sync carries the intercom
 * system's request id (accepted = queued, never done), and `getSyncRequest` reads where that request stands (queued / running / finished
 * with the intercom system's own result / no longer seen). A sync with no clear answer holds the station (`sync_gate`): the server sends
 * no further sync until that status read has answered - the screen offers the read, never a repeat.
 */
import { ApiError, get, post } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';
import { fill } from '../i18n/wiskey-stations';
import type { StationOpsText } from '../i18n/wiskey-station-ops';
import { isoZ } from './day-format';

export const STATION_OPS = ['sync', 'rescan', 'health_refresh', 'clock_refresh'] as const;
export type StationOp = (typeof STATION_OPS)[number];

/** `acknowledged` / `completed`: the server's success; `failed` (WisKey answered a failure), `not_sent`, `unknown` (sent, no clear
 * answer); `sending` / `sent` are the screen's own while a request is out, or an attempt row with no outcome yet. */
type OpStatus = 'sending' | 'sent' | 'acknowledged' | 'completed' | 'failed' | 'not_sent' | 'unknown';

interface AuthFailure {
  source: 'sync' | 'event_stream' | 'event_history' | 'station_sync' | string;
  step: string | null;
  at: string | null;
  status_code: number | null;
  sub_status: string | null;
  observed?: boolean;
}

interface AuthSummary {
  last_failure: AuthFailure | null;
  retained: number;
  steps: Record<string, number>;
  sync_now: boolean;
  event_stream_now: boolean;
  event_history_now: boolean;
  last_sync_ok_at: string | null;
  retention: string | null;
}

interface HealthCard {
  loaded: boolean | null;
  online: boolean | null;
  consecutive_poll_failures: number | null;
  access: { sync_state: string | null; last_error: string | null; pending_request: boolean | null; worker_active: boolean | null; queue_depth: number | null };
  events: { stream: string | null; history: string | null; reconnects: number | null; last_frame_at: string | null; storage_failed: boolean | null } | null;
  clock: { status: string | null; skew_seconds: number | null; drift_state: string | null; time_mode: string | null; checked_at: string | null; error: string | null } | null;
}

export interface MaintenanceView {
  station_id: string;
  online: boolean | null;
  feed: string;
  health_hidden: boolean;
  technical: {
    reconciled_at: string | null;
    scanned_at: string | null;
    scanning: boolean | null;
    last_error: string | null;
    scan_error: string | null;
    event_status: { stream: string | null; history: string | null; last_frame_at: string | null } | null;
    clock: { status: string | null; skew_seconds: number | null; checked_at: string | null; error: string | null } | null;
    last_poll_ms: number | null;
  } | null;
  report: { state: string; fresh: boolean; fetched_at: string | null; last_error: string | null; health: HealthCard | null; auth: AuthSummary | null } | null;
  auth_seen: AuthFailure | null;
  actions: Record<StationOp, { allowed: boolean; needs_online: boolean; cooldown_s: number | null; result: 'acknowledged' | 'completed' }>;
  last_runs: Record<StationOp, { status: OpStatus; at: string; code: string | null; request_id?: string | null; mode?: SyncMode | null } | null> | null;
  /** WISKEY-R4-2520: the form the next sync uses, and whether an earlier sync with no clear answer holds it. */
  sync_mode?: SyncMode;
  sync_gate?: SyncGate;
}

export type SyncMode = 'request_id' | 'classic';
/** null: a sync may be sent; `outcome_pending`: the earlier one is still out; `readback_required`: a status read must answer first. */
export type SyncGate = 'outcome_pending' | 'readback_required' | null;
/** Where Arx's request stands in the intercom system's observation (null without a known request id or observation). */
export type SyncMatch = 'running' | 'queued' | 'finished' | 'not_observed' | null;

export interface SyncRequestView {
  station_id: string;
  state: 'ready' | 'unsupported' | 'forbidden' | 'unavailable' | 'busy' | 'error' | string;
  reason: string | null;
  wiskey_code: string | null;
  fetched_at: string | null;
  gate_before: SyncGate;
  gate: SyncGate;
  last_request: { status: OpStatus; request_id: string | null; at: string; code: string | null } | null;
  match: SyncMatch;
  observation: {
    connection: string;
    loaded: boolean | null;
    sync_state: string;
    last_reconciled_at: string | null;
    request: {
      scope: string;
      pending_request_id: string | null;
      active_request_id: string | null;
      last_result: { request_id: string | null; state: string; observed_at: string | null; code: string | null; effect_proven: false } | null;
    } | null;
  } | null;
}

export interface OpReply {
  station_id: string;
  action: StationOp;
  status: 'acknowledged' | 'completed';
  command_id: string;
  at: string | null;
  data: Record<string, unknown>;
}

export interface OpOutcome {
  station_id: string;
  action: StationOp;
  status: OpStatus;
  /** WisKey's code (`details.wiskey_code`) or the server's code; null for a success. */
  code: string | null;
  retry_after_s: number | null;
  data: Record<string, unknown> | null;
}

const one = (id: string) => `access-control/stations/${encodeURIComponent(id)}/maintenance`;
const TTL_MS = 15_000;

export const getMaintenance = (stationId: string) => get<MaintenanceView>(one(stationId));

/** WISKEY-R4-2520: one status read of the station's sync (no command; it also settles a held sync once it has answered). */
export const getSyncRequest = (stationId: string) => get<SyncRequestView>(`${one(stationId)}/sync-request`);

const postMaintenance = (stationId: string, action: StationOp) =>
  post<OpReply>(`${one(stationId)}/${action}`, {
    confirmed: true,
    client_request_id: commandId(),
    expires_at: isoZ(serverNow() + TTL_MS),
  });

/** What a failed POST says: the server's `details.outcome` (`not_sent` / `refused` / `unknown`); a 403 / 404 / 409 / 422 / 429 refusal
 * before sending is `not_sent`; a network failure is `unknown` (the request may have reached the server). */
export function outcomeOf(err: unknown, stationId: string, action: StationOp): OpOutcome {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    const status: OpStatus = raw === 'refused' ? 'failed' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : [403, 404, 409, 415, 422, 429].includes(err.status) ? 'not_sent' : 'unknown';
    const retry = Number(d.retry_after_s);
    return { station_id: stationId, action, status, code: String(d.wiskey_code ?? err.code ?? '') || null, retry_after_s: Number.isFinite(retry) && retry >= 0 ? retry : null, data: null };
  }
  return { station_id: stationId, action, status: 'unknown', code: 'network', retry_after_s: null, data: null };
}

/** One action at one station, once. */
export async function runOp(stationId: string, action: StationOp, send: typeof postMaintenance = postMaintenance): Promise<OpOutcome> {
  try {
    const r = await send(stationId, action);
    return { station_id: stationId, action, status: r.status, code: null, retry_after_s: null, data: r.data ?? null };
  } catch (err) {
    return outcomeOf(err, stationId, action);
  }
}

/** The list action: `action` at each station, one after the other, ONCE each - a failure never stops the rest and is never repeated.
 * `onEach` reports progress; `pauseMs` spaces the requests a little (the server's own limits stay the judge). */
export async function runOnStations(
  stationIds: readonly string[],
  action: StationOp,
  onEach: (o: OpOutcome, index: number) => void = () => undefined,
  send: typeof postMaintenance = postMaintenance,
  pauseMs = 250,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<OpOutcome[]> {
  const out: OpOutcome[] = [];
  for (let i = 0; i < stationIds.length; i++) {
    if (i > 0 && pauseMs > 0) await wait(pauseMs);
    const o = await runOp(stationIds[i], action, send);
    out.push(o);
    onEach(o, i);
  }
  return out;
}

/** The stations a list action goes to: the chosen ones the caller sees, without offline ones for the three device reads. */
export function bulkTargets(stations: readonly { id: string; online: boolean }[], chosen: ReadonlySet<string>, action: StationOp): string[] {
  return stations.filter((s) => chosen.has(s.id) && (action === 'sync' || s.online)).map((s) => s.id);
}

export function reasonText(code: string | null | undefined, t: StationOpsText): string {
  if (!code) return '';
  return t.reasons[code] ?? code;
}

/** The one-line result: "הושלם", "נכשל: <reason>", "לא נשלח: <reason>" ... */
export function statusText(status: OpStatus, code: string | null | undefined, t: StationOpsText): string {
  const reason = reasonText(code, t) || t.none;
  if (status === 'failed') return fill(t.status.failed, { reason });
  if (status === 'not_sent') return fill(t.status.not_sent, { reason });
  return t.status[status];
}

export function statusTone(status: OpStatus): 'ok' | 'warn' | 'err' | 'busy' {
  if (status === 'acknowledged' || status === 'completed') return 'ok';
  if (status === 'failed') return 'err';
  if (status === 'sending' || status === 'sent') return 'busy';
  return 'warn';
}

export interface Tally {
  ok: number;
  failed: number;
  not_sent: number;
  unknown: number;
}

export function tally(outcomes: readonly OpOutcome[]): Tally {
  const t: Tally = { ok: 0, failed: 0, not_sent: 0, unknown: 0 };
  for (const o of outcomes) {
    if (o.status === 'acknowledged' || o.status === 'completed') t.ok++;
    else if (o.status === 'failed') t.failed++;
    else if (o.status === 'not_sent') t.not_sent++;
    else t.unknown++;
  }
  return t;
}

/** The newest authentication failure to show: Arx's memo (it outlives WisKey's ring of records) or the report's, whichever is newer. */
export function authToShow(view: MaintenanceView | null): AuthFailure | null {
  const a = view?.auth_seen ?? null;
  const b = view?.report?.auth?.last_failure ?? null;
  if (!a) return b;
  if (!b) return a;
  return String(b.at ?? '') >= String(a.at ?? '') ? b : a;
}

/** What is failing sign-in right now (sync / event stream / event history), for the "כרגע" line. */
export function authNow(view: MaintenanceView | null, t: StationOpsText): string[] {
  const out: string[] = [];
  const a = view?.report?.auth;
  const stream = view?.technical?.event_status?.stream;
  if (a?.sync_now || view?.technical?.last_error === 'authentication_failed') out.push(t.authSources.sync);
  if (a?.event_stream_now || stream === 'authentication_failed') out.push(t.authSources.event_stream);
  if (a?.event_history_now) out.push(t.authSources.event_history);
  return out;
}

export function stepText(step: string | null | undefined, t: StationOpsText): string {
  return step ? t.steps[step] ?? t.steps.other : '';
}

/** WISKEY-R4-2520: the short form of a request id shown on screen (its first block; the full id is in the element's title). */
export function shortId(id: string | null | undefined): string {
  return id ? id.split('-')[0] : '';
}

/** WISKEY-R4-2520: the request id of the newest accepted numbered sync - this screen's answer, else the server's last run. */
export function syncRequestId(result: OpOutcome | undefined, view: MaintenanceView | null): string | null {
  const fromResult = result?.data?.request_id;
  if (typeof fromResult === 'string') return fromResult;
  const last = view?.last_runs?.sync;
  return last && last.status === 'acknowledged' && typeof last.request_id === 'string' ? last.request_id : null;
}

/** WISKEY-R4-2520: the one-line answer of the status read - where the request stands, never "done" on the request alone. */
export function syncRequestText(v: SyncRequestView, t: StationOpsText): string {
  const r = t.syncRequest;
  if (v.state !== 'ready') return fill(r.unread, { reason: reasonText(v.reason ?? v.wiskey_code ?? v.state, t) || t.none });
  if (!v.observation) return r.stationUnknown;
  const result = v.observation.request?.last_result;
  if (v.match === 'running') return r.running;
  if (v.match === 'queued') return r.queued;
  if (v.match === 'finished') return fill(r.finished, { state: (r.states as Record<string, string>)[result?.state ?? ''] ?? r.states.unknown });
  if (v.match === 'not_observed') return r.notObserved;
  // no request id of Arx's own (the last one had no clear answer): what the station shows now
  const req = v.observation.request;
  if (req?.active_request_id) return r.someRunning;
  if (req?.pending_request_id) return r.someQueued;
  return r.noneQueued;
}

/** WISKEY-R4-2520: the hold line shown while a sync with no clear answer blocks the next one. */
export function syncGateText(gate: SyncGate | undefined, t: StationOpsText): string {
  if (gate === 'outcome_pending') return t.syncRequest.gatePending;
  if (gate === 'readback_required') return t.syncRequest.gateReadback;
  return '';
}
