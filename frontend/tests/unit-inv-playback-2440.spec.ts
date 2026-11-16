import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Latest } from '../src/api/latest';
import { dateInZone, instantInZone, minuteInZone, retryLostSession } from '../src/api/recordings';
import { RefMemo } from '../src/map/memo';

// CR-INV-PLAYBACK-2440 (review 06:RACE-2, 06:RACE-5, 06:PERF-1, 06:PERF-2, the retry bound of 06:PLAY-2;
// docs/changes/CR-INV-PLAYBACK-2440.md). Node only: the identity memo, the zone formatters, the retry decision, the guards driven
// with answers in the wrong order, and the two screens' sources.
const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
const tick = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

// ---------------------------------------------------------------- 06:PERF-1 / 06:PERF-2 identity

test('06:PERF-1: RefMemo hands back the same array until one of its inputs is replaced', () => {
  const memo = new RefMemo();
  let made = 0;
  const rec = { segments: [1, 2, 3] };
  const list = (r: { segments: number[] } | null, tz: string) => memo.get('segments', [r, tz], () => ((made += 1), r ? r.segments.map((x) => x * 2) : []));
  const a = list(rec, 'Asia/Jerusalem');
  const b = list(rec, 'Asia/Jerusalem'); // the next tick: the cursor moved, the day's data did not
  expect(b).toBe(a);
  expect(made).toBe(1);
  expect(list({ segments: [1, 2, 3] }, 'Asia/Jerusalem')).not.toBe(a); // a new answer object: rebuilt, even with equal content
  expect(list(rec, 'UTC')).not.toBe(a); // another zone
  expect(made).toBe(3);
  const empty = list(null, 'UTC');
  expect(list(null, 'UTC')).toBe(empty); // "no recordings" is one stable empty list too
  // the slots do not disturb each other
  const other = memo.get('markers', [rec], () => ['m']);
  expect(memo.get('markers', [rec], () => ['n'])).toBe(other);
  expect(list(null, 'UTC')).toBe(empty);
});

/** The playback screen's three lists as written in screens/investigate-playback.ts (pinned below). */
function playbackLike() {
  const memo = new RefMemo();
  const s = { rec: null as { segments: { start_at: string; end_at: string; kind: string }[] } | null, dayEvents: [] as { occurred_at: string }[], tz: 'Asia/Jerusalem', cursor: 0 };
  return {
    s,
    get segmentsMin() {
      const { rec, tz } = s;
      return memo.get('segments', [rec, tz], () => (!rec ? [] : rec.segments.map((x) => ({ startMin: minuteInZone(new Date(x.start_at), tz), endMin: minuteInZone(new Date(x.end_at), tz), kind: x.kind }))));
    },
    get markers() {
      const { dayEvents, tz } = s;
      return memo.get('markers', [dayEvents, tz], () => dayEvents.map((e) => ({ minute: minuteInZone(new Date(e.occurred_at), tz) })));
    },
  };
}

test('06:PERF-1: across two ticks of the playing clock the timeline gets the same arrays; a new day\'s answer replaces them', () => {
  const p = playbackLike();
  p.s.rec = { segments: [{ start_at: '2026-11-16T06:00:00Z', end_at: '2026-11-16T07:30:00Z', kind: 'continuous' }] };
  p.s.dayEvents = [{ occurred_at: '2026-11-16T06:10:00Z' }];
  const seg1 = p.segmentsMin;
  const ev1 = p.markers;
  p.s.cursor += 1 / 120; // tick: half a second later
  const seg2 = p.segmentsMin;
  const ev2 = p.markers;
  p.s.cursor += 1 / 120;
  expect([p.segmentsMin, p.markers]).toEqual([seg1, ev1]);
  expect(seg2).toBe(seg1);
  expect(ev2).toBe(ev1);
  expect(p.segmentsMin).toBe(seg1);
  expect(seg1).toEqual([{ startMin: 8 * 60, endMin: 9 * 60 + 30, kind: 'continuous' }]); // 06:00Z = 08:00 in Jerusalem (winter)
  p.s.rec = { segments: [] }; // the next day was read
  expect(p.segmentsMin).not.toBe(seg1);
  expect(p.segmentsMin).toEqual([]);
  expect(p.markers).toBe(ev1); // the events were not replaced
});

test('06:PERF-1: the zone formatters are kept, and answer as before - zones, midnight, an unknown zone', () => {
  const at = new Date('2026-11-16T22:30:15Z');
  expect(dateInZone(at, 'Asia/Jerusalem')).toBe('2026-11-17');
  expect(dateInZone(at, 'UTC')).toBe('2026-11-16');
  expect(dateInZone(at, 'America/New_York')).toBe('2026-11-16');
  expect(minuteInZone(at, 'UTC')).toBeCloseTo(22 * 60 + 30 + 15 / 60, 6);
  expect(minuteInZone(at, 'Asia/Jerusalem')).toBeCloseTo(30 + 15 / 60, 6); // 00:30:15 the next day
  expect(minuteInZone(new Date('2026-11-16T22:00:00Z'), 'Asia/Jerusalem')).toBe(0); // midnight is minute 0, not 1440
  for (let i = 0; i < 3; i++) expect(minuteInZone(at, 'Asia/Jerusalem')).toBeCloseTo(30.25, 6); // the kept formatter gives the same answer
  expect(instantInZone('2026-11-17', 30.25, 'Asia/Jerusalem').toISOString()).toBe('2026-11-16T22:30:15.000Z');
  expect(() => minuteInZone(at, 'Not/AZone')).toThrow();
  expect(() => minuteInZone(at, 'Not/AZone')).toThrow(); // nothing was cached for it
  expect(() => dateInZone(at, 'Not/AZone')).toThrow();
  const r = code('api/recordings.ts');
  expect((r.match(/zoneFormat\((dayFormats|minuteFormats), timeZone, \(\) => new Intl\.DateTimeFormat\(/g) ?? []).length).toBe(2);
});

test('06:PERF-2: the history map\'s frame - segments per camera once per day, the timeline lists and the 3D cameras by identity', () => {
  const h = code('screens/investigate-history-map.ts');
  expect(h).toContain("const byCamera = this.memo.get('segmentsByCamera', [recordings, tz], () => new Map<string, DemoSegment[] | null>());");
  expect(h).toContain("return this.memo.get('tlSegments', [recordings, tz, camera, on], () =>");
  expect(h).toContain("return this.memo.get('tlEvents', [events, tz, camera, on], () =>");
  expect(h).toContain("return this.memo.get('cameras3d', [b], () =>");
  expect(h).toContain("return this.memo.get('zones', [b.zones], () => zonesWithChips(b.zones));");
  // both renders (the plain one and the time scrub) take the lists from there, and no template builds one inline any more
  expect((h.match(/const segs = this\.timelineSegments\(selCamera(, camsOn)?\);/g) ?? []).length).toBe(2);
  expect((h.match(/const tlEvents: TimelineEvent\[\] = this\.timelineEvents\(selCamera(, eventsOn)?\);/g) ?? []).length).toBe(2);
  expect((h.match(/\.cameras=\$\{this\.camerasOf\(b\)\}/g) ?? []).length).toBe(2);
  expect((h.match(/\.zones=\$\{this\.zonesOf\(b\)\}/g) ?? []).length).toBe(2);
  expect(h).toContain("return this.memo.get('anchorPositions', [b.anchors], () =>");
  expect((h.match(/\.anchorPositions=\$\{this\.anchorPositionsOf\(b\)\}/g) ?? []).length).toBe(2);
  expect(h).not.toMatch(/\.cameras=\$\{b\.anchors\.filter/);
});

// ---------------------------------------------------------------- 06:RACE-5 one selection per camera change

/** The playback screen's camera handling as written (pinned below): `updated()` follows the route's cameraId, selectCamera applies one. */
function cameraLike(api: { createPlayback: (id: string) => void; endSession: () => void; day: (id: string) => Promise<string> }) {
  const reads = new Latest();
  const s = { cameraId: '', applied: '', rec: null as string | null, loading: false, selections: 0 };
  const loadRecordings = async (): Promise<void> => {
    if (!s.cameraId) return;
    const current = reads.begin();
    s.loading = true;
    s.rec = null;
    try {
      const rec = await api.day(s.cameraId);
      if (!current()) return;
      s.rec = rec;
    } finally {
      if (current()) s.loading = false;
    }
  };
  const selectCamera = async (id: string, fromRoute = false): Promise<void> => {
    if (!id || (!fromRoute && id === s.cameraId)) return;
    s.selections += 1;
    api.endSession();
    const before = s.cameraId;
    s.cameraId = id;
    s.applied = id;
    if (before !== id) updated(before); // Lit: the assignment schedules an update whose `changed` holds the old value
    await loadRecordings();
  };
  /** `updated(changed)` with `cameraId` in `changed`. */
  function updated(old: string | undefined): void {
    if (old !== undefined && s.cameraId !== s.applied) void selectCamera(s.cameraId, true);
  }
  return { s, selectCamera, loadRecordings, routeTo: (id: string) => { const old = s.cameraId; s.cameraId = id; updated(old); } };
}

test('06:RACE-5: picking a camera selects it once - one endSession, one read of the day (it used to be two of each)', async () => {
  const calls = { end: 0, day: [] as string[] };
  const c = cameraLike({ createPlayback: () => undefined, endSession: () => void (calls.end += 1), day: async (id) => (calls.day.push(id), `rec:${id}`) });
  c.s.cameraId = 'cam1';
  c.s.applied = 'cam1';
  await c.selectCamera('cam2'); // the camera picker
  await tick();
  expect([c.s.selections, calls.end, calls.day]).toEqual([1, 1, ['cam2']]);
  c.routeTo('cam3'); // the address names another camera: this one IS a route change
  await tick();
  expect([c.s.selections, calls.end, calls.day, c.s.rec]).toEqual([2, 2, ['cam2', 'cam3'], 'rec:cam3']);
});

test('06:RACE-5: two cameras, reversed answers - the day shown is the selected camera\'s', async () => {
  const days: Record<string, ReturnType<typeof deferred<string>>> = { cam2: deferred(), cam3: deferred() };
  const c = cameraLike({ createPlayback: () => undefined, endSession: () => undefined, day: (id) => days[id].promise });
  c.s.cameraId = 'cam1';
  c.s.applied = 'cam1';
  const a = c.selectCamera('cam2');
  await tick();
  const b = c.selectCamera('cam3');
  await tick();
  days.cam3.resolve('rec:cam3');
  await b;
  expect([c.s.rec, c.s.loading]).toEqual(['rec:cam3', false]);
  days.cam2.resolve('rec:cam2'); // the camera that was left answers last
  await a;
  expect([c.s.cameraId, c.s.rec, c.s.loading]).toEqual(['cam3', 'rec:cam3', false]);
});

test('06:RACE-5: the playback screen\'s source - the applied camera is remembered in init and selectCamera and skipped in updated()', () => {
  const p = code('screens/investigate-playback.ts');
  expect(p).toMatch(/changed\.has\('cameraId'\) && changed\.get\('cameraId'\) !== undefined && this\.cams && this\.cameraId !== this\.appliedCamera\) \{\s*void this\.selectCamera\(this\.cameraId, true\);/);
  expect(p).toMatch(/this\.cameraId = first\.id;\s*this\.appliedCamera = first\.id;/);
  expect(p).toMatch(/this\.cameraId = id;\s*this\.appliedCamera = id;/);
  expect((p.match(/this\.appliedCamera = /g) ?? []).length).toBe(2);
  const load = p.slice(p.indexOf('private async loadRecordings() {'), p.indexOf('private get markers()'));
  expect(load).toMatch(/const current = this\.recReads\.begin\(\);\s*this\.loadingRec = true;/);
  expect(load).toMatch(/\]\);\s*if \(!current\(\)\) return;\s*this\.dayEvents = ev\.events;/);
  expect(load).toMatch(/catch \(err\) \{\s*if \(!current\(\)\) return;/);
  expect(load).toMatch(/finally \{\s*if \(current\(\)\) this\.loadingRec = false;/);
  // 06:PERF-1 in the same file: the three lists through the memo, one query for the master player, one transport read per render
  for (const slot of ["this.memo.get('markers', [dayEvents, tz]", "this.memo.get('bookmarks', [bookmarks, tz]", "this.memo.get('segments', [rec, tz]"]) expect(p, slot).toContain(slot);
  expect(p).toMatch(/private masterPlayer\(\): SwLivePlayer \| undefined \{\s*const players = this\.players\(\);\s*return players\.find\(\(p\) => p\.dataset\.camera === this\.cameraId\) \?\? players\[0\];/);
  expect((p.match(/this\.masterPlayer\(\)\?\.transport === 'mse'/g) ?? []).length).toBe(1);
});

// ---------------------------------------------------------------- 06:RACE-2 the history map's day

test('06:RACE-2: two dates, reversed answers - the events and recordings shown are the later date\'s', async () => {
  const reads = new Latest();
  const s = { date: '', events: [] as string[] };
  const answers: Record<string, ReturnType<typeof deferred<string[]>>> = { '2026-11-14': deferred(), '2026-11-15': deferred() };
  const loadDay = async (): Promise<void> => {
    const current = reads.begin();
    const ev = await answers[s.date].promise;
    if (!current()) return;
    s.events = ev;
  };
  s.date = '2026-11-14';
  const a = loadDay();
  s.date = '2026-11-15';
  const b = loadDay();
  answers['2026-11-15'].resolve(['the 15th']);
  await b;
  answers['2026-11-14'].resolve(['the 14th']); // the first date's answer arrives last
  await a;
  expect([s.date, s.events]).toEqual(['2026-11-15', ['the 15th']]);
  const h = code('screens/investigate-history-map.ts');
  const day = h.slice(h.indexOf('private async loadDay() {'), h.indexOf('private get instant()'));
  expect(day).toMatch(/const current = this\.dayReads\.begin\(\);\s*const \[ev, recs\] = await Promise\.all\(\[/);
  expect(day).toMatch(/\]\);\s*if \(!current\(\)\) return;\s*this\.events = ev;/);
  const init = h.slice(h.indexOf('private async init() {'), h.indexOf('private setPlanImage('));
  expect(init).toMatch(/const current = this\.initReads\.begin\(\);\s*this\.loading = true;/);
  expect((init.match(/if \(!current\(\)\) return;/g) ?? []).length).toBe(3); // after the settings, after the map, in the catch
  expect(init).toMatch(/const bundle = await loadMap\([^\n]*\);\s*if \(!current\(\)\) return;\s*this\.bundle = bundle;/);
  expect(init).toMatch(/finally \{\s*if \(current\(\)\) this\.loading = false;/);
});

// ---------------------------------------------------------------- 06:PLAY-2 the retry bound

test('06:PLAY-2: a lost session is tried again once, and only when there was a session to lose', () => {
  expect(retryLostSession('session_over', true, false)).toBe(true);
  expect(retryLostSession('not_found', true, false)).toBe(true);
  expect(retryLostSession('not_found', true, true)).toBe(false); // the second answer of the same kind is an error, not a loop
  expect(retryLostSession('not_found', false, false)).toBe(false); // a create that answers not_found: nothing to recover
  expect(retryLostSession('session_over', false, false)).toBe(false);
  expect(retryLostSession('no_recording', true, false)).toBe(false);
  expect(retryLostSession(undefined, true, false)).toBe(false);
  // the bound, counted: a server that always answers not_found is asked twice at most
  let asked = 0;
  const startAt = (hadSession: boolean, retried = false): string => {
    asked += 1;
    return retryLostSession('not_found', hadSession, retried) ? startAt(false, true) : 'error';
  };
  expect([startAt(true), asked]).toEqual(['error', 2]);
  asked = 0;
  expect([startAt(false), asked]).toEqual(['error', 1]);
  const p = code('screens/investigate-playback.ts');
  expect(p).toMatch(/const hadSession = !!\(this\.session \|\| this\.group\);/);
  expect(p).toMatch(/retryLostSession\(err\.body\.code, hadSession, !!opts\.retried\)\) \{\s*this\.session = null;\s*this\.group = null;\s*this\.busy = false;\s*return this\.startAt\(at, \{ \.\.\.opts, retried: true \}\);/);
  expect(p).not.toMatch(/return this\.startAt\(at, opts\);/);
});
