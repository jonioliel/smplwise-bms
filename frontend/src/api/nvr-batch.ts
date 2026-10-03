/**
 * CR-020 S2 phase C: apply one stream change (SVC off) to many cameras in one background run on the server
 * (private/cr020-s2/PLAN_C.md section 2). THE ONLY MODULE that knows the batch routes: the screen talks to `nvrBatch()` and nothing else,
 * so wiring or re-shaping the real backend (branch pilot/CR020-s2c) means editing this file only.
 *
 * The server runs the batch (one camera at a time, stop at the first failure); the page starts it, polls it, may ask it to stop and may ask
 * for the whole undo. Nothing here retries: a request whose answer was lost is never repeated (the caller reads the active batch instead).
 * Owner decisions 2026-10-03: no cap on the number of cameras, always on, one confirmation, the press on the toast's "בטל" is the undo's confirmation.
 * No address, user name, password, serial or MAC ever appears in these types.
 */
import { get, post } from './client';

export type BatchKind = 'write' | 'rollback';
/** running; completed (all applied / unchanged); stopped (the user's stop); failed (an item failed); stopped_unknown (an item's outcome is unknown); interrupted (the runner died). */
export type BatchState = 'running' | 'completed' | 'stopped' | 'failed' | 'stopped_unknown' | 'interrupted';
export type BatchItemStatus =
  | 'queued'
  | 'running'
  | 'pending'
  | 'applied'
  | 'unchanged'
  | 'failed'
  | 'refused'
  | 'no_effect'
  | 'diverged'
  | 'unknown'
  | 'not_attempted'
  | 'rolled_back';

export interface BatchItem {
  index: number;
  camera_id: string | null;
  stream_ref: string;
  status: BatchItemStatus;
  change_id?: string | null;
  error_code?: string | null;
  /** The server's one line; shown as text only. */
  user_message?: string | null;
}

export interface Batch {
  batch_id: string;
  kind: BatchKind;
  state: BatchState;
  /** By item status; the items are the source of truth when present. */
  counts?: Partial<Record<BatchItemStatus, number>>;
  /** Every item, in index order. Absent in a listing (the page then reads the batch by id). */
  items?: BatchItem[];
  stopped_at?: string | null;
  stopped_reason?: string | null;
  /** A rollback batch names the batch it undoes (used by "נסה שוב"). */
  rollback_of?: string | null;
}

export interface BatchTarget {
  camera_id: string;
  stream_ref: string;
  if_match: string;
}

export interface BatchStartRequest {
  confirm: true;
  changes: { svc: false };
  targets: BatchTarget[];
  recorder_id?: string;
}

export interface NvrBatchAdapter {
  /** Starts the run (202). Sent ONCE. */
  start(req: BatchStartRequest): Promise<Batch>;
  get(batchId: string): Promise<Batch>;
  /** The batch that is running now, or null (the page resumes after a reload). */
  active(): Promise<Batch | null>;
  /** Stopping is the safe direction: no confirmation. The camera in flight finishes. Idempotent. */
  stop(batchId: string): Promise<Batch | null>;
  /** The whole undo (202, a new batch of kind `rollback`). The press on the toast / the result's confirmation IS the confirm: `confirm: true` goes with it. */
  undo(batchId: string): Promise<Batch>;
}

const enc = encodeURIComponent;

/** `?active=1` is answered as `{batch}`, `{batches: []}`, the batch itself or null depending on the build: all four read the same. */
export function normalizeActive(raw: unknown): Batch | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.batch_id === 'string') return o as unknown as Batch;
  if (o.batch && typeof o.batch === 'object') return normalizeActive(o.batch);
  if (Array.isArray(o.batches)) {
    const list = o.batches.filter((b): b is Batch => !!b && typeof b === 'object' && typeof (b as Batch).batch_id === 'string');
    return list.find((b) => b.state === 'running') ?? list[0] ?? null;
  }
  return null;
}

const http: NvrBatchAdapter = {
  start: (req) => post('nvr/stream-batches', req),
  get: (id) => get(`nvr/stream-batches/${enc(id)}`),
  active: async () => normalizeActive(await get('nvr/stream-batches?active=1')),
  stop: async (id) => normalizeActive(await post(`nvr/stream-batches/${enc(id)}/stop`, {})),
  undo: (id) => post(`nvr/stream-batches/${enc(id)}/rollback`, { confirm: true }),
};

/** The adapter in force. (The static demo has no batch: its camera list carries no `can_batch`, so no control exists to call it.) */
export const nvrBatch = (): NvrBatchAdapter => http;
