import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { Resource, type Reply } from '../src/access-control/status-feed';

// CR-036 S10: the loader behind every card of the Settings page. Node only, with a fake `fetch` the test releases by hand.
interface R extends Reply {
  value?: number[] | null;
  next?: number | null;
}
const ready = (value: number[], extra: Partial<R> = {}): R => ({ state: 'ready', last_error: null, fetched_at: '2026-09-27T10:29:40Z', fresh: true, value, next: null, ...extra });
const notReady = (state: string, last_error: string | null = null): R => ({ state, last_error, fetched_at: null, value: null });

/** A fetch whose answers the test gives one at a time. */
function gate() {
  const waiting: Array<{ resolve: (r: R) => void; reject: (e: unknown) => void; cursor: unknown }> = [];
  const fetch = (cursor: unknown) => new Promise<R>((resolve, reject) => waiting.push({ resolve, reject, cursor }));
  return { fetch, waiting, answer: (r: R, i = 0) => waiting.splice(i, 1)[0].resolve(r), fail: (e: unknown, i = 0) => waiting.splice(i, 1)[0].reject(e) };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const errorOf = (status: number, code: string, details: Record<string, unknown> = {}) => new ApiError(status, { code, user_message: 'm', retryable: false, correlation_id: 'c', details });

function make(g: ReturnType<typeof gate>, extra: Record<string, unknown> = {}) {
  const changes: number[] = [];
  const r = new Resource<number[], R>({ fetch: g.fetch, pick: (x) => x.value ?? null, onChange: () => changes.push(1), ...extra });
  return { r, changes };
}

test('a first read: busy while it is out, then the payload, its time and its freshness', async () => {
  const g = gate();
  const { r } = make(g);
  const p = r.reload();
  expect(r.snap.busy).toBe(true);
  expect(r.snap.data).toBeNull();
  g.answer(ready([1, 2]));
  await p;
  expect(r.snap).toMatchObject({ data: [1, 2], busy: false, fetchedAt: '2026-09-27T10:29:40Z', fresh: true, failure: null, everAnswered: true });
  expect(r.stale).toBe(false);
});

test('a reload asked for while one is out is queued once, and runs after it', async () => {
  const g = gate();
  const { r } = make(g);
  const first = r.reload();
  void r.reload();
  void r.reload();
  expect(g.waiting).toHaveLength(1);
  g.answer(ready([1]));
  await first;
  await tick();
  expect(g.waiting).toHaveLength(1); // exactly one more, not two
  g.answer(ready([2]));
  await tick();
  expect(r.snap.data).toEqual([2]);
  expect(g.waiting).toHaveLength(0);
});

test('a read that did not answer keeps the last good payload, marked not current; the next good one clears it', async () => {
  const g = gate();
  const { r } = make(g);
  let p = r.reload();
  g.answer(ready([1]));
  await p;
  p = r.reload();
  g.answer(notReady('ha_unavailable', 'ha_unavailable'));
  await p;
  expect(r.snap.data).toEqual([1]);
  expect(r.snap.failure).toBe('unavailable');
  expect(r.stale).toBe(true);
  p = r.reload();
  g.fail(new TypeError('failed to fetch'));
  await p;
  expect(r.snap.failure).toBe('network');
  expect(r.snap.data).toEqual([1]);
  p = r.reload();
  g.answer(ready([3]));
  await p;
  expect(r.snap).toMatchObject({ data: [3], failure: null });
  expect(r.stale).toBe(false);
});

test('a payload the server served from its cache (fresh: false) is shown, marked not current', async () => {
  const g = gate();
  const { r } = make(g);
  const p = r.reload();
  g.answer(ready([1], { fresh: false }));
  await p;
  expect(r.snap.data).toEqual([1]);
  expect(r.snap.failure).toBeNull();
  expect(r.stale).toBe(true);
});

test('each state the server names is its own failure: not connected, connecting, not installed, unsupported, rate limited', async () => {
  const cases: Array<[R, string]> = [
    [notReady('ha_not_configured', 'ha_not_configured'), 'not_configured'],
    [notReady('connecting'), 'connecting'],
    [notReady('not_installed', 'not_installed'), 'not_installed'],
    [notReady('unsupported', 'not_listed'), 'unsupported'],
    [notReady('error', 'rate_limited'), 'rate'],
    [{ state: 'ready', last_error: null, fetched_at: null, value: null }, 'error'], // "ready" without a payload
  ];
  for (const [reply, failure] of cases) {
    const g = gate();
    const { r } = make(g);
    const p = r.reload();
    g.answer(reply);
    await p;
    expect(r.snap.failure, failure).toBe(failure);
    expect(r.snap.data).toBeNull();
  }
});

test('a 403 drops what was shown (the caller has no view of this read) and says forbidden; other refusals are worded', async () => {
  const g = gate();
  const { r } = make(g);
  let p = r.reload();
  g.answer(ready([1]));
  await p;
  p = r.reload();
  g.fail(errorOf(403, 'forbidden', { reason: 'station_scoped' }));
  await p;
  expect(r.snap).toMatchObject({ data: null, failure: 'forbidden', fetchedAt: null });

  const cases: Array<[unknown, string, string]> = [
    [errorOf(503, 'intercom_unavailable', { state: 'error', last_error: 'rate_limited' }), 'rate', ''],
    [errorOf(503, 'intercom_unavailable', { state: 'ha_unavailable', last_error: 'ha_unavailable' }), 'unavailable', ''],
    [errorOf(429, 'rate_limited'), 'rate', ''],
    [errorOf(500, 'internal'), 'error', 'm'],
  ];
  for (const [err, failure, message] of cases) {
    const g2 = gate();
    const { r: r2 } = make(g2);
    const p2 = r2.reload();
    g2.fail(err);
    await p2;
    expect(r2.snap.failure, String(failure)).toBe(failure);
    expect(r2.snap.message).toBe(message);
  }
});

test('a paged read appends the next page over the server\'s own cursor and stops at the end', async () => {
  const g = gate();
  const { r } = make(g, {
    pick: (x: R) => (x.value ? { items: x.value, next: x.next ?? null } : null),
    merge: (a: { items: number[]; next: number | null }, b: { items: number[]; next: number | null }) => ({ items: [...a.items, ...b.items.filter((i) => !a.items.includes(i))], next: b.next }),
    cursorOf: (d: { next: number | null }) => d.next,
  });
  const rr = r as unknown as Resource<{ items: number[]; next: number | null }, R>;
  let p = rr.reload();
  expect(g.waiting[0].cursor).toBeNull();
  g.answer(ready([1, 2], { next: 2 }));
  await p;
  expect(rr.hasMore).toBe(true);
  p = rr.more();
  expect(rr.snap.loadingMore).toBe(true);
  expect(g.waiting[0].cursor).toBe(2); // the cursor exactly as served
  g.answer(ready([2, 3], { next: null }));
  await p;
  expect(rr.snap.data).toEqual({ items: [1, 2, 3], next: null });
  expect(rr.snap.loadingMore).toBe(false);
  expect(rr.hasMore).toBe(false);
  await rr.more(); // nothing more: no request
  expect(g.waiting).toHaveLength(0);
});

test('a failed "more" keeps the shown pages and says so; a "more" while a read is out is dropped', async () => {
  const g = gate();
  const { r } = make(g, {
    pick: (x: R) => (x.value ? { items: x.value, next: x.next ?? null } : null),
    merge: (a: { items: number[] }, b: { items: number[]; next: number | null }) => ({ items: [...a.items, ...b.items], next: b.next }),
    cursorOf: (d: { next: number | null }) => d.next,
  });
  const rr = r as unknown as Resource<{ items: number[]; next: number | null }, R>;
  let p = rr.reload();
  g.answer(ready([1], { next: 1 }));
  await p;
  void rr.reload();
  void rr.more(); // dropped: a read is out
  expect(g.waiting).toHaveLength(1);
  g.answer(ready([1], { next: 1 }));
  await tick();
  p = rr.more();
  g.fail(new TypeError('offline'));
  await p;
  expect(rr.snap.data).toEqual({ items: [1], next: 1 });
  expect(rr.snap).toMatchObject({ moreFailed: true, failure: 'network' });
});

test('a disposed loader ignores a late answer and asks for nothing more', async () => {
  const g = gate();
  const { r, changes } = make(g);
  const p = r.reload();
  const before = changes.length;
  r.dispose();
  g.answer(ready([9]));
  await p;
  expect(r.snap.data).toBeNull();
  expect(changes.length).toBe(before);
  await r.reload();
  expect(g.waiting).toHaveLength(0);
});
