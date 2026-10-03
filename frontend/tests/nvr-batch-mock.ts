import type { Page, Route } from '@playwright/test';
import { err, install as installWrite, stream, type Mock, type Stream } from './nvr-cameras-write-mock';

// CR-020 S2 phase C: a STATEFUL mocked backend of the multi-camera change (PLAN_C section 2: POST /nvr/stream-batches, GET status,
// POST stop, POST rollback), layered on the phase-B mock. It follows the contract of private/cr020-s2/PLAN_C.md, NOT a built backend:
// the real one is on branch pilot/CR020-s2c. The batch moves ONLY when a test calls `step()` / `finish()` etc., so every state of the screen
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
  rollback_of: string | null;
}

export interface BatchMock {
  batches: MBatch[];
  seq: number;
  /** gate answer of POST: off = 409 batch_not_enabled */
  gate: boolean;
  /** the answer shape of GET ?active=1 */
  activeShape: 'batch' | 'batches' | 'bare';
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
}

export const newBatchMock = (): BatchMock => ({ batches: [], seq: 0, gate: true, activeShape: 'batch', startFault: null, undoFault: null, calls: [], refusedSingles: [], getDown: false });

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

const view = (b: MBatch) => ({ batch_id: b.batch_id, kind: b.kind, state: b.state, counts: counts(b), items: clone(b.items), stopped_at: null, stopped_reason: null, rollback_of: b.rollback_of });

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
    if (next) next.status = 'pending';
    else if (b.state === 'running') b.state = b.items.some((i) => i.status === 'not_attempted') ? 'stopped' : 'completed';
  }

  private endWith(b: MBatch, state: string, reason: string) {
    for (const i of b.items) if (i.status === 'queued') [i.status, i.error_code, i.user_message] = ['not_attempted', reason, null];
    b.state = state;
  }

  start(camIds: string[], kind: 'write' | 'rollback' = 'write', rollbackOf: string | null = null): MBatch {
    const items: MItem[] = camIds.map((id, index) => ({ index, camera_id: id, stream_ref: this.main(id)?.s.stream_ref ?? '', status: 'queued', change_id: null, error_code: null, user_message: null }));
    const b: MBatch = { batch_id: `batch-${++this.bm.seq}`, kind, state: 'running', items, rollback_of: rollbackOf };
    this.bm.batches.push(b);
    this.claim(b);
    return b;
  }

  /** Finishes the item in flight with `outcome`, then (while running) claims the next one. */
  step(outcome: Outcome = 'applied', b: MBatch | null = this.running): void {
    if (!b) throw new Error('no running batch');
    const cur = b.items.find((i) => i.status === 'pending');
    if (!cur) {
      this.claim(b);
      return;
    }
    const stopped = b.items.some((i) => i.status === 'not_attempted'); // the user's stop already parked the rest
    if (outcome === 'failed') {
      [cur.status, cur.error_code, cur.user_message] = ['refused', 'nvr_busy', 'ה־NVR עסוק.'];
      this.endWith(b, 'failed', 'earlier_failure');
      return;
    }
    if (outcome === 'unknown') {
      [cur.status, cur.error_code] = ['unknown', 'outcome_unknown'];
      this.endWith(b, 'stopped_unknown', 'earlier_unknown');
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
      const src = this.bm.batches.find((x) => x.batch_id === b.rollback_of)?.items.find((i) => i.camera_id === cur.camera_id);
      if (src) src.status = 'rolled_back';
    }
    if (stopped) {
      b.state = 'stopped';
      return;
    }
    this.claim(b);
  }

  /** Steps `n` items (default: all of them) with the default outcome. */
  run(n = 999, b: MBatch | null = this.running): void {
    for (let k = 0; k < n && b && b.state === 'running'; k++) this.step('applied', b);
  }

  /** The server settled the unknown item read-only. */
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
    const cur = b.items.find((i) => i.status === 'pending');
    if (cur) {
      this.setSvc(cur.camera_id, b.kind === 'rollback');
      cur.status = 'applied';
    }
    this.endWith(b, 'interrupted', 'interrupted');
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
        const v = run ? view(run) : null;
        if (bm.activeShape === 'bare') return json(v);
        if (bm.activeShape === 'batches') return json({ batches: v ? [{ ...v, items: undefined }] : [] });
        return json({ batch: v });
      }
      return json({ batches: bm.batches.map(view) });
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
      return json({ ...view(b), items: view(b).items }, 202);
    }
    let m = /^nvr\/stream-batches\/([^/]+)$/.exec(p);
    if (m && method === 'GET') {
      if (bm.getDown) return json(err('source_unavailable', 'השרת אינו זמין כרגע.'), 503);
      const b = bm.batches.find((x) => x.batch_id === m![1]);
      return b ? json(view(b)) : json(err('not_found', 'השינוי לא נמצא.'), 404);
    }
    m = /^nvr\/stream-batches\/([^/]+)\/stop$/.exec(p);
    if (m && method === 'POST') {
      const b = bm.batches.find((x) => x.batch_id === m![1]);
      if (!b) return json(err('not_found', 'השינוי לא נמצא.'), 404);
      if (b.state === 'running') {
        // the queued rows are parked at once; the camera in flight finishes (the next step() ends the batch)
        for (const i of b.items) if (i.status === 'queued') [i.status, i.error_code] = ['not_attempted', 'stopped'];
        if (!b.items.some((i) => i.status === 'pending')) b.state = 'stopped';
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
      if (!ids.length) return json(err('not_rollbackable', 'אי אפשר לבטל את השינוי הזה.'), 409);
      const b = d.start(ids, 'rollback', src.batch_id);
      return json(view(b), 202);
    }
    return json(err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return d;
}
