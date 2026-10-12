import { test, expect } from '@playwright/test';
import { EventsFeed, type FetchPage } from '../src/access-control/events-feed';
import { ApiError } from '../src/api/client';
import type { AccessEvent, AccessEventFilters, AccessEventsPage, AccessEventsReply } from '../src/api/access-events';

// CR-036 S8: the single-flight paged loader of the entry log (the behaviour the first native screen had, now a class of its own).
// Node only: a fake `fetchPage` stands in for GET /access-control/events.

const row = (id: string): AccessEvent => ({
  id, station_id: 'entry-a', timestamp: '2026-09-27T08:40:00+00:00', received_at: null, time_source: 'device', person_name: 'Dana', employee_no: '1001',
  authentication: 'card', result: 'granted', event_type: 'access_granted', recovered: false, door: 1, portrait: false,
});
const page = (ids: string[], next: string | null): AccessEventsPage => ({
  records: ids.map(row), next, retention_days: 30, capacity: 5000, membership_basis: null, storage_failed: false, stations: {}, complete: true, incomplete_reason: null,
});
const ready = (ids: string[], next: string | null, fetched = '2026-09-27T09:00:00Z'): AccessEventsReply => ({ state: 'ready', configured: true, last_error: null, fetched_at: fetched, events: page(ids, next) });
const notReady = (state: AccessEventsReply['state'], last_error: string | null = null): AccessEventsReply => ({ state, configured: true, last_error, fetched_at: null, events: null });
const api = (status: number, code: string) => new ApiError(status, { code, user_message: code, retryable: false, correlation_id: '', details: {} });

interface Call {
  filters: AccessEventFilters;
  before: string | null;
  resolve: (r: AccessEventsReply) => void;
  reject: (e: unknown) => void;
}

/** A fetch whose answers the test releases by hand, in any order. */
function manual() {
  const calls: Call[] = [];
  const fetchPage: FetchPage = (filters, before) => new Promise((resolve, reject) => void calls.push({ filters, before, resolve, reject }));
  return { calls, fetchPage };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('the first load fills page 1, notes when it was fetched, and nothing else is asked', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const p = feed.reload();
  expect(feed.snap.busy).toBe(true);
  expect(m.calls).toHaveLength(1);
  expect(m.calls[0].before).toBeNull();
  m.calls[0].resolve(ready(['3', '2', '1'], 'ev-1'));
  await p;
  await tick();
  expect(feed.snap.busy).toBe(false);
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['3', '2', '1']);
  expect(feed.snap.pages).toBe(1);
  expect(feed.snap.shownAt).toBe('2026-09-27T09:00:00Z');
  expect(feed.snap.everReady).toBe(true);
});

test('"load more" passes the server\'s cursor back exactly as served and appends the older page', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].resolve(ready(['4', '3'], 'c.OpaqueToken-123_x'));
  await first;
  await tick();
  const more = feed.more();
  expect(m.calls[1].before).toBe('c.OpaqueToken-123_x'); // unchanged, token and all
  expect(feed.snap.loadingMore).toBe(true);
  m.calls[1].resolve(ready(['2', '1'], null));
  await more;
  await tick();
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['4', '3', '2', '1']);
  expect(feed.snap.pages).toBe(2);
  expect(feed.snap.page?.next).toBeNull();
  expect(feed.snap.shownAt).toBe('2026-09-27T09:00:00Z'); // still the fetch time of page 1
  await feed.more(); // nothing left: nothing is asked
  expect(m.calls).toHaveLength(2);
});

test('a change notice reloads page 1 while it is the only page, and only tells the reader once more pages are shown', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].resolve(ready(['2', '1'], 'ev-1'));
  await first;
  await tick();
  const n1 = feed.notice();
  expect(m.calls).toHaveLength(2); // page 1 only: reloaded
  m.calls[1].resolve(ready(['3', '2', '1'], 'ev-1', '2026-09-27T09:05:00Z'));
  await n1;
  await tick();
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['3', '2', '1']);
  expect(feed.snap.shownAt).toBe('2026-09-27T09:05:00Z');

  const more = feed.more();
  m.calls[2].resolve(ready(['0'], null));
  await more;
  await tick();
  expect(feed.snap.pages).toBe(2);
  await feed.notice(); // two pages shown: the reader keeps their place
  expect(m.calls).toHaveLength(3);
  expect(feed.snap.pendingUpdate).toBe(true);
  expect(feed.snap.page?.records).toHaveLength(4);

  const reload = feed.reload(); // the reader's refresh brings page 1 back and clears the note
  m.calls[3].resolve(ready(['4', '3'], 'ev-3'));
  await reload;
  await tick();
  expect(feed.snap.pendingUpdate).toBe(false);
  expect(feed.snap.pages).toBe(1);
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['4', '3']);
});

test('a notice that lands while "load more" is in flight is judged when it runs, not when it arrives', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].resolve(ready(['2', '1'], 'ev-1'));
  await first;
  await tick();
  const more = feed.more(); // in flight
  void feed.notice(); // arrives meanwhile: queued, nothing sent
  expect(m.calls).toHaveLength(2);
  m.calls[1].resolve(ready(['0'], null));
  await more;
  await tick();
  // two pages are shown by now: the queued notice became the "something changed" note, not a silent page-1 reload
  expect(m.calls).toHaveLength(2);
  expect(feed.snap.pendingUpdate).toBe(true);
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['2', '1', '0']);
});

test('a reload asked for while another load is out is queued once and outranks a notice', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  void feed.notice();
  void feed.reload();
  void feed.reload();
  expect(m.calls).toHaveLength(1);
  m.calls[0].resolve(ready(['1'], null));
  await first;
  await tick();
  expect(m.calls).toHaveLength(2); // exactly one queued reload
  m.calls[1].resolve(ready(['2', '1'], null));
  await tick();
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['2', '1']);
  expect(feed.snap.busy).toBe(false);
});

test('new filters throw away the answer of the old ones', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  void feed.restart({});
  const second = feed.restart({ result: 'denied' });
  expect(m.calls).toHaveLength(2);
  expect(m.calls[1].filters).toEqual({ result: 'denied' });
  m.calls[1].resolve(ready(['9'], null));
  await second;
  await tick();
  m.calls[0].resolve(ready(['1', '2', '3'], null)); // the old filters answer late
  await tick();
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['9']);
  expect(feed.filters).toEqual({ result: 'denied' });
});

test('an expired cursor keeps what is shown and offers a reload from the start', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].resolve(ready(['2', '1'], 'c.gone'));
  await first;
  await tick();
  const more = feed.more();
  m.calls[1].reject(api(422, 'intercom_cursor_expired'));
  await more;
  await tick();
  expect(feed.snap.cursorExpired).toBe(true);
  expect(feed.snap.page?.records).toHaveLength(2);
  expect(feed.snap.busy).toBe(false);
  const reload = feed.reload();
  m.calls[2].resolve(ready(['5'], null));
  await reload;
  await tick();
  expect(feed.snap.cursorExpired).toBe(false);
  expect(feed.snap.page?.records.map((r) => r.id)).toEqual(['5']);
});

test('rows shown survive an answer that is not ready, and a request that did not come back', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].resolve(ready(['2', '1'], null));
  await first;
  await tick();
  const second = feed.reload();
  m.calls[1].resolve(notReady('ha_unavailable'));
  await second;
  await tick();
  expect(feed.snap.reply?.state).toBe('ha_unavailable');
  expect(feed.snap.page?.records).toHaveLength(2); // kept, the screen marks them stale
  const third = feed.reload();
  m.calls[2].reject(new TypeError('network'));
  await third;
  await tick();
  expect(feed.snap.error).toBe('אין חיבור לשרת.');
  expect(feed.snap.page?.records).toHaveLength(2);
});

test('a 403 means the entry log is not for this caller: nothing more is ever sent', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  const first = feed.reload();
  m.calls[0].reject(api(403, 'forbidden'));
  await first;
  await tick();
  expect(feed.snap.forbidden).toBe(true);
  await feed.reload();
  await feed.notice();
  expect(m.calls).toHaveLength(1);
});

test('markForbidden stops everything before the first request', async () => {
  const m = manual();
  const feed = new EventsFeed(m.fetchPage);
  feed.markForbidden();
  await feed.restart({});
  expect(m.calls).toHaveLength(0);
  expect(feed.snap.forbidden).toBe(true);
});

test('a disposed feed ignores late answers and sends no more', async () => {
  const m = manual();
  let changes = 0;
  const feed = new EventsFeed(m.fetchPage, () => void changes++);
  const first = feed.reload();
  feed.dispose();
  const seen = changes;
  m.calls[0].resolve(ready(['1'], null));
  await first;
  await tick();
  expect(changes).toBe(seen);
  await feed.reload();
  expect(m.calls).toHaveLength(1);
});
