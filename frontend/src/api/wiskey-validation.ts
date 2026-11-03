// WISKEY-LIVE-VALIDATION-2390 (WisKey plan T16): the station acceptance tool's API (routers/wiskey_validation.py). Typed calls only;
// the Hebrew reason lines come from the server (one source for the screen and the CSV export).
import { ApiError, apiUrl, get, post } from './client';

export type CheckStatus = 'pending' | 'running' | 'pass' | 'fail' | 'unsupported' | 'not_run';
export type RunState = 'running' | 'done' | 'cancelled' | 'interrupted';
export type WitnessVerdict = 'opened' | 'not_opened' | 'unsure';

export interface ValidationDoor {
  door: number;
  name: string | null;
}

export interface ValidationStation {
  id: string;
  name: string;
  online: boolean;
  doors: ValidationDoor[];
  can_pulse: boolean;
}

export interface ValidationCheckDef {
  key: string;
  label: string;
}

export interface RunSummary {
  id: string;
  scope: 'one' | 'all';
  state: RunState;
  created_by_name: string | null;
  created_at: string;
  finished_at: string | null;
  station_count: number;
  counts: Record<CheckStatus, number>;
}

export interface ValidationOverview {
  feed_state: string;
  stations: ValidationStation[];
  checks: ValidationCheckDef[];
  runs: RunSummary[];
  active_run_id: string | null;
  rights: { run: boolean; pulse: boolean; pulse_local: boolean };
}

export interface CheckResult {
  check: string;
  label: string;
  status: CheckStatus;
  status_text: string;
  reason: string | null;
  reason_text: string | null;
  detail: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
}

export interface StationResult {
  station_id: string;
  name: string | null;
  checks: CheckResult[];
  counts: Record<CheckStatus, number>;
  progress: { done: number; total: number };
}

export interface ValidationRun {
  id: string;
  kind: 'checks' | 'pulse';
  scope: 'one' | 'all';
  parent_run_id: string | null;
  state: RunState;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  finished_at: string | null;
  cancel_requested: boolean;
  station_count: number;
  stations: StationResult[];
  counts: Record<CheckStatus, number>;
  progress: { done: number; total: number };
  pulses: ValidationRun[];
}

export interface PulseRequest {
  station_id: string;
  door: number;
  confirm_text: string;
  witness_name: string;
  parent_run_id: string | null;
}

export const getValidation = () => get<ValidationOverview>('wiskey-validation');
export const getRun = (id: string) => get<ValidationRun>(`wiskey-validation/runs/${encodeURIComponent(id)}`);
export const startRun = (body: { station_id: string } | { all: true }) => post<{ run_id: string }>('wiskey-validation/runs', body);
export const cancelRun = (id: string) => post<{ run_id: string; cancel_requested: boolean }>(`wiskey-validation/runs/${encodeURIComponent(id)}/cancel`);
export const sendPulse = (body: PulseRequest) => post<{ run_id: string; result: CheckResult }>('wiskey-validation/pulse', body);
export const sendWitness = (runId: string, verdict: WitnessVerdict) =>
  post<{ run_id: string; status: CheckStatus; reason: string | null }>(`wiskey-validation/pulse/${encodeURIComponent(runId)}/witness`, { verdict });
/** The run's acceptance record as a CSV file (audited server-side). */
export async function fetchCsv(id: string): Promise<Blob> {
  const res = await fetch(apiUrl(`wiskey-validation/runs/${encodeURIComponent(id)}/export.csv`), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: Partial<ApiError['body']> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }
    throw new ApiError(res.status, { code: body.code ?? `http_${res.status}`, user_message: body.user_message ?? '', retryable: body.retryable ?? false,
      correlation_id: body.correlation_id ?? '', details: body.details ?? {} });
  }
  return res.blob();
}

/** The settings route of the tool, optionally pre-selecting one station (the station drawer's link). */
export const VALIDATION_HREF = '#/system/wiskey-validation';
export const validationHref = (stationId?: string) => (stationId ? `${VALIDATION_HREF}?station=${encodeURIComponent(stationId)}` : VALIDATION_HREF);

/** The badge kind of a check status (sw-badge StateKind). */
export function statusKind(s: CheckStatus): 'live' | 'error' | 'neutral' | 'offline' | 'unknown' | 'stale' {
  return s === 'pass' ? 'live' : s === 'fail' ? 'error' : s === 'unsupported' ? 'neutral' : s === 'not_run' ? 'offline' : s === 'running' ? 'stale' : 'unknown';
}

/** A run is finished when it is no longer `running` (the screen stops polling). */
export const runFinished = (r: Pick<ValidationRun, 'state'>) => r.state !== 'running';

/** The typed confirmation a pulse needs: exactly the station's name (or its id when it has no name), outer spaces ignored. */
export function confirmMatches(station: Pick<ValidationStation, 'id' | 'name'>, typed: string): boolean {
  const expected = (station.name || station.id).trim();
  return typed.trim() === expected && expected.length > 0;
}

/** A short, plain line for a check's detail (numbers and codes the server kept), for the screen and the printed record. */
export function detailLine(c: Pick<CheckResult, 'check' | 'detail'>): string {
  const d = c.detail || {};
  const parts: string[] = [];
  if (c.check === 'clock' && typeof d.skew_seconds === 'number') parts.push(`סטייה ${(d.skew_seconds as number).toFixed(1)} שנ׳`);
  if (c.check === 'events' && typeof d.stream === 'string') parts.push(`זרם: ${d.stream}`);
  if ((c.check === 'media_arx' || c.check === 'media_wiskey') && typeof d.bytes === 'number') parts.push(`תמונה ${Math.round((d.bytes as number) / 1024)} KB`);
  if (c.check === 'talk' && typeof d.transport === 'string') parts.push(`${d.transport}${d.busy ? ' · תפוס כרגע' : ''}`);
  if (Array.isArray(d.doors)) parts.push((d.doors as Array<{ door: number; result: string }>).map((x) => `דלת ${x.door}: ${x.result}`).join(', '));
  if (c.check === 'pulse') {
    if (typeof d.door === 'number') parts.push(`דלת ${d.door}`);
    if (typeof d.witness_name === 'string') parts.push(`עד: ${d.witness_name}`);
  }
  if (typeof d.source === 'string' && (c.check === 'events' || c.check === 'clock')) parts.push(d.source === 'feed' ? 'מהעותק השמור' : 'קריאה עדכנית');
  return parts.join(' · ');
}
