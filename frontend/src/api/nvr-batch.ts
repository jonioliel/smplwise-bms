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
  /** The older name of `running` (an item in flight). */
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
  /** A rollback batch names the batch it undoes (used by "נסה שוב"). The server calls it `source_batch_id`; `normalizeBatch` fills this one. */
  rollback_of?: string | null;
  source_batch_id?: string | null;
  /** All items of the batch (`items` may be a page or fewer when the caller's camera scope hides some). */
  total?: number;
  /** The server's own answer to "may the whole batch be undone now" (a write batch with something applied and nothing running / unknown). */
  can_rollback?: boolean;
  /** Who started it (shown nowhere: the audit has it). */
  started_by?: string | null;
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

/** The server's page size cap; the page asks for it so a few hundred cameras are one request. */
const PAGE = 500;

/** One shape for the page: the server names the undone batch `source_batch_id`, the screen reads `rollback_of`. */
export function normalizeBatch(raw: Batch): Batch {
  return { ...raw, rollback_of: raw.rollback_of ?? raw.source_batch_id ?? null };
}

/** The batch with ALL its items: the server pages the items (`next_offset`), so the pages are read one after the other (reads only). */
async function readAll(id: string): Promise<Batch> {
  let first: (Batch & { next_offset?: number | null }) | null = null;
  const items: BatchItem[] = [];
  let offset = 0;
  for (let guard = 0; guard < 400; guard++) {
    const page = await get<Batch & { next_offset?: number | null }>(`nvr/stream-batches/${enc(id)}?offset=${offset}&limit=${PAGE}`);
    first ??= page;
    items.push(...(page.items ?? []));
    if (page.next_offset === null || page.next_offset === undefined || page.next_offset <= offset) break;
    offset = page.next_offset;
  }
  return normalizeBatch({ ...(first as Batch), items });
}

const http: NvrBatchAdapter = {
  start: async (req) => normalizeBatch(await post<Batch>('nvr/stream-batches', req)),
  get: (id) => readAll(id),
  active: async () => {
    const a = normalizeActive(await get('nvr/stream-batches?active=1'));
    return a ? normalizeBatch(a) : null;
  },
  stop: async (id) => {
    const b = normalizeActive(await post(`nvr/stream-batches/${enc(id)}/stop`, {}));
    return b ? normalizeBatch(b) : null;
  },
  undo: async (id) => normalizeBatch(await post<Batch>(`nvr/stream-batches/${enc(id)}/rollback`, { confirm: true })),
};

/** The adapter in force. (The static demo has no batch: its camera list carries no `can_batch`, so no control exists to call it.) */
export const nvrBatch = (): NvrBatchAdapter => http;
