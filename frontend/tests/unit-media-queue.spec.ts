import { test, expect } from '@playwright/test';
import {
  BROWSE_TYPES, BROWSE_TYPE_LABEL, MA_STATE_LABEL, PLAYER_ERROR_LABEL, QUEUE_SELECT_MAX, browseOffered, confirmCount, fullQueueOffered, httpPlayers, partialDone, queueDropTarget, queueResultLine,
  reorderRows, toggleSelected, upcomingCount, type QueueRow,
} from '../src/api/media-players';
import { resetPlayersMock } from '../src/api/media-players-mock';
import { ApiError } from '../src/api/client';

// CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17): the client's queue / library-tab helpers, the HTTP routes it calls and the
// MOCK adapter's queue, browse and connection behaviour. No browser page.

const req = (n: number) => ({ client_request_id: `q-${n}-abcdefgh`, expires_at: new Date(Date.now() + 15000).toISOString() });
const code = async (p: Promise<unknown>): Promise<string | null> => {
  try { await p; return null; } catch (e) { return e instanceof ApiError ? e.code : `other:${String(e)}`; }
};
const row = (index: number, locked = false): QueueRow => ({ item: `i${index}`.padEnd(24, '0'), index, name: `שיר ${index}`, artist: null, album: null, duration_s: 200, locked });

test.describe('pure helpers', () => {
  test('a drop never lands in the locked zone or past the end, and a locked row never moves', () => {
    expect(queueDropTarget(6, 4, 3, 9)).toBe(4);
    expect(queueDropTarget(6, 2, 3, 9)).toBe(4); // clamped to the first free slot
    expect(queueDropTarget(6, 40, 3, 9)).toBe(9);
    expect(queueDropTarget(6, 6, 3, 9)).toBeNull();
    expect(queueDropTarget(3, 7, 3, 9)).toBeNull(); // a locked row
  });

  test('the optimistic order moves one row and renumbers from the first index', () => {
    const rows = [row(2, true), row(3, true), row(4), row(5), row(6)];
    expect(reorderRows(rows, 6, 4).map((r) => r.name)).toEqual(['שיר 2', 'שיר 3', 'שיר 6', 'שיר 4', 'שיר 5']);
    expect(reorderRows(rows, 6, 4).map((r) => r.index)).toEqual([2, 3, 4, 5, 6]);
    expect(reorderRows(rows, 99, 4).map((r) => r.name)).toEqual(rows.map((r) => r.name));
  });

  test('offers follow the caps and the permission', () => {
    expect(fullQueueOffered({ caps: { queue_list: true } as never })).toBe(true);
    expect(fullQueueOffered({ caps: {} as never })).toBe(false);
    expect(browseOffered({ caps: { browse: true } as never, can: { browse: true } as never })).toBe(true);
    expect(browseOffered({ caps: { browse: true } as never, can: { browse: false } as never })).toBe(false);
  });

  test('the Hebrew words: types, states, errors', () => {
    expect(BROWSE_TYPES.map((t) => BROWSE_TYPE_LABEL[t])).toEqual(['שירים', 'אלבומים', 'אמנים', 'פלייליסטים', 'תחנות']);
    expect(MA_STATE_LABEL.ready).toBe('מחובר');
    expect(PLAYER_ERROR_LABEL.locked).toBe('השיר הזה כבר מתנגן');
    const e = new ApiError(409, { code: 'confirm_required', user_message: 'x', retryable: false, correlation_id: 'c', details: { count: 7 } });
    expect(confirmCount(e)).toBe(7);
    expect(confirmCount(new Error('x'))).toBeNull();
  });

  test('the HTTP adapter calls the contract routes', async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const orig = globalThis.fetch;
    (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      await httpPlayers.queue('mp-a');
      await httpPlayers.queueEdit('mp-a', { op: 'move', item: 'a'.repeat(24), to: 5, ...req(1) });
      await httpPlayers.browse('mp-a', 'album', ' ג׳אז ', 50);
      await httpPlayers.maConnection();
      await httpPlayers.saveMaConnection({ enabled: true });
      await httpPlayers.testMaConnection();
    } finally {
      globalThis.fetch = orig;
    }
    expect(seen.map((s) => `${s.method} ${new URL(s.url).pathname}${new URL(s.url).search}`)).toEqual([
      'GET /app/api/v1/multimedia/devices/mp-a/queue',
      'POST /app/api/v1/multimedia/devices/mp-a/queue',
      `GET /app/api/v1/multimedia/devices/mp-a/browse?type=album&q=${encodeURIComponent('ג׳אז').replace(/%20/g, '+')}&offset=50`,
      'GET /app/api/v1/multimedia/admin/ma-connection',
      'PUT /app/api/v1/multimedia/admin/ma-connection',
      'POST /app/api/v1/multimedia/admin/ma-connection/test',
    ]);
    expect(seen[1].body).toMatchObject({ op: 'move', to: 5 });
  });
});

test.describe('the mock adapter (house with a music library)', () => {
  test('off by default: no full queue, no library tab - the 0.1.150 shape', async () => {
    const m = resetPlayersMock('ma');
    const d = await m.get('mp-liv');
    expect([d.caps.queue_list, d.caps.browse, d.caps.search, d.can.queue, d.can.browse]).toEqual([false, false, false, false, false]);
    expect(await code(m.queue('mp-liv'))).toBe('ma_unavailable');
  });

  test('phase 2b on: the queue starts at the current row, locked rows, edits and the clear question', async () => {
    const m = resetPlayersMock('ma');
    m.enablePhase2b();
    const d = await m.get('mp-liv');
    expect([d.caps.queue_list, d.caps.browse, d.caps.search, d.can.queue, d.can.browse]).toEqual([true, true, true, true, true]);
    const q = await m.queue('mp-liv');
    expect(q.confirmed).toBe(true);
    const locked = q.items.filter((r) => r.locked).map((r) => r.index);
    expect(locked).toEqual([q.index!, q.index! + 1]);
    expect(q.items.every((r) => /^[a-f0-9]{24}$/.test(r.item))).toBe(true);
    const free = q.items.filter((r) => !r.locked);
    const last = free[free.length - 1];
    const r = await m.queueEdit('mp-liv', { op: 'next', item: last.item, ...req(1) });
    expect(r).toEqual({ status: 'accepted', op: 'next', to: q.locked_to! + 1 });
    expect((await m.queue('mp-liv')).items.find((x) => x.index === q.locked_to! + 1)!.item).toBe(last.item);
    expect(await code(m.queueEdit('mp-liv', { op: 'delete', item: q.items[0].item, ...req(2) }))).toBe('locked');
    expect(await code(m.queueEdit('mp-liv', { op: 'clear', ...req(3) }))).toBe('confirm_required');
    await m.queueEdit('mp-liv', { op: 'clear', confirmed: true, ...req(4) });
    expect((await m.queue('mp-liv')).items.every((x) => x.locked)).toBe(true);
    m.canQueue = false;
    expect(await code(m.queueEdit('mp-liv', { op: 'clear', confirmed: true, ...req(5) }))).toBe('forbidden');
  });

  test('browse by type, search, and a browsed item plays with play_item', async () => {
    const m = resetPlayersMock('ma');
    m.enablePhase2b();
    const albums = await m.browse('mp-liv', 'album');
    expect(albums.items.map((i) => i.name)).toEqual(['Bon Iver, Bon Iver', 'Kind of Blue', 'צהוב']);
    const found = await m.browse('mp-liv', 'track', 'blue');
    expect(found.items.map((i) => i.name)).toEqual(['All Blues', 'Blue in Green']);
    await m.command('mp-liv', { command: 'play_item', item_ref: found.items[0].item_ref, enqueue: 'add', ...req(9) });
    expect(m.sent.at(-1)?.command).toMatchObject({ command: 'play_item', enqueue: 'add' });
    m.ma.state = 'unreachable';
    expect(await code(m.browse('mp-liv', 'track', 'blue'))).toBe('not_supported'); // no search without the connection; browsing stays
    expect((await m.browse('mp-liv', 'track')).items.length).toBe(4);
  });

  test('the connection settings: write-only token, address validation, a test', async () => {
    const m = resetPlayersMock('ma');
    expect((await m.maConnection()).state).toBe('off');
    expect(await code(m.saveMaConnection({ url: 'ftp://x' }))).toBe('validation');
    const c = await m.saveMaConnection({ url: 'http://Music.Local:8095/', token: 'x'.repeat(30), enabled: true });
    expect([c.url, c.token_set, c.state]).toEqual(['http://music.local:8095', true, 'ready']);
    expect(JSON.stringify(c)).not.toContain('xxxxxxxx');
    expect((await m.testMaConnection()).state).toBe('ready');
    expect((await m.saveMaConnection({ clear_token: true })).state).toBe('off');
  });
});

test.describe('the new queue actions (play now, move to top, several rows, two clears)', () => {
  test('helpers: the selection cap, the upcoming count, the half-way line, the partial count of an error', () => {
    let sel: string[] = [];
    for (let i = 0; i < 40; i++) sel = toggleSelected(sel, `i${i}`);
    expect(sel.length).toBe(QUEUE_SELECT_MAX);
    expect(toggleSelected(['a', 'b'], 'a')).toEqual(['b']);
    expect(upcomingCount({ count: 12, locked_to: 4 })).toBe(7);
    expect(upcomingCount({ count: 3, locked_to: 4 })).toBe(0);
    expect(upcomingCount({ count: null, locked_to: null })).toBe(0);
    expect(queueResultLine({ status: 'refused', op: 'delete_many', done: 2, error: 7 }, 5)).toBe('הוסרו 2 מתוך 5');
    expect(queueResultLine({ status: 'refused', op: 'delete', error: 7 }, 1)).toBe('הפעולה נדחתה');
    expect(queueResultLine({ status: 'accepted', op: 'delete_many', count: 3 }, 3)).toBe('');
    const e = new ApiError(503, { code: 'ma_unavailable', user_message: 'x', retryable: true, correlation_id: 'c', details: { done: 1 } });
    expect(partialDone(e)).toBe(1);
    expect(partialDone(new Error('x'))).toBeNull();
  });

  test('play now moves the current row; the current row is refused; top = right after the locked rows', async () => {
    const m = resetPlayersMock('ma');
    m.enablePhase2b();
    const q = await m.queue('mp-liv');
    const free = q.items.filter((r) => !r.locked);
    expect(await code(m.queueEdit('mp-liv', { op: 'play', item: q.items[0].item, ...req(10) }))).toBe('locked');
    expect(await m.queueEdit('mp-liv', { op: 'play', item: free[2].item, ...req(11) })).toEqual({ status: 'accepted', op: 'play' });
    const after = await m.queue('mp-liv');
    expect(after.items[0].name).toBe(free[2].name);
    const f2 = after.items.filter((r) => !r.locked);
    expect(await m.queueEdit('mp-liv', { op: 'top', item: f2[f2.length - 1].item, ...req(12) })).toEqual({ status: 'accepted', op: 'top', to: after.locked_to! + 1 });
  });

  test('several rows: one request, at most 25, none locked, unknown refused; the two clears differ', async () => {
    const m = resetPlayersMock('ma');
    m.enablePhase2b();
    const q = await m.queue('mp-liv');
    const free = q.items.filter((r) => !r.locked);
    expect(await code(m.queueEdit('mp-liv', { op: 'delete_many', items: [], ...req(20) }))).toBe('validation');
    expect(await code(m.queueEdit('mp-liv', { op: 'delete_many', items: Array.from({ length: 26 }, (_, i) => `${i}`.padStart(24, '0')), ...req(21) }))).toBe('validation');
    expect(await code(m.queueEdit('mp-liv', { op: 'delete_many', items: [free[0].item, q.items[0].item], ...req(22) }))).toBe('locked');
    expect(await code(m.queueEdit('mp-liv', { op: 'delete_many', items: ['0'.repeat(24)], ...req(23) }))).toBe('unknown_item');
    expect(await m.queueEdit('mp-liv', { op: 'delete_many', items: [free[0].item, free[3].item], ...req(24) })).toEqual({ status: 'accepted', op: 'delete_many', count: 2 });
    const left = (await m.queue('mp-liv')).items;
    expect(left.length).toBe(q.items.length - 2);
    const up = left.filter((r) => !r.locked).length;
    expect(await code(m.queueEdit('mp-liv', { op: 'clear_upcoming', ...req(25) }))).toBe('confirm_required');
    expect(await m.queueEdit('mp-liv', { op: 'clear_upcoming', confirmed: true, ...req(26) })).toEqual({ status: 'accepted', op: 'clear_upcoming', count: up });
    expect((await m.queue('mp-liv')).items.length).toBe(2); // the current and the buffered row stay; the player keeps playing
    expect((await m.get('mp-liv')).live.play).toBe('playing');
    await m.queueEdit('mp-liv', { op: 'clear', confirmed: true, ...req(27) });
    expect((await m.queue('mp-liv')).items.length).toBe(0);
    expect((await m.get('mp-liv')).live.play).not.toBe('playing');
  });

  test('clear upcoming has no row cap: a queue of 1000 rows is cleared and counted', async () => {
    const m = resetPlayersMock('ma');
    m.enablePhase2b();
    m.queueLength = 1000;
    const q = await m.queue('mp-liv');
    expect(q.count).toBe(1000);
    const up = upcomingCount(q);
    expect(up).toBeGreaterThan(900);
    expect(await code(m.queueEdit('mp-liv', { op: 'clear_upcoming', ...req(40) }))).toBe('confirm_required');
    expect(await m.queueEdit('mp-liv', { op: 'clear_upcoming', confirmed: true, ...req(41) })).toEqual({ status: 'accepted', op: 'clear_upcoming', count: up });
    expect((await m.queue('mp-liv')).count).toBe(1000 - up);
  });

  test('the HTTP adapter posts the several-rows body as `items`', async () => {
    const seen: unknown[] = [];
    const orig = globalThis.fetch;
    (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
    globalThis.fetch = (async (_u: string | URL, init?: RequestInit) => {
      seen.push(init?.body ? JSON.parse(String(init.body)) : null);
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      await httpPlayers.queueEdit('mp-a', { op: 'delete_many', items: ['a'.repeat(24), 'b'.repeat(24)], ...req(30) });
    } finally {
      globalThis.fetch = orig;
    }
    expect(seen[0]).toMatchObject({ op: 'delete_many', items: ['a'.repeat(24), 'b'.repeat(24)] });
  });
});
