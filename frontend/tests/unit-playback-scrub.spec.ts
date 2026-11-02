import { test, expect } from '@playwright/test';
import { SeekCoalescer, SEEK_DEBOUNCE_MS, type SeekOutcome, type SeekTimers } from '../src/api/seek-coalescer';
import { FramePreviewLoader, frameBucket, type FrameAnswer, type PreviewState } from '../src/api/frame-preview';

// PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): fast scrubbing in recorded playback, Node only.
// The seek coalescer (only the last seek within 250 ms is sent; one in flight, at most one pending) with a fake clock, and the hover
// picture loader (de-duplication per 10-second bucket, stale-request cancellation, the last good picture kept) with a fake fetch.

/** A fake clock for the coalescer's timers. */
function clock() {
  let now = 0;
  let id = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: SeekTimers = {
    set: (fn, ms) => {
      id += 1;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (h) => {
      pending.delete(h as number);
    },
  };
  async function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const next = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      pending.delete(next[0]);
      next[1].fn();
      await Promise.resolve();
      await Promise.resolve();
    }
    now = end;
    await flushMicrotasks();
  }
  return { timers, advance, get now() { return now; } };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

/** A server stand-in: every seek resolves when the test says so. */
function server() {
  const calls: number[] = [];
  const resolvers: ((o?: SeekOutcome) => void)[] = [];
  let concurrent = 0;
  let peak = 0;
  const run = (v: number) => {
    calls.push(v);
    concurrent += 1;
    peak = Math.max(peak, concurrent);
    return new Promise<SeekOutcome | void>((resolve) => {
      resolvers.push((o) => {
        concurrent -= 1;
        resolve(o);
      });
    });
  };
  return {
    run,
    calls,
    get peak() { return peak; },
    async finish(o?: SeekOutcome) {
      const r = resolvers.shift();
      if (r) r(o);
      await flushMicrotasks();
    },
  };
}

test.describe('seek coalescer', () => {
  test('a burst of seeks within 250 ms sends only the last one', async () => {
    const c = clock();
    const s = server();
    const q = new SeekCoalescer<number>(s.run, { timers: c.timers });
    for (let i = 1; i <= 10; i += 1) {
      q.request(i);
      await c.advance(30); // a drag: a seek every 30 ms
    }
    expect(s.calls).toEqual([]);
    await c.advance(SEEK_DEBOUNCE_MS);
    expect(s.calls).toEqual([10]);
    expect(q.stats).toEqual({ requested: 10, sent: 1, coalesced: 9 });
  });

  test('seeks spaced wider than the window are each sent', async () => {
    const c = clock();
    const s = server();
    const q = new SeekCoalescer<number>(s.run, { timers: c.timers });
    q.request(1);
    await c.advance(300);
    await s.finish();
    q.request(2);
    await c.advance(300);
    expect(s.calls).toEqual([1, 2]);
  });

  test('never more than one in flight and at most one pending: the newest replaces the pending one', async () => {
    const c = clock();
    const s = server();
    const q = new SeekCoalescer<number>(s.run, { timers: c.timers });
    q.request(1);
    await c.advance(300); // 1 in flight
    for (const v of [2, 3, 4]) {
      q.request(v);
      await c.advance(300); // each one's debounce ends while 1 is still in flight
    }
    expect(s.calls).toEqual([1]);
    expect(q.inFlight && q.pending).toBe(true);
    await s.finish(); // 1 answers: only the latest pending one (4) goes, 2 and 3 never do
    expect(s.calls).toEqual([1, 4]);
    await s.finish();
    expect(q.pending || q.inFlight).toBe(false);
    expect(s.peak).toBe(1);
  });

  test('a pending seek whose window is still open waits for the window after the in-flight one finishes', async () => {
    const c = clock();
    const s = server();
    const q = new SeekCoalescer<number>(s.run, { timers: c.timers });
    q.request(1);
    await c.advance(300);
    q.request(2);
    await c.advance(100);
    await s.finish(); // 1 done while 2's window runs
    expect(s.calls).toEqual([1]);
    q.request(3); // still dragging
    await c.advance(SEEK_DEBOUNCE_MS);
    expect(s.calls).toEqual([1, 3]);
  });

  test("a 'busy' answer retries the same position unless a newer seek arrived", async () => {
    const c = clock();
    const s = server();
    const q = new SeekCoalescer<number>(s.run, { timers: c.timers, busyRetryMs: 200 });
    q.request(7);
    await c.advance(300);
    await s.finish('busy');
    await c.advance(200);
    expect(s.calls).toEqual([7, 7]);
    await s.finish('busy');
    q.request(8); // the operator moved on: 7 is not retried
    await c.advance(300);
    expect(s.calls).toEqual([7, 7, 8]);
  });

  test('flush sends at once, cancel drops the pending seek, a failing run does not jam the queue', async () => {
    const c = clock();
    const calls: number[] = [];
    let fail = true;
    const q = new SeekCoalescer<number>(async (v) => {
      calls.push(v);
      if (fail) throw new Error('network');
    }, { timers: c.timers });
    q.request(1);
    q.flush();
    await flushMicrotasks();
    expect(calls).toEqual([1]);
    fail = false;
    q.request(2);
    q.cancel();
    await c.advance(1000);
    expect(calls).toEqual([1]);
    q.request(3);
    await c.advance(300);
    expect(calls).toEqual([1, 3]);
  });
});

// ------------------------------------------------------------------------------------------------------------ frame loader

/** A fake fetch: every request waits until the test answers it; aborts are recorded. */
function fakeFetch() {
  const open = new Map<string, { resolve: (a: FrameAnswer) => void; signal: AbortSignal }>();
  const asked: string[] = [];
  const aborted: string[] = [];
  const fetchFrame = (url: string, signal: AbortSignal) =>
    new Promise<FrameAnswer>((resolve, reject) => {
      asked.push(url);
      open.set(url, { resolve, signal });
      signal.addEventListener('abort', () => {
        aborted.push(url);
        open.delete(url);
        reject(new Error('aborted'));
      });
    });
  return {
    fetchFrame,
    asked,
    aborted,
    open,
    async answer(url: string, a: FrameAnswer) {
      const o = open.get(url);
      if (!o) throw new Error(`no open request for ${url}`);
      open.delete(url);
      o.resolve(a);
      await flushMicrotasks();
    },
  };
}

function rig(maxConcurrent = 2) {
  const f = fakeFetch();
  const states: PreviewState[] = [];
  let n = 0;
  const revoked: string[] = [];
  const loader = new FramePreviewLoader({
    fetchFrame: f.fetchFrame,
    onChange: (s) => states.push(s),
    maxConcurrent,
    cacheSize: 4,
    makeUrl: () => `blob:${++n}`,
    revokeUrl: (u) => revoked.push(u),
  });
  const want = (sec: number) => {
    const { key, atIso } = frameBucket('cam1', new Date(Date.UTC(2026, 10, 1, 17, 0, sec)));
    loader.want(key, `/frame?at=${atIso}`);
    return `/frame?at=${atIso}`;
  };
  return { f, states, loader, want, revoked };
}

const jpeg = (at: string | null = null): FrameAnswer => ({ ok: true, blob: new Blob([new Uint8Array([0xff, 0xd8])]), at });

test.describe('hover frame loader', () => {
  test('one request per 10-second bucket: hovering inside a bucket never asks again', async () => {
    const r = rig();
    const u = r.want(12);
    r.want(15);
    r.want(19);
    expect(r.f.asked).toEqual([u]);
    await r.f.answer(u, jpeg('2026-11-01T17:00:10Z'));
    r.want(11);
    expect(r.f.asked).toEqual([u]);
    expect(r.loader.state).toMatchObject({ url: 'blob:1', loading: false, none: false, at: '2026-11-01T17:00:10Z' });
    expect(r.loader.stats.deduped).toBeGreaterThanOrEqual(3);
    expect(frameBucket('c', new Date(Date.UTC(2026, 10, 1, 17, 0, 19, 900))).atIso).toBe('2026-11-01T17:00:10Z');
  });

  test('stale requests are cancelled when the slots are full; at most two in flight', async () => {
    const r = rig(2);
    const a = r.want(0);
    const b = r.want(10);
    expect(r.loader.inFlight).toBe(2);
    const c = r.want(20); // a and b are stale now: the oldest (a) is aborted to make room
    expect(r.f.aborted).toEqual([a]);
    expect(r.f.asked).toEqual([a, b, c]);
    const d = r.want(30);
    expect(r.f.aborted).toEqual([a, b]);
    expect(r.loader.inFlight).toBe(2);
    expect(r.f.asked).toEqual([a, b, c, d]);
    await r.f.answer(d, jpeg());
    expect(r.loader.state).toMatchObject({ url: 'blob:1', loading: false });
    expect(r.loader.stats).toMatchObject({ requests: 4, aborted: 2 });
  });

  test('the last good picture stays on show while the next one loads (no blank hole)', async () => {
    const r = rig();
    const a = r.want(0);
    await r.f.answer(a, jpeg());
    r.want(40);
    expect(r.loader.state).toMatchObject({ url: 'blob:1', loading: true, none: false });
    expect(r.states.every((s, i) => i === 0 || s.url !== null)).toBe(true);
  });

  test('a stale picture that arrives still fills the cache, and fills a hole when nothing is on show', async () => {
    const r = rig(2);
    const a = r.want(0);
    const b = r.want(10); // a is stale but still in flight (a free slot was used)
    await r.f.answer(a, jpeg());
    expect(r.loader.state).toMatchObject({ url: 'blob:1', loading: true }, );
    r.want(5); // back to a's bucket: from the cache, no request
    expect(r.f.asked).toEqual([a, b]);
    expect(r.loader.state).toMatchObject({ url: 'blob:1', loading: false });
  });

  test('404 = no recording: shown as such and never asked again; 503 keeps the picture and is asked again', async () => {
    const r = rig();
    const a = r.want(0);
    await r.f.answer(a, jpeg());
    const b = r.want(100);
    await r.f.answer(b, { ok: false, status: 404 });
    expect(r.loader.state).toMatchObject({ none: true, loading: false });
    r.want(101);
    expect(r.f.asked.filter((u) => u === b)).toHaveLength(1);
    const c = r.want(200);
    await r.f.answer(c, { ok: false, status: 503 });
    expect(r.loader.state).toMatchObject({ url: 'blob:1', none: false, loading: false });
    r.want(205);
    expect(r.f.asked.filter((u) => u === c)).toHaveLength(2);
  });

  test('leaving the timeline aborts what is in flight; dispose revokes the object URLs; the LRU is bounded', async () => {
    const r = rig(2);
    for (let i = 0; i < 6; i += 1) {
      const u = r.want(i * 10);
      await r.f.answer(u, jpeg());
    }
    expect(r.revoked).toEqual(['blob:1', 'blob:2']); // cacheSize 4
    const p = r.want(300);
    r.loader.clear();
    expect(r.f.aborted).toEqual([p]);
    expect(r.loader.state).toMatchObject({ key: null, url: null, loading: false });
    r.loader.dispose();
    expect(r.revoked).toHaveLength(6);
  });
});
