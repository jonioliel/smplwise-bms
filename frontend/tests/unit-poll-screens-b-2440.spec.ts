import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LiveEnv } from '../src/api/live-refresh';
import { Latest } from '../src/api/latest';
import { PollController } from '../src/components/poll-controller';

// CR-POLL-SCREENS-B-2440 (review D2 / 06:POLL-1 for the files AUDIT30 held, 06:LW-1, 06:ALARM-1; docs/changes/CR-POLL-SCREENS-B-2440.md).
// Node only: the shared poll with a fake clock, fake page events and a fake Lit host (the pattern of unit-poll-controller.spec.ts), the
// "newest read wins" guard (api/latest.ts) driven with answers that come back in the wrong order, and the seven screens' sources.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
  const env: Partial<LiveEnv> = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    online: () => state.online,
    onResume: (a) => {
      onResume = a;
      return () => {
        onResume = () => undefined;
      };
    },
  };
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const advance = async (ms: number) => {
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
  };
  return { env, state, advance, flush, resume: () => onResume(), pending: () => timers.size };
}

function fakeHost() {
  const controllers: { hostConnected?: () => void; hostDisconnected?: () => void }[] = [];
  const host = {
    isConnected: false,
    addController: (c: (typeof controllers)[number]) => void controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
    connect: () => {
      host.isConnected = true;
      controllers.forEach((c) => c.hostConnected?.());
    },
    disconnect: () => {
      host.isConnected = false;
      controllers.forEach((c) => c.hostDisconnected?.());
    },
  };
  return host;
}

/** A promise settled by hand: the answer of a request, in the order the test decides. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------- api/latest.ts

test('Latest: only the newest read is current; cancel makes every read in flight stale', () => {
  const reads = new Latest();
  const a = reads.begin();
  expect(a()).toBe(true);
  const b = reads.begin();
  expect([a(), b()]).toEqual([false, true]);
  reads.cancel();
  expect([a(), b()]).toEqual([false, false]);
  const c = reads.begin();
  expect(c()).toBe(true);
});

/** The alarm screen's load, as written in screens/security-alarm.ts (the source test below pins those lines). */
function alarmLike(fetch: () => Promise<string>) {
  const reads = new Latest();
  const s = { data: null as string | null, error: '', loading: false, reads };
  const load = async (quiet = false): Promise<void> => {
    const current = reads.begin();
    if (!quiet) s.loading = !s.data;
    try {
      const data = await fetch();
      if (!current()) return;
      s.data = data;
      s.error = '';
    } catch (err) {
      if (!current()) return;
      if (!quiet || !s.data) s.error = String(err);
    } finally {
      if (current()) s.loading = false;
    }
  };
  return { s, load };
}

test('06:ALARM-1: an older alarm answer that arrives after a newer read began is ignored - success and failure alike', async () => {
  const answers = [deferred<string>(), deferred<string>(), deferred<string>()];
  let n = 0;
  const { s, load } = alarmLike(() => answers[n++].promise);
  const first = load(); // the screen's first read
  expect(s.loading).toBe(true);
  const poll = load(true); // the 15 s poll starts while it is pending
  const afterCommand = load(true); // and the read after a command
  answers[2].resolve('armed'); // the newest answers first
  await afterCommand;
  expect([s.data, s.loading]).toEqual(['armed', false]);
  answers[0].resolve('disarmed (before the command)'); // the older ones arrive late
  answers[1].reject(new Error('timeout'));
  await Promise.all([first, poll]);
  expect([s.data, s.error, s.loading]).toEqual(['armed', '', false]);
});

test('06:ALARM-1: the newest read is always drawn, however late; a screen that left draws nothing', async () => {
  const answers = [deferred<string>(), deferred<string>()];
  let n = 0;
  const { s, load } = alarmLike(() => answers[n++].promise);
  const a = load();
  const b = load(true);
  answers[0].resolve('old');
  await a;
  expect(s.data).toBeNull(); // dropped: a newer read is pending
  answers[1].resolve('new');
  await b;
  expect(s.data).toBe('new');
  const late = deferred<string>();
  answers.push(late);
  const c = load(true);
  s.reads.cancel(); // disconnectedCallback
  late.resolve('after leaving');
  await c;
  expect(s.data).toBe('new');
});

test('06:ALARM-1: a rejected read of the action is handled - the chain of the screen ends in a catch and skips the reload once stopped', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => void unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    let reloads = 0;
    const follow = (action: Promise<unknown>, signal: { stopped: boolean }) =>
      void action.then(() => (signal.stopped ? undefined : void (reloads += 1))).catch(() => undefined); // the chain of send()
    follow(Promise.reject(new Error('getAction 503')), { stopped: false });
    follow(Promise.resolve('done'), { stopped: false });
    follow(Promise.resolve('done'), { stopped: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(unhandled).toEqual([]);
    expect(reloads).toBe(1);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  const a = code('screens/security-alarm.ts');
  expect(a).toMatch(/void awaitAction\(rec\.id, \(a\) => \{[\s\S]{0,200}\}, signal\)\s*\.then\(\(\) => \(signal\.stopped \? undefined : this\.load\(true\)\)\)\s*\.catch\(\(\) => undefined\);/);
  expect(a).toMatch(/if \(this\.actionSignal\) this\.actionSignal\.stopped = true;\s*const signal = \{ stopped: false \};\s*this\.actionSignal = signal;/);
});

test('06:ALARM-1: the alarm screen reads through the guard, polls through the shared poll and subscribes again when put back', () => {
  const a = code('screens/security-alarm.ts');
  const load = a.slice(a.indexOf('private async load(quiet = false)'), a.indexOf('private get panel()'));
  expect(load).toMatch(/const current = this\.reads\.begin\(\);/);
  expect(load).toMatch(/const data = isApi\(\) \? await alarmPanels\(\) : DEMO_ALARM;\s*if \(!current\(\)\) return;\s*this\.data = data;/);
  expect(load).toMatch(/catch \(err\) \{\s*if \(!current\(\)\) return;/);
  expect(load).toMatch(/finally \{\s*if \(current\(\)\) this\.loading = false;/);
  expect(a).toContain("this.poller.every('panels', 15_000, () => this.load(true));");
  const off = a.slice(a.indexOf('disconnectedCallback() {'), a.indexOf('protected willUpdate('));
  expect(off).toMatch(/this\.stopHa\?\.\(\);\s*this\.stopHa = undefined;/);
  expect(off).toContain("this.poller.cancel('panels');");
  expect(off).toContain('this.reads.cancel();');
  expect(off).toMatch(/if \(this\.actionSignal\) this\.actionSignal\.stopped = true;/);
  expect(a).not.toMatch(/setInterval\(/);
});

// ---------------------------------------------------------------- 06:LW-1 the wall

/** The wall's snapshot refresh as written in screens/live-wall.ts: armed on connect and again after the settings were read. */
function wallLike() {
  const fe = fakeEnv();
  const host = fakeHost();
  const poller = new PollController(host, { env: fe.env });
  const w = { snapBust: 0, ticks: 0, maxAge: 60 };
  const restartSnapTimer = (): void => {
    if (!host.isConnected) return;
    poller.every('snap', w.maxAge * 1000, () => {
      w.snapBust = fe.env.now!();
      w.ticks += 1;
    });
  };
  const load = async (answer: Promise<number>): Promise<void> => {
    const maxAge = await answer;
    if (!host.isConnected) return;
    w.maxAge = maxAge;
    restartSnapTimer();
  };
  return { ...fe, host, poller, w, restartSnapTimer, load };
}

test('06:LW-1: a wall that left the page while its read was pending arms no timer when the answer arrives', async () => {
  const x = wallLike();
  x.host.connect();
  x.restartSnapTimer();
  const answer = deferred<number>();
  const loading = x.load(answer.promise);
  x.host.disconnect();
  x.poller.cancel('snap');
  expect(x.pending()).toBe(0);
  answer.resolve(20);
  await loading;
  expect(x.pending()).toBe(0); // nothing armed for the detached wall
  expect(x.poller.has('snap')).toBe(false);
  await x.advance(10 * 60_000);
  expect(x.w.ticks).toBe(0);
  expect(x.w.maxAge).toBe(60); // and nothing of the late answer was kept
});

test('the wall on the page: the settings\' period replaces the first one, nothing ticks behind a hidden tab, one refresh on return', async () => {
  const x = wallLike();
  x.host.connect();
  x.restartSnapTimer();
  await x.load(Promise.resolve(20));
  await x.advance(60_000);
  expect(x.w.ticks).toBe(3); // every 20 s, not every 60 s
  x.state.visible = false;
  await x.advance(5 * 60_000);
  expect(x.w.ticks).toBe(3);
  x.state.visible = true;
  x.resume();
  await x.flush();
  await x.advance(1_000);
  expect(x.w.ticks).toBe(4);
});

test('06:LW-1: the wall\'s source - the guard sits right after the awaited read, both picture refreshes go through the shared poll', () => {
  const w = code('screens/live-wall.ts');
  const load = w.slice(w.indexOf('private async load() {'), w.indexOf('private async load() {') + 1400);
  expect(load).toMatch(/const \[list, settings\] = await Promise\.all\(\[listCameras\(\), productSettings\(\)\]\);\s*if \(!this\.isConnected\) return;/);
  expect(load.indexOf('if (!this.isConnected) return;')).toBeLessThan(load.indexOf('this.restartSnapTimer();'));
  expect(w).toMatch(/private restartSnapTimer\(\) \{\s*if \(!this\.isConnected\) return;\s*this\.poller\.every\('snap', snapshotRefreshMs\(/);
  expect(w).toContain("this.poller.every('poster', 60_000, () => {");
  expect(w).not.toMatch(/setInterval\(|snapTimer|posterTimer/);
});

// ---------------------------------------------------------------- D2: the five polls

test('D2: each screen polls through PollController with its own period; no bare server interval is left', () => {
  const sites: [string, RegExp][] = [
    // CR-W3-FE-COMBINED-2441: CR-DUP-METERS-2440 moved the poll of the electricity and the water meters pages into their shared base
    ['screens/meters-page-base.ts', /this\.poller\.every\('rows', POLL_MS, \(\) => this\.load\(false\)\);/],
    ['screens/water/page-alerts.ts', /this\.poller\.every\('rows', POLL_MS, \(\) => this\.load\(false\)\);/],
    ['screens/live-overview.ts', /this\.poller\.every\('overview', 60_000, \(\) => this\.load\(\)\);/],
    ['screens/investigate-exports.ts', /this\.poller\.every\('jobs', 3000, \(\) => this\.poll\(\)\);/],
  ];
  for (const [file, wired] of sites) {
    const s = code(file);
    expect(s, file).toMatch(/private poller = new PollController\(this\);/);
    expect(s, file).toMatch(wired);
    // the only plain interval left in these files is the overview's local header clock (no request)
    expect((s.match(/setInterval\(/g) ?? []).length, file).toBe(file === 'screens/live-overview.ts' ? 1 : 0);
  }
  for (const f of ['screens/electricity/page-meters.ts', 'screens/water/page-meters.ts']) expect(code(f), f).not.toMatch(/setInterval\(/);
  expect(code('screens/live-overview.ts')).toContain('this.clockTimer = window.setInterval(() => (this.now = new Date()), 30_000);');
});

test('D2: the exports list hands its read to the poll (no second read while one is pending) and keeps its two paces', async () => {
  const s = code('screens/investigate-exports.ts');
  const poll = s.slice(s.indexOf('private poll(): Promise<void> | undefined {'), s.indexOf('private range('));
  expect(poll).toMatch(/if \(this\.jobs\?\.some\(\(j\) => j\.state === 'queued' \|\| j\.state === 'running'\)\) return this\.load\(\);/);
  expect(poll).toMatch(/j\.state === 'paused_disk_full'\) && Date\.now\(\) - this\.pausedPolledAt >= 30_000\) \{\s*this\.pausedPolledAt = Date\.now\(\);\s*return this\.load\(\);/);
  // the same shape under the fake clock: a slow read is never overtaken by the next tick
  const fe = fakeEnv();
  const host = fakeHost();
  const poller = new PollController(host, { env: fe.env });
  host.connect();
  let started = 0;
  let slow = deferred<void>();
  poller.every('jobs', 3000, () => {
    started += 1;
    return slow.promise;
  });
  await fe.advance(3000);
  expect(started).toBe(1);
  await fe.advance(30_000); // the answer is still out
  expect(started).toBe(1);
  slow.resolve();
  slow = deferred<void>();
  await fe.flush();
  await fe.advance(3000);
  expect(started).toBe(2);
  host.disconnect();
  slow.resolve();
  await fe.flush();
  await fe.advance(60_000);
  expect(started).toBe(2);
});
