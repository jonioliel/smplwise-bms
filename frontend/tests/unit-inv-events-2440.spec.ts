import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Latest } from '../src/api/latest';
import { THUMB_BUSY_MS, THUMB_FIRST_MS, THUMB_MAX_POLLS, ThumbPoller, pushedAction, thumbDelay, type PushFilters } from '../src/screens/investigate-events-logic';

// CR-INV-EVENTS-2440 (review 06:RACE-3, 06:RACE-4, 06:EVT-1, 06:EVT-2, 06:RACE-7 case detail; docs/changes/CR-INV-EVENTS-2440.md).
// Node only: the two decisions moved to screens/investigate-events-logic.ts, the "newest read wins" guard driven with answers that
// come back in the wrong order, and the three screens' sources.
const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/** Let the promise chains that are ready run (a load reaches its next await). */
const tick = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------- 06:RACE-3 the list

/** The list's load as written in screens/investigate-events.ts (pinned by the source test below). */
function listLike(fetch: (filter: string) => Promise<string[]>) {
  const reads = new Latest();
  const s = { filter: 'all', events: null as string[] | null, error: '' };
  const load = async (): Promise<void> => {
    const current = reads.begin();
    try {
      const r = await fetch(s.filter);
      if (!current()) return;
      s.events = r;
      s.error = '';
    } catch (err) {
      if (!current()) return;
      s.error = String(err);
    }
  };
  return { s, load };
}

test('06:RACE-3: two filters, reversed answers - the list shows the rows of the filter that is selected', async () => {
  const answers: Record<string, ReturnType<typeof deferred<string[]>>> = { all: deferred(), unacked: deferred() };
  const { s, load } = listLike((f) => answers[f].promise);
  const first = load(); // "הכל"
  s.filter = 'unacked';
  const second = load(); // the person picks "לבדיקה" while the first read is slow
  answers.unacked.resolve(['u1', 'u2']);
  await second;
  expect(s.events).toEqual(['u1', 'u2']);
  answers.all.resolve(['a1', 'a2', 'a3', 'a4']); // the earlier filter's answer arrives last
  await first;
  expect(s.events).toEqual(['u1', 'u2']);
  expect(s.filter).toBe('unacked');
});

test('06:RACE-3: a late failure of an earlier filter does not put an error over the newer list', async () => {
  const answers: Record<string, ReturnType<typeof deferred<string[]>>> = { all: deferred(), acked: deferred() };
  const { s, load } = listLike((f) => answers[f].promise);
  const first = load();
  s.filter = 'acked';
  const second = load();
  answers.acked.resolve(['k1']);
  await second;
  answers.all.reject(new Error('504'));
  await first;
  expect([s.events, s.error]).toEqual([['k1'], '']);
});

test('06:RACE-3 / 06:EVT-2: the list\'s source - the guard, the read on a route change, the timers cleared on leaving', () => {
  const e = code('screens/investigate-events.ts');
  const load = e.slice(e.indexOf('private async load() {'), e.indexOf('private onSearchInput('));
  expect(load).toMatch(/const current = this\.reads\.begin\(\);\s*this\.loadedFor = \{ cameraId: this\.cameraId, date: this\.date \};/);
  expect(load).toMatch(/const r = await listEvents\(\{[^\n]*\}\);\s*if \(!current\(\)\) return;\s*this\.events = r\.events;/);
  expect(load).toMatch(/catch \(err\) \{\s*if \(!current\(\)\) return;\s*this\.error = describeError\(err\);/);
  expect(e).toMatch(/protected willUpdate\(changed: PropertyValues\) \{\s*if \(!\(changed\.has\('cameraId'\) \|\| changed\.has\('date'\)\) \|\| !this\.loadedFor \|\| !isApi\(\)\) return;\s*if \(this\.loadedFor\.cameraId !== this\.cameraId \|\| this\.loadedFor\.date !== this\.date\) void this\.load\(\);/);
  const off = e.slice(e.indexOf('disconnectedCallback() {'), e.indexOf('protected willUpdate('));
  for (const line of ['this.thumbs.stop();', 'window.clearTimeout(this.qTimer);', 'window.clearTimeout(this.rowPreviewTimer);', 'window.clearTimeout(this.pushReloadTimer);', 'this.reads.cancel();']) expect(off, line).toContain(line);
  // nothing is scheduled from inside the table's render any more
  expect(e).not.toMatch(/schedulePoll|thumbTimers|thumbInFlight/);
  const thumb = e.slice(e.indexOf('private renderThumb('), e.indexOf('private async ackAll()'));
  expect(thumb).toContain('this.wantThumb(ev.id);');
  expect(thumb).not.toMatch(/setTimeout|this\.thumbs\./);
  expect(e).toMatch(/private wantThumb\(id: string\) \{\s*if \(!this\.thumbWanted\.size\) \{\s*queueMicrotask\(/);
});

// ---------------------------------------------------------------- 06:EVT-1 a pushed event against the filters

const NONE: PushFilters = { date: '', cameraId: '', recorderId: '', type: '', source: '', filter: 'all', placeFloor: '', placeZone: '', q: '' };
const EV = { camera_id: 'cam1', recorder_id: 'rec1', type: 'motion', source: 'alertstream', acked_at: null };
const at = (known = false, day = '2026-11-16', cameraRecorder: string | null = 'rec1') => ({ day, cameraRecorder, known });

test('06:EVT-1: a push with a non-matching source is not added to a list filtered by source', () => {
  expect(pushedAction(EV, { ...NONE, source: 'recording' }, at())).toBe('drop');
  expect(pushedAction(EV, { ...NONE, source: 'alertstream' }, at())).toBe('prepend');
  expect(pushedAction({ ...EV, source: 'ha' }, { ...NONE, source: 'ha', type: 'motion', cameraId: 'cam1', date: '2026-11-16' }, at())).toBe('prepend');
});

test('06:EVT-1: "טופלו" takes no unreviewed event, "לבדיקה" no handled one; a row already listed is refreshed either way', () => {
  expect(pushedAction(EV, { ...NONE, filter: 'acked' }, at())).toBe('drop');
  expect(pushedAction({ ...EV, acked_at: '2026-11-16T08:00:00Z' }, { ...NONE, filter: 'acked' }, at())).toBe('prepend');
  expect(pushedAction({ ...EV, acked_at: '2026-11-16T08:00:00Z' }, { ...NONE, filter: 'unacked' }, at())).toBe('drop');
  expect(pushedAction(EV, { ...NONE, filter: 'unacked' }, at())).toBe('prepend');
  expect(pushedAction(EV, { ...NONE, filter: 'acked', source: 'recording', q: 'door', placeFloor: 'f1' }, at(true))).toBe('update');
});

test('06:EVT-1: with a place or a text filter a new event asks for one read instead of being guessed in', () => {
  for (const f of [{ placeFloor: 'f1' }, { placeZone: 'z1' }, { q: 'gate' }]) expect(pushedAction(EV, { ...NONE, ...f }, at()), JSON.stringify(f)).toBe('reload');
  expect(pushedAction(EV, { ...NONE, q: '   ' }, at())).toBe('prepend'); // blanks are no search
  expect(pushedAction(EV, { ...NONE, q: 'gate', source: 'recording' }, at())).toBe('drop'); // the browser can already say no
});

test('06:EVT-1: the four tests the screen always made are unchanged - day, camera, recorder (the event\'s or its camera\'s), type', () => {
  expect(pushedAction(EV, { ...NONE, date: '2026-11-15' }, at())).toBe('drop');
  expect(pushedAction(EV, { ...NONE, date: '2026-11-15' }, at(true))).toBe('drop'); // as before: also for a listed row
  expect(pushedAction(EV, { ...NONE, cameraId: 'cam2' }, at())).toBe('drop');
  expect(pushedAction(EV, { ...NONE, type: 'person' }, at())).toBe('drop');
  expect(pushedAction(EV, { ...NONE, recorderId: 'rec2' }, at())).toBe('drop');
  expect(pushedAction({ ...EV, recorder_id: null }, { ...NONE, recorderId: 'rec1' }, at())).toBe('prepend'); // through its camera
  expect(pushedAction({ ...EV, recorder_id: null }, { ...NONE, recorderId: 'rec1' }, at(false, '2026-11-16', null))).toBe('drop');
  expect(pushedAction(EV, NONE, at())).toBe('prepend');
  expect(pushedAction(EV, NONE, at(true))).toBe('update');
  const e = code('screens/investigate-events.ts');
  const pushed = e.slice(e.indexOf('private onPushed('), e.indexOf('private fmt('));
  expect(pushed).toMatch(/const action = pushedAction\(/);
  expect(pushed).toMatch(/if \(action === 'drop'\) return;\s*if \(action === 'reload'\) \{\s*window\.clearTimeout\(this\.pushReloadTimer\);\s*this\.pushReloadTimer = window\.setTimeout\(\(\) => void this\.load\(\), 1000\);\s*return;/);
});

// ---------------------------------------------------------------- 06:EVT-2 the pending thumbnail

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    setTimeout: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id as unknown;
    },
    clearTimeout: (h: unknown) => void timers.delete(h as number),
    pending: () => timers.size,
    flush,
    /** Run every timer due within `ms`, in order, letting each one's promises settle. */
    advance: async (ms: number) => {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

test('06:EVT-2: a thumbnail that stays pending is asked for at most 14 times, however often its row is drawn', async () => {
  const tm = fakeTimers();
  let requests = 0;
  const done: string[] = [];
  const p = new ThumbPoller({ poll: async () => ((requests += 1), 'pending' as const), alive: () => true, done: (id, st) => void done.push(`${id}:${st}`), setTimeout: tm.setTimeout, clearTimeout: tm.clearTimeout });
  // the table renders every 30 s (its clock) and on every push: each render says "this row is still pending"
  for (let i = 0; i < 200; i++) {
    p.want('ev1');
    p.want('ev1');
    await tm.advance(30_000);
  }
  expect(requests).toBe(THUMB_MAX_POLLS);
  expect(THUMB_MAX_POLLS).toBe(14);
  expect(p.requests('ev1')).toBe(14);
  expect(tm.pending()).toBe(0);
  expect(done).toEqual([]);
});

test('06:EVT-2: the polls keep their pace between renders; a thumbnail that arrives ends them', async () => {
  const tm = fakeTimers();
  const answers = ['pending', 'pending', 'ready'] as const;
  let n = 0;
  const done: string[] = [];
  const p = new ThumbPoller({ poll: async () => answers[n++], alive: () => true, done: (id, st) => void done.push(`${id}:${st}`), setTimeout: tm.setTimeout, clearTimeout: tm.clearTimeout });
  p.want('ev1');
  await tm.advance(THUMB_FIRST_MS - 1);
  expect(n).toBe(0);
  await tm.advance(1);
  expect(n).toBe(1);
  p.want('ev1'); // a render in between starts nothing new: the next poll is already waiting
  expect(tm.pending()).toBe(1);
  await tm.advance(thumbDelay(0));
  expect(n).toBe(2);
  await tm.advance(thumbDelay(1));
  expect([n, done]).toEqual([3, ['ev1:ready']]);
  expect(tm.pending()).toBe(0);
  expect([thumbDelay(0), Math.round(thumbDelay(1)), thumbDelay(20)]).toEqual([3000, 4050, 15000]);
});

test('06:EVT-2: two requests at a time; a row that left the list is not asked for; cancel and prune forget', async () => {
  const tm = fakeTimers();
  const gate = deferred<'ready'>();
  const started: string[] = [];
  let listed = new Set(['a', 'b', 'c', 'd']);
  const p = new ThumbPoller({ poll: (id) => (started.push(id), gate.promise), alive: (id) => listed.has(id), done: () => undefined, setTimeout: tm.setTimeout, clearTimeout: tm.clearTimeout });
  for (const id of ['a', 'b', 'c', 'd']) p.want(id);
  listed = new Set(['a', 'b', 'c']); // "d" left the list before its first poll
  await tm.advance(THUMB_FIRST_MS);
  expect(started).toEqual(['a', 'b']); // "c" found both slots taken and waits, "d" is gone
  expect(p.requests('c')).toBe(0); // waiting for a slot does not use one of its 14
  await tm.advance(THUMB_BUSY_MS);
  expect(started).toEqual(['a', 'b']);
  p.cancel('c'); // a push said its thumbnail is ready
  gate.resolve('ready');
  await tm.flush();
  await tm.advance(60_000);
  expect(started).toEqual(['a', 'b']);
  p.want('c');
  p.prune(new Set(['a']));
  expect(tm.pending()).toBe(0);
  expect([p.requests('a'), p.requests('b')]).toEqual([1, 0]);
  p.want('e');
  p.stop();
  expect(tm.pending()).toBe(0);
});

// ---------------------------------------------------------------- 06:RACE-4 the event page, 06:RACE-7 the case page

/** The event page's load, as written in screens/investigate-event-detail.ts (pinned below). */
function detailLike(api: { stop: () => Promise<void>; get: (id: string) => Promise<{ id: string; title: string }>; route: (id: string) => Promise<string> }) {
  const reads = new Latest();
  const s = { eventId: '', ev: null as { id: string; title: string } | null, route: null as string | null, error: '', played: [] as string[] };
  const showing = (id: string) => s.ev?.id === id;
  const loadRoute = async (id: string): Promise<void> => {
    s.route = null;
    try {
      const route = await api.route(id);
      if (!showing(id)) return;
      s.route = route;
    } catch {
      if (showing(id)) s.route = null;
    }
  };
  const load = async (): Promise<void> => {
    const current = reads.begin();
    const id = s.eventId;
    s.error = '';
    await api.stop();
    if (!current()) return;
    try {
      const ev = await api.get(id);
      if (!current()) return;
      s.ev = ev;
      void loadRoute(ev.id);
      s.played.push(ev.id);
    } catch (err) {
      if (!current()) return;
      s.error = String(err);
      s.ev = null;
    }
  };
  return { s, load };
}

test('06:RACE-4: two ids, reversed answers - the page shows the event of its address, plays only it, and keeps only its route', async () => {
  const gets: Record<string, ReturnType<typeof deferred<{ id: string; title: string }>>> = { e1: deferred(), e2: deferred() };
  const routes: Record<string, ReturnType<typeof deferred<string>>> = { e1: deferred(), e2: deferred() };
  const { s, load } = detailLike({ stop: async () => undefined, get: (id) => gets[id].promise, route: (id) => routes[id].promise });
  s.eventId = 'e1';
  const a = load();
  await tick(); // e1's read is out
  s.eventId = 'e2'; // a "nearby" row was pressed while e1 was still being read
  const b = load();
  await tick();
  gets.e2.resolve({ id: 'e2', title: 'second' });
  await b;
  gets.e1.resolve({ id: 'e1', title: 'first' }); // the first event's answer arrives last
  await a;
  expect([s.ev?.id, s.played]).toEqual(['e2', ['e2']]);
  routes.e2.resolve('route of e2');
  await tick();
  expect(s.route).toBe('route of e2');
});

test('06:RACE-4: an answer of the fan-out for the event that was left is dropped; a failed read of the left event sets no error', async () => {
  const gets: Record<string, ReturnType<typeof deferred<{ id: string; title: string }>>> = { e1: deferred(), e2: deferred(), e3: deferred() };
  const routes: Record<string, ReturnType<typeof deferred<string>>> = { e1: deferred(), e2: deferred(), e3: deferred() };
  const { s, load } = detailLike({ stop: async () => undefined, get: (id) => gets[id].promise, route: (id) => routes[id].promise });
  s.eventId = 'e1';
  gets.e1.resolve({ id: 'e1', title: 'first' });
  await load(); // e1 is shown, its route is still out
  s.eventId = 'e2';
  gets.e2.resolve({ id: 'e2', title: 'second' });
  await load();
  routes.e1.resolve('route of e1'); // late, for the event that was left
  await tick();
  expect(s.route).toBeNull();
  s.eventId = 'e3';
  const c = load();
  await tick(); // e3's read is out
  s.eventId = 'e2';
  const d = load();
  gets.e3.reject(new Error('404'));
  await c;
  await d;
  expect([s.error, s.ev?.id]).toEqual(['', 'e2']);
});

test('06:RACE-4 / 06:RACE-7: the sources - the event page and the case page check after every await, in the try and in the catch', () => {
  const d = code('screens/investigate-event-detail.ts');
  const load = d.slice(d.indexOf('private async load() {'), d.indexOf('private showing('));
  expect(load).toMatch(/const current = this\.reads\.begin\(\);\s*const id = this\.eventId;\s*this\.error = '';\s*await this\.stopPlayer\(\);\s*if \(!current\(\)\) return;\s*try \{\s*const ev = await getEvent\(id\);\s*if \(!current\(\)\) return;\s*this\.ev = ev;/);
  expect(load).toMatch(/catch \(err\) \{\s*if \(!current\(\)\) return;\s*this\.error = describeError\(err\);/);
  expect(d).toMatch(/const route = await getEventRoute\(id\);\s*if \(!this\.showing\(id\)\) return;\s*this\.route = route;/);
  expect(d).toMatch(/const corr = await getCorrelation\(id\);\s*if \(this\.showing\(id\)\) this\.corr = corr;/);
  expect(d).toMatch(/if \(this\.showing\(ev\.id\)\) this\.nearby = r\.events\.filter/);
  expect(d).toMatch(/const b = await loadMap\(floorId\);\s*if \(this\.ev\?\.id !== evId\) return;/);
  expect(d).toMatch(/if \(this\.showing\(ev\.id\)\) this\.playerError = describeError\(err\);/);
  const c = code('screens/investigate-cases.ts');
  const caseLoad = c.slice(c.indexOf('const [s, d] = await Promise.all([productSettings(), getCase(id)]);'), c.indexOf('private fmt(iso: string)'));
  expect((caseLoad.match(/if \(this\.caseId !== id\) return;/g) ?? []).length).toBe(4); // after the case, the bundles, the cameras; and in the catch
  expect(caseLoad).toMatch(/catch \(err\) \{\s*if \(this\.caseId !== id\) return;\s*this\.error = describeError\(err\);/);
  expect(caseLoad).toMatch(/const bundles = \(await listBundles\(id\)[^\n]*\)\.bundles;\s*if \(this\.caseId !== id\) return;\s*this\.bundles = bundles;/);
});
