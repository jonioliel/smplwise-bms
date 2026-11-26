import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { IncomingCall } from '../src/api/intercom-calls';
import { Latest } from '../src/api/latest';
import { SeekCoalescer } from '../src/api/seek-coalescer';

// STALE-ANSWERS-2540 (review DEEP-REVIEW-2520-FRONTEND-SCREENS: SCR-11, SCR-14, SCR-19, SCR-24, SCR-28, SCR-32, SCR-33, SCR-35, SCR-39;
// docs/changes/STALE-ANSWERS-2540.md). Node only: the banner's front-call rule, the "newest read wins" guard (api/latest.ts, reused)
// and the seek coalescer (api/seek-coalescer.ts, reused) driven with answers in the wrong order, and the nine screens' sources.
// The same races are driven against the real screens with a mocked backend in tests/evidence-stale-answers-2540.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-stale-answers-2540.spec.ts

const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const between = (s: string, a: string, b: string) => {
  const i = s.indexOf(a);
  expect(i, a).toBeGreaterThanOrEqual(0);
  const j = s.indexOf(b, i + a.length);
  return s.slice(i, j < 0 ? undefined : j);
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
const tick = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function call(id: string, rangAt: string): IncomingCall {
  return {
    call_id: id, station_id: id, station_name: id, state: 'ringing', rang_at: rangAt, answered_at: null, answered_by_me: false,
    elapsed_s: 5, online: true, has_camera: true, still: true, can_open_door: true, locks: [{ physical_index: 1, name: 'שער' }],
  };
}

// ---------------------------------------------------------------- SCR-11 the banner's front call

test('SCR-11: the call in front is kept by id - a newer ringing call goes behind it; "next" and a call that left move the front', async () => {
  const logic = await import('../src/components/incoming-call-logic');
  expect(typeof logic.frontCall, 'frontCall is exported').toBe('function');
  const { frontCall, nextCall, visibleCalls } = logic;
  const a = call('A', '2026-11-26T08:00:00.000Z');
  const b = call('B', '2026-11-26T08:00:30.000Z');
  const c = call('C', '2026-11-26T08:01:00.000Z');
  const shownA = visibleCalls({ enabled: true, mode: 'everyone', feed: 'ready', sound: 'ring', sound_reason: null, server_time_ms: 0, calls: [a] }, new Set(), null);
  expect(frontCall(shownA, null)?.call_id).toBe('A'); // nothing pinned yet: the first shown call
  // B rings while A is shown: the list puts B first (newest first) - the front stays A
  const shownAB = visibleCalls({ enabled: true, mode: 'everyone', feed: 'ready', sound: 'ring', sound_reason: null, server_time_ms: 0, calls: [a, b] }, new Set(), null);
  expect(shownAB.map((x) => x.call_id)).toEqual(['B', 'A']);
  expect(frontCall(shownAB, 'A')?.call_id).toBe('A');
  // "next" walks the list from the front call, round
  expect(nextCall(shownAB, 'A')?.call_id).toBe('B');
  expect(nextCall(shownAB, 'B')?.call_id).toBe('A');
  expect(nextCall([b, a, c], 'C')?.call_id).toBe('B');
  // the front call left the list (ended / hidden / its drawer took it): the first shown call comes forward
  expect(frontCall([b, c], 'A')?.call_id).toBe('B');
  expect(frontCall([], 'A')).toBeUndefined();
  expect(nextCall([], 'A')).toBeUndefined();
});

test('SCR-11: the banner and the home call screen draw the front call by id; the door question is dropped when the front call changes', () => {
  const s = code('components/sw-incoming-call.ts');
  expect(s).not.toMatch(/\bthis\.front\b/);
  expect(s).toMatch(/@state\(\) protected frontId: string \| null = null;/);
  expect(s).toMatch(/const c = this\.frontOf\(shown\) \?\? shown\[0\];/);
  expect(s).toMatch(/protected pinFront\(shown: readonly IncomingCall\[\], next\?: IncomingCall\): void \{\s*const id = \(next \?\? this\.frontOf\(shown\)\)\?\.call_id \?\? null;\s*if \(id !== this\.frontId\) this\.frontId = id;\s*if \(this\.doorAsk && !this\.doorAsk\.startsWith\(`\$\{id\}\/`\)\) this\.doorAsk = null;/);
  expect(between(s, 'protected sync(): void {', 'protected frontOf(')).toContain('this.pinFront(shown);');
  expect(s).toContain('@click=${() => this.pinFront(shown, nextCall(shown, c.call_id))}');
  // the door buttons are held only by a door question of the call they belong to
  expect(s).toContain('?disabled=${sending || !!this.doorAsk?.startsWith(`${c.call_id}/`)}');
  const home = code('home/sw-home-call.ts');
  expect(home).not.toMatch(/\bthis\.front\b/);
  expect(home).toContain('const c = this.frontOf(shown) ?? shown[0];');
});

// ---------------------------------------------------------------- the shared guard, reused

test('the shared guard (api/latest.ts): with two reads answered in the wrong order the newest one is applied, the older one dropped', async () => {
  const reads = new Latest();
  const shown: string[] = [];
  const answers = { A: deferred<string>(), B: deferred<string>() };
  const load = async (k: 'A' | 'B') => {
    const current = reads.begin();
    const v = await answers[k].promise;
    if (current()) shown.push(v);
  };
  const a = load('A');
  const b = load('B');
  answers.B.resolve('B');
  await b;
  answers.A.resolve('A');
  await a;
  expect(shown).toEqual(['B']);
  // cancel(): every read in flight is stale (the screen left / the sheet closed)
  const c = deferred<string>();
  const current = reads.begin();
  reads.cancel();
  c.resolve('C');
  await c.promise;
  expect(current()).toBe(false);
});

// ---------------------------------------------------------------- SCR-14 NVR system card

test('SCR-14: the NVR system card reads the recorder it names and drops an answer for a recorder that is no longer selected', () => {
  const s = code('screens/system-setup.ts');
  expect(s).toContain("import { Latest } from '../api/latest';");
  const load = between(s, 'private async loadSystem() {', 'private async sysAction(');
  expect(load).toMatch(/const current = this\.sysReads\.begin\(\);/);
  expect(load).toMatch(/const recorder = this\.sysRecorder;\s*try \{\s*const sys = await nvrSystemApi\(recorder\)\.nvrSystem\(\);\s*if \(!current\(\) \|\| recorder !== this\.sysRecorder\) return;\s*this\.sys = sys;/);
  expect(load).toMatch(/catch \(err\) \{\s*if \(!current\(\) \|\| recorder !== this\.sysRecorder\) return;\s*this\.sysError = describeError\(err\);/);
  expect(load).not.toContain('this.sys = await');
  // switching the recorder clears the card and its error before the new read
  expect(s).toContain("this.sysRecorder = (e.target as HTMLSelectElement).value; this.sys = null; this.sysError = ''; this.sysMsg = ''; void this.loadSystem();");
});

// ---------------------------------------------------------------- SCR-19 bulk dialog

test('SCR-19: the bulk dialog applies a run only while it is still the dialog\'s run; close while running and a new request make it stale', () => {
  const s = code('screens/devices-bulk.ts');
  expect(s).toContain("import { Latest } from '../api/latest';");
  expect(s).toMatch(/private runs = new Latest\(\);/);
  const show = between(s, 'async show(ask: BulkRequest) {', 'get running()');
  expect(show).toMatch(/this\.runs\.cancel\(\);[^\n]*\n\s*this\.req = req;/);
  const close = between(s, 'private close = () => {', 'private async confirm()');
  expect(close).toMatch(/if \(this\.phase === 'running'\) this\.runs\.cancel\(\);/);
  const confirm = between(s, 'private async confirm() {', 'disconnectedCallback()');
  expect(confirm).toMatch(/this\.phase = 'sending';\s*const current = this\.runs\.begin\(\);/);
  expect(confirm).toMatch(/followBulk\(first, \(r\) => \{ if \(current\(\)\) this\.record = r; \}, follow\)/);
  expect(confirm).toMatch(/if \(!current\(\)\) \{\s*this\.dispatchEvent\(new CustomEvent\('bulk-done', \{ detail: done[^\n]*\n\s*return;\s*\}\s*this\.record = done;\s*this\.phase = 'result';/);
  expect(confirm).toMatch(/catch \(err\) \{\s*if \(!current\(\)\) \{\s*this\.dispatchEvent\(new CustomEvent\('bulk-done', \{ detail: null[^\n]*\n\s*return;/);
  // a run left behind keeps following (the screen still reloads when it ends); every follow stops when the dialog leaves the page
  expect(between(s, 'private async confirm() {', 'protected updated(')).toMatch(/disconnectedCallback\(\) \{\s*super\.disconnectedCallback\(\);\s*for \(const f of this\.follows\) f\.stopped = true;/);
});

// ---------------------------------------------------------------- SCR-24 playback picker

test('SCR-24: the playback camera and day picks - a pick overtaken while it waits for the session to close applies nothing', () => {
  const s = code('screens/investigate-playback.ts');
  const cam = between(s, 'private async selectCamera(id: string, fromRoute = false) {', 'private monthLoaderFor');
  expect(cam).toMatch(/const current = this\.cameraPicks\.begin\(\);\s*if \(!id \|\| \(!fromRoute && id === this\.cameraId\)\) return;\s*this\.clearStall\(\);\s*await this\.endSession\(\);\s*if \(!current\(\)\) return;\s*this\.frames\.dispose\(\);\s*this\.cameraId = id;/);
  const day = between(s, 'private async setDate(date: string) {', 'private insideLast(');
  expect(day).toMatch(/const current = this\.datePicks\.begin\(\);\s*if \(!date \|\| date === this\.date\) return;\s*this\.clearStall\(\);\s*await this\.endSession\(\);\s*if \(!current\(\)\) return;\s*this\.date = date;/);
  expect(day).toMatch(/await this\.loadRecordings\(\);\s*if \(!current\(\)\) return;\s*const last = /);
  expect(between(s, 'disconnectedCallback() {', 'void this.endSession();')).toMatch(/this\.cameraPicks\.cancel\(\);[^\n]*\n\s*this\.datePicks\.cancel\(\);/);
});

/** The camera pick as written in screens/investigate-playback.ts (pinned above): wait for the old session to close, then apply. */
function pickLike(close: () => Promise<void>) {
  const picks = new Latest();
  const s = { cameraId: 'X', loads: [] as string[] };
  const selectCamera = async (id: string) => {
    const current = picks.begin();
    if (!id || id === s.cameraId) return;
    await close();
    if (!current()) return;
    s.cameraId = id;
    s.loads.push(id);
  };
  return { s, selectCamera };
}

test('SCR-24: X playing, pick A (its close is slow), pick B - B stays selected when A\'s close returns last; A -> B -> A drops B', async () => {
  const slow = deferred<void>();
  let first = true;
  const p = pickLike(() => (first ? ((first = false), slow.promise) : Promise.resolve()));
  const a = p.selectCamera('A');
  await tick();
  const b = p.selectCamera('B');
  await b;
  expect(p.s.cameraId).toBe('B');
  slow.resolve();
  await a;
  expect([p.s.cameraId, p.s.loads]).toEqual(['B', ['B']]);
  // back to the camera that is still selected while a pick waits: the waiting pick is dropped
  const slow2 = deferred<void>();
  const q = pickLike(() => slow2.promise);
  const toA = q.selectCamera('A');
  await tick();
  await q.selectCamera('X');
  slow2.resolve();
  await toA;
  expect([q.s.cameraId, q.s.loads]).toEqual(['X', []]);
});

// ---------------------------------------------------------------- SCR-28 home recordings

/** The home recordings' play / seek as written in home/home-recordings.ts (pinned below): one request at a time through the coalescer. */
function homePlayLike() {
  const st = { session: null as string | null, creates: 0, seeks: [] as number[], inFlight: 0, maxInFlight: 0 };
  const answers: { d: ReturnType<typeof deferred<string>>; kind: 'create' | 'seek'; minute: number }[] = [];
  const runPlay = async (minute: number) => {
    st.inFlight += 1;
    st.maxInFlight = Math.max(st.maxInFlight, st.inFlight);
    const d = deferred<string>();
    if (st.session) {
      st.seeks.push(minute);
      answers.push({ d, kind: 'seek', minute });
    } else {
      st.creates += 1;
      answers.push({ d, kind: 'create', minute });
    }
    try {
      st.session = await d.promise;
    } finally {
      st.inFlight -= 1;
    }
  };
  const seeker = new SeekCoalescer<number>((m) => runPlay(m), { delayMs: 0 });
  const playAt = (m: number) => {
    seeker.request(m);
    seeker.flush();
  };
  return { st, answers, playAt };
}

test('SCR-28: a double tap on play with no session opens ONE session; the second tap seeks it once it is open', async () => {
  const p = homePlayLike();
  p.playAt(600);
  p.playAt(600);
  await tick();
  expect([p.st.creates, p.st.seeks]).toEqual([1, []]);
  p.answers[0].d.resolve('pb1');
  await tick();
  expect([p.st.creates, p.st.seeks, p.st.session]).toEqual([1, [600], 'pb1']);
  p.answers[1].d.resolve('pb1');
  await tick();
  expect(p.st.maxInFlight).toBe(1);
});

test('SCR-28: three quick "+10 s" - never two seeks at once, and the last position asked for is the last one sent', async () => {
  const p = homePlayLike();
  p.playAt(600);
  await tick();
  p.answers[0].d.resolve('pb1');
  await tick();
  p.playAt(600 + 10 / 60);
  p.playAt(600 + 20 / 60);
  p.playAt(600 + 30 / 60);
  await tick();
  expect(p.st.seeks).toEqual([600 + 10 / 60]); // the first one is on its way; +20 was replaced by +30 while it waited
  p.answers[1].d.resolve('pb1');
  await tick();
  expect(p.st.seeks).toEqual([600 + 10 / 60, 600 + 30 / 60]);
  p.answers[2].d.resolve('pb1');
  await tick();
  expect(p.st.maxInFlight).toBe(1);
});

test('SCR-28: home recordings sends play / seek through the coalescer with no debounce, and stop() drops a waiting request', () => {
  const s = code('home/home-recordings.ts');
  expect(s).toContain("import { SeekCoalescer } from '../api/seek-coalescer';");
  expect(s).toMatch(/const seeker = new SeekCoalescer<\{ h: HomeHost; minute: number \}>\(\(v\) => runPlay\(v\.h, v\.minute\), \{ delayMs: 0 \}\);/);
  const play = between(s, 'function playAt(h: HomeHost, minute: number) {', 'async function runPlay(');
  expect(play).toMatch(/seeker\.request\(\{ h, minute: st\.t \}\);\s*seeker\.flush\(\);/);
  expect(play).not.toMatch(/createPlayback|seekPlayback/);
  const run = between(s, 'async function runPlay(h: HomeHost, minute: number) {', 'function setCam(');
  expect(run).toMatch(/const got = st\.session \? await seekPlayback\(st\.session\.id, at\) : await createPlayback\(st\.cam, at\);/);
  expect(between(s, 'async function stop(h: HomeHost) {', 'async function loadDay(')).toMatch(/gen\+\+;\s*seeker\.cancel\(\);/);
  expect(s).not.toMatch(/void playAt\(/);
});

// ---------------------------------------------------------------- SCR-32 home bill

test('SCR-32: the home bill clears another account\'s money on a switch and drops an answer for an account no longer selected', () => {
  const s = code('home/home-p3.ts');
  expect(s).toContain("import { Latest } from '../api/latest';");
  const load = between(s, 'async loadBill(acc: string): Promise<void> {', 'private async loadWater()');
  expect(load).toMatch(/const current = this\.billReads\.begin\(\);/);
  expect(load).toMatch(/const other = this\.bill\.acc !== acc;\s*this\.bill = \{ \.\.\.this\.bill, acc, loading: true, error: '', \.\.\.\(other \? \{ status: null, periods: \[\] \} : \{\}\) \};/);
  expect((load.match(/if \(!current\(\) \|\| !this\.bill \|\| this\.bill\.acc !== acc\) return;/g) ?? []).length).toBe(2);
});

// ---------------------------------------------------------------- SCR-33 home scene edit

test('SCR-33: the scene sheet applies a detail, a save and a delete only to the sheet they started from', () => {
  const s = code('home/home-scene-2500.ts');
  expect(s).toContain("import { Latest } from '../api/latest';");
  const edit = between(s, 'scEdit: (el) => {', 'scEditNow:');
  expect(edit).toMatch(/const open = opens\.begin\(\);\s*const id = ed\.id;\s*void httpAutomations\.get\('scene', id\)\.then\(\(d\) => \{\s*if \(!open\(\) \|\| ed\.id !== id\) return;/);
  expect(edit).toMatch(/\.catch\(\(err\) => \{ if \(open\(\)\) fail\(h, err\); \}\)/);
  const save = between(s, 'scEditSave: () => {', 'scDelAsk:');
  expect(save).toMatch(/const id = ed\.id;/);
  expect(save).toContain("httpAutomations.replace('scene', id, {");
  expect(save).not.toContain("httpAutomations.replace('scene', ed.id");
  expect(save).toMatch(/if \(sheetOpen\(h, open\)\) h\.ovl = null;/);
  const del = between(s, 'scDelYes: () => {', '\n  },\n}));');
  expect(del).toMatch(/const open = opens\.begin\(\);/);
  expect(del).toMatch(/if \(sheetOpen\(h, open\)\) h\.ovl = null;/);
});

// ---------------------------------------------------------------- SCR-35 resident day

test('SCR-35: the resident room list draws only the newest day\'s answer', () => {
  const s = code('calendars/resident.ts');
  expect(s).toContain("import { Latest } from '../api/latest';");
  const load = between(s, 'private async loadDay(): Promise<void> {', 'private async loadMine()');
  expect(load).toMatch(/const current = this\.dayReads\.begin\(\);/);
  expect(load).toMatch(/const r = await this\.ctx\.api\.roomsDay\(isoDate\(this\.day\)\);\s*if \(!current\(\)\) return;\s*this\.rooms = r\.rooms;/);
  expect(load).toMatch(/catch \(e\) \{\s*if \(!current\(\)\) return;\s*this\.error = describeError\(e\);/);
});

// ---------------------------------------------------------------- SCR-39 home ticket note

test('SCR-39: "send note" returns while a note is on its way and redraws the disabled button at once', () => {
  const s = code('home/home-tickets.ts');
  const send = between(s, 'p2TkNoteSend: (el) => {', '\n  },\n}));');
  expect(send).toMatch(/^p2TkNoteSend: \(el\) => \{\s*if \(st\.busy\) return;/);
  expect(send).toMatch(/st\.busy = true;\s*h\.requestUpdate\(\);\s*void ticketNote/);
});
