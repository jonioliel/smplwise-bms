import type { Page, Route } from '@playwright/test';
import { err, install as installWrite, stream, type Mock, type Stream } from './nvr-cameras-write-mock';

// CR-020 S2 phase C: a STATEFUL mocked backend of the multi-camera change (POST /nvr/stream-batches, GET status, POST stop, POST rollback),
// layered on the phase-B mock. It follows the contract of the backend on branch pilot/CR020-s2c (7068b093, docs/architecture/NVR_SETTINGS_API.md
// 3.7): item status `running` (not `pending`), batch states running | completed | stopped | failed | interrupted, `stopped_reason`, paged GET
// (`offset`, `limit`, `next_offset`, `total`, `hidden`), `source_batch_id`, `can_rollback`, and the unknown-outcome policy (the batch waits, one
// read-only check, continues only when the reading PROVES the change; else `interrupted` with `unknown_not_applied` / `unknown_unverified`). The batch moves ONLY when a test calls `step()` / `finish()` etc., so every state of the screen
// (running, stopped by the user, stopped on a failure, unknown outcome, interrupted, partial rollback) is reached deterministically.
// Lab-shaped values only: no address, serial or MAC anywhere.

export type Outcome = 'applied' | 'unchanged' | 'failed' | 'unknown';

export interface MItem {
  index: number;
  camera_id: string;
  stream_ref: string;
  status: string;
  change_id: string | null;
  error_code: string | null;
  user_message: string | null;
}

export interface MBatch {
  batch_id: string;
  kind: 'write' | 'rollback';
  state: string;
  items: MItem[];
  /** rollback batches: the batch they undo (the server's `source_batch_id`) */
  source_batch_id: string | null;
  stopped_reason: string | null;
}

export interface BatchMock {
  batches: MBatch[];
  seq: number;
  /** gate answer of POST: off = 409 batch_not_enabled */
  gate: boolean;
  /** the answer shape of GET ?active=1 */
  activeShape: 'batches' | 'batch' | 'bare';
  /** one-shot: the next POST answers this instead of starting (defaults to a real start) */
  startFault: null | 'in_progress' | 'stale' | 'forbidden' | 'abort' | 'unprocessable';
  /** one-shot: the next stop / rollback fails with this */
  undoFault: null | 'in_progress' | 'abort';
  /** requests of the batch routes: "METHOD path" and body */
  calls: { method: string; path: string; body: any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** a single PUT / rollback that arrived while a batch ran (answered 409 batch_in_progress) */
  refusedSingles: string[];
  /** every poll answers this status (the screen must keep trying) */
  getDown: boolean;
  /** the server's page cap for GET (the real one is 500); a test lowers it to prove the screen reads every page */
  pageMax: number;
  /** GET requests of one batch: "offset,limit" */
  pages: string[];
}

export const newBatchMock = (): BatchMock => ({ batches: [], seq: 0, gate: true, activeShape: 'batches', startFault: null, undoFault: null, calls: [], refusedSingles: [], getDown: false, pageMax: 500, pages: [] });

/** `n` cameras whose main stream is H.264 with SVC on (channels 1..n); channel `h265` is H.265 and `off` has SVC already off. */
export function batchCameras(n: number, opt: { h265?: number[]; off?: number[]; offline?: number[]; names?: Record<number, string> } = {}): Record<string, any>[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let ch = 1; ch <= n; ch++) {
    const h265 = opt.h265?.includes(ch);
    const svcOff = opt.off?.includes(ch);
    out.push({
      camera_id: `cam-${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name: opt.names?.[ch] ?? `מצלמה ${ch}`, online: !opt.offline?.includes(ch), enabled_in_arx: true, error: null,
      streams: [
        stream(`${ch}01`, 'main', {
          resolution: '2560x1440', bitrate_kbps: 3072, profile: 'High',
          ...(h265 ? { codec: 'H.265', codec_raw: 'H.265', svc: false, webrtc: 'unknown', webrtc_reason: 'h265' } : { svc: !svcOff, ...(svcOff ? {} : { webrtc: 'unknown', webrtc_reason: 'svc' }) }),
        }),
        stream(`${ch}02`, 'sub', { resolution: '640x360', fps: 20, bitrate_kbps: 1024, profile: 'Baseline' }),
      ],
    });
  }
  return out;
}

export const counts = (b: MBatch): Record<string, number> => {
  const c: Record<string, number> = {};
  for (const i of b.items) c[i.status] = (c[i.status] ?? 0) + 1;
  return c;
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const canRollback = (b: MBatch) => b.kind === 'write' && b.state !== 'running' && b.items.some((i) => i.status === 'applied') && !b.items.some((i) => i.status === 'unknown' || i.status === 'running');

/** The server's status body: a page of items (by index), `total`, `next_offset`; a summary (no items) for the listing. */
const view = (b: MBatch, offset = 0, limit = 500, withItems = true) => {
  const page = withItems ? b.items.slice(offset, offset + limit) : undefined;
  const next = withItems && offset + limit < b.items.length ? offset + limit : null;
  const cur = b.items.findIndex((i) => i.status === 'running');
  return {
    batch_id: b.batch_id, kind: b.kind, state: b.state, recorder_id: 'nvr-1', total: b.items.length, done: b.items.filter((i) => ['applied', 'unchanged', 'rolled_back'].includes(i.status)).length,
    current_index: cur < 0 ? null : cur, counts: counts(b), hidden: 0, offset, limit, next_offset: next, ...(page ? { items: clone(page) } : {}),
    created_at: '2026-10-03T09:00:00Z', started_by: 'joni', stopped_at: null, stopped_reason: b.stopped_reason, source_batch_id: b.source_batch_id, can_rollback: canRollback(b),
  };
};

export class BatchDriver {
  constructor(readonly st: Mock, readonly bm: BatchMock) {}

  get running(): MBatch | null {
    return this.bm.batches.find((b) => b.state === 'running') ?? null;
  }
  get last(): MBatch {
    return this.bm.batches[this.bm.batches.length - 1];
  }

  private main(camId: string): { cam: Record<string, any>; s: Stream } | null { // eslint-disable-line @typescript-eslint/no-explicit-any
    const cam = this.st.cameras.find((c) => c.camera_id === camId);
    const s = cam?.streams.find((x: Stream) => x.role === 'main');
    return cam && s ? { cam, s } : null;
  }

  private setSvc(camId: string, on: boolean) {
    const f = this.main(camId);
    if (!f) return;
    f.s.svc = on;
    [f.s.webrtc, f.s.webrtc_reason] = on ? ['unknown', 'svc'] : ['ok', 'h264'];
    f.s.etag = `${f.s.stream_ref}e${++this.st.seq + 1}`;
  }

  /** Claims the next queued item (the runner's pending row), or ends the batch when none is left. */
  private claim(b: MBatch) {
    const next = b.items.find((i) => i.status === 'queued');
    if (next) next.status = 'running';
    else if (b.state === 'running') b.state = b.items.some((i) => i.status === 'not_attempted') ? 'stopped' : 'completed';
  }

  private endWith(b: MBatch, state: string, itemReason: string, stopReason: string | null) {
    for (const i of b.items) if (i.status === 'queued') [i.status, i.error_code, i.user_message] = ['not_attempted', itemReason, null];
    b.state = state;
    b.stopped_reason = stopReason;
  }

  start(camIds: string[], kind: 'write' | 'rollback' = 'write', source: string | null = null): MBatch {
    const items: MItem[] = camIds.map((id, index) => ({ index, camera_id: id, stream_ref: this.main(id)?.s.stream_ref ?? '', status: 'queued', change_id: null, error_code: null, user_message: null }));
    const b: MBatch = { batch_id: `batch-${++this.bm.seq}`, kind, state: 'running', items, source_batch_id: source, stopped_reason: null };
    this.bm.batches.push(b);
    this.claim(b);
    return b;
  }

  /** Finishes the item in flight with `outcome`, then (while running) claims the next one. */
  step(outcome: Outcome = 'applied', b: MBatch | null = this.running): void {
    if (!b) throw new Error('no running batch');
    const cur = b.items.find((i) => i.status === 'running');
    if (!cur) {
      this.claim(b);
      return;
    }
    const stopped = b.items.some((i) => i.status === 'not_attempted'); // the user's stop already parked the rest
    if (outcome === 'failed') {
      [cur.status, cur.error_code, cur.user_message] = ['refused', 'nvr_busy', 'ה־NVR עסוק.'];
      this.endWith(b, 'failed', 'earlier_failure', 'item_refused');
      return;
    }
    if (outcome === 'unknown') {
      // the PUT may have gone out: the item is `unknown`, the batch WAITS (the real runner waits 45 s, then makes one read-only check)
      [cur.status, cur.error_code] = ['unknown', 'outcome_unknown'];
      return;
    }
    if (outcome === 'unchanged') cur.status = 'unchanged';
    else if (b.kind === 'write') {
      this.setSvc(cur.camera_id, false);
      cur.status = 'applied';
      cur.change_id = `chg-${++this.bm.seq}`;
    } else {
      this.setSvc(cur.camera_id, true);
      cur.status = 'applied'; // a rollback's own change row
      const src = this.bm.batches.find((x) => x.batch_id === b.source_batch_id)?.items.find((i) => i.camera_id === cur.camera_id);
      if (src) src.status = 'rolled_back';
    }
    if (stopped) {
      b.state = 'stopped';
      b.stopped_reason = 'user_stop';
      return;
    }
    this.claim(b);
  }

  /** Steps `n` items (default: all of them) with the default outcome. */
  run(n = 999, b: MBatch | null = this.running): void {
    for (let k = 0; k < n && b && b.state === 'running'; k++) this.step('applied', b);
  }

  /** The server's ONE read-only check of the unknown item: `applied` = proven (the batch goes on), `not_applied` = the camera kept the old value (the
   * batch ends `interrupted / unknown_not_applied`), `unverified` = the camera could not be read (ends `interrupted / unknown_unverified`, the item stays `unknown`). */
  check(result: 'applied' | 'not_applied' | 'unverified', b: MBatch = this.last): void {
    const it = b.items.find((i) => i.status === 'unknown');
    if (!it) return;
    if (result === 'applied') {
      this.setSvc(it.camera_id, b.kind === 'rollback');
      it.status = 'applied';
      this.claim(b);
    } else if (result === 'not_applied') {
      [it.status, it.error_code, it.user_message] = ['no_effect', 'nvr_no_effect', 'ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.'];
      this.endWith(b, 'interrupted', 'earlier_unknown', 'unknown_not_applied');
    } else this.endWith(b, 'interrupted', 'earlier_unknown', 'unknown_unverified');
  }

  /** The janitor later settles a still-unknown item of an ended batch by a read. */
  settle(status: 'applied' | 'failed', b: MBatch = this.last): void {
    const it = b.items.find((i) => i.status === 'unknown');
    if (!it) return;
    if (status === 'applied') {
      this.setSvc(it.camera_id, b.kind === 'rollback');
      it.status = 'applied';
    } else [it.status, it.error_code, it.user_message] = ['failed', 'nvr_no_effect', 'ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.'];
  }

  /** The runner died: the item in flight was settled read-only as applied, the rest was never tried. */
  interrupt(b: MBatch | null = this.running): void {
    if (!b) return;
    const cur = b.items.find((i) => i.status === 'running');
    if (cur) {
      this.setSvc(cur.camera_id, b.kind === 'rollback');
      cur.status = 'applied';
    }
    this.endWith(b, 'interrupted', 'interrupted', 'interrupted');
  }

  /** Items in flight or queued became settled by hand (a restart test) */
  get applied(): number {
    return this.bm.batches.reduce((a, b) => a + b.items.filter((i) => i.status === 'applied' && b.kind === 'write').length, 0);
  }
}

export async function installBatch(page: Page, st: Mock, bm: BatchMock): Promise<BatchDriver> {
  await installWrite(page, st);
  const d = new BatchDriver(st, bm);
  // registered AFTER the phase-B mock, so these run first; `fallback` hands everything else to it
  await page.route('**/api/v1/nvr/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const isBatch = p.startsWith('nvr/stream-batches');
    // a single change (a PUT of one stream, the undo of one change) while a batch runs is refused by the server
    if (!isBatch && ((method === 'PUT' && /^nvr\/cameras\/[^/]+\/streams\/\d+$/.test(p)) || (method === 'POST' && /^nvr\/changes\/[^/]+\/rollback$/.test(p))) && d.running) {
      bm.refusedSingles.push(`${method} ${p}`);
      st.hits.push(`${method} ${p}${url.search}`);
      return json(err('batch_in_progress', 'מתבצע שינוי מרובה'), 409);
    }
    if (!isBatch) return route.fallback();
    st.hits.push(`${method} ${p}${url.search}`);
    const body = method === 'GET' ? null : req.postDataJSON();
    if (method !== 'GET') bm.calls.push({ method, path: p, body });
    if (!st.perms.includes('system.configure') || !st.perms.includes('nvr.configure')) return json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);

    if (p === 'nvr/stream-batches' && method === 'GET') {
      const run = d.running;
      if (url.searchParams.get('active') === '1') {
        if (bm.activeShape === 'bare') return json(run ? view(run) : null);
        if (bm.activeShape === 'batch') return json({ batch: run ? view(run) : null });
        return json({ batches: run ? [view(run, 0, 0, false)] : [] });
      }
      return json({ batches: bm.batches.slice(-20).map((b) => view(b, 0, 0, false)) });
    }
    if (p === 'nvr/stream-batches' && method === 'POST') {
      if (body?.confirm !== true) return json(err('confirm_required', 'נדרש אישור.'), 422);
      const fault = bm.startFault;
      bm.startFault = null;
      if (fault === 'abort') return route.abort('failed');
      if (fault === 'forbidden') return json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);
      if (!bm.gate) return json(err('batch_not_enabled', 'השינוי המרובה אינו זמין.'), 409);
      if (fault === 'unprocessable' || JSON.stringify(body.changes) !== '{"svc":false}' || !Array.isArray(body.targets) || body.targets.length < 2) return json(err('validation', 'הבחירה אינה תקינה.'), 422);
      if (fault === 'in_progress' || d.running) return json(err('batch_in_progress', 'מתבצע שינוי מרובה'), 409);
      const targets = body.targets as { camera_id: string; stream_ref: string; if_match: string }[];
      for (let index = 0; index < targets.length; index++) {
        const f = st.cameras.find((c) => c.camera_id === targets[index].camera_id)?.streams.find((s: Stream) => s.stream_ref === targets[index].stream_ref);
        if (!f || fault === 'stale' || f.etag !== targets[index].if_match) return json(err('stale', 'ההגדרות השתנו ב־NVR. נטען מחדש.', { index, target: index }), 409);
      }
      const b = d.start(targets.map((t) => t.camera_id));
      return json(view(b), 202);
    }
    let m = /^nvr\/stream-batches\/([^/]+)$/.exec(p);
    if (m && method === 'GET') {
      if (bm.getDown) return json(err('source_unavailable', 'השרת אינו זמין כרגע.'), 503);
      const b = bm.batches.find((x) => x.batch_id === m![1]);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? 200), bm.pageMax));
      bm.pages.push(`${offset},${limit}`);
      return b ? json(view(b, offset, limit)) : json(err('not_found', 'השינוי לא נמצא.'), 404);
    }
    m = /^nvr\/stream-batches\/([^/]+)\/stop$/.exec(p);
    if (m && method === 'POST') {
      const b = bm.batches.find((x) => x.batch_id === m![1]);
      if (!b) return json(err('not_found', 'השינוי לא נמצא.'), 404);
      if (b.state === 'running') {
        // the queued rows are parked at once; the camera in flight finishes (the next step() ends the batch)
        for (const i of b.items) if (i.status === 'queued') [i.status, i.error_code] = ['not_attempted', 'stopped'];
        if (!b.items.some((i) => i.status === 'running' || i.status === 'unknown')) [b.state, b.stopped_reason] = ['stopped', 'user_stop'];
      }
      return json(view(b));
    }
    m = /^nvr\/stream-batches\/([^/]+)\/rollback$/.exec(p);
    if (m && method === 'POST') {
      const fault = bm.undoFault;
      bm.undoFault = null;
      if (fault === 'abort') return route.abort('failed');
      if (body?.confirm !== true) return json(err('confirm_required', 'נדרש אישור.'), 422);
      const src = bm.batches.find((x) => x.batch_id === m![1]);
      if (!src) return json(err('not_found', 'השינוי לא נמצא.'), 404);
      if (fault === 'in_progress' || d.running) return json(err('batch_in_progress', 'מתבצע שינוי מרובה'), 409);
      const ids = src.items.filter((i) => i.status === 'applied').map((i) => i.camera_id).reverse();
      if (!ids.length || !canRollback(src)) return json(err('not_rollbackable', 'אי אפשר לבטל את השינוי הזה.'), 409);
      const b = d.start(ids, 'rollback', src.batch_id);
      return json(view(b), 202);
    }
    return json(err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return d;
}
