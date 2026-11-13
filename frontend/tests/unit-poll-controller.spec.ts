import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MIN_GAP_MS, MAX_BACKOFF_MS, type LiveEnv } from '../src/api/live-refresh';
import { PollController } from '../src/components/poll-controller';

// CR-POLL-SCREENS-A-2436 (review D2 / 06:POLL-1): the shared Lit polling controller (components/poll-controller.ts) on top of
// api/live-refresh.ts, and the six screens moved onto it. A fake clock + fake page events + a fake Lit host; node only.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
  let onOnline: () => void = () => undefined;
  let registered = 0;
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
    onResume: (a, b) => {
      onResume = a;
      onOnline = b;
      registered++;
      return () => {
        registered--;
        onResume = onOnline = () => undefined;
      };
    },
  };
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
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
  return { env, state, advance, flush, resume: () => onResume(), online: () => onOnline(), pending: () => timers.size, listeners: () => registered };
}

/** The part of a Lit element a ReactiveController sees. */
function fakeHost() {
  const controllers: { hostConnected?: () => void; hostDisconnected?: () => void }[] = [];
  return {
    addController: (c: (typeof controllers)[number]) => void controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
  };
}

function setup(opts: { jitter?: boolean; random?: () => number } = {}) {
  const fe = fakeEnv();
  const host = fakeHost();
  const env = opts.random ? { ...fe.env, random: opts.random } : fe.env;
  const poll = new PollController(host, { env, jitter: opts.jitter });
  return { ...fe, host, poll };
}

/** A read that stays pending until `release()`. */
function slowRead(calls: string[], id: string) {
  let release: () => void = () => undefined;
  const run = () => {
    calls.push(id);
    return new Promise<void>((r) => (release = r));
  };
  return { run, release: () => release() };
}

test.describe('PollController (components/poll-controller.ts)', () => {
  test('registers with its host: connect starts listening, disconnect stops every timer and listener', async () => {
    const t = setup();
    const calls: string[] = [];
    t.poll.every('a', 10_000, () => void calls.push('a'));
    expect(t.listeners()).toBe(0);
    expect(t.pending()).toBe(0); // not connected: nothing armed
    t.host.connect();
    expect(t.listeners()).toBe(1);
    await t.advance(10_000);
    expect(calls).toEqual(['a']);
    t.host.disconnect();
    expect(t.listeners()).toBe(0);
    expect(t.pending()).toBe(0);
    await t.advance(60_000);
    expect(calls).toEqual(['a']);
    t.host.connect(); // attached again: the registration polls again
    await t.advance(10_000);
    expect(calls).toEqual(['a', 'a']);
  });

  test('the period is exact by default; jitter only when asked for', async () => {
    const t = setup({ random: () => 1 }); // a random source at its extreme: ignored without `jitter`
    const calls: number[] = [];
    t.host.connect();
    t.poll.every('a', 15_000, () => void calls.push(t.env.now!()));
    await t.advance(45_000);
    expect(calls.map((c) => c - 1_000_000)).toEqual([15_000, 30_000, 45_000]);

    const j = setup({ jitter: true, random: () => 1 }); // +10 %
    const jc: number[] = [];
    j.host.connect();
    j.poll.every('a', 10_000, () => void jc.push(j.env.now!()));
    await j.advance(11_000);
    expect(jc.map((c) => c - 1_000_000)).toEqual([11_000]);
  });

  test('no request while hidden; exactly one on resume', async () => {
    const t = setup();
    const calls: string[] = [];
    t.host.connect();
    t.poll.every('a', 10_000, () => void calls.push('a'));
    t.state.visible = false;
    await t.advance(60_000);
    expect(calls).toEqual([]);
    t.state.visible = true;
    t.resume();
    t.resume(); // focus + visibilitychange pair: one read
    await t.flush();
    expect(calls).toEqual(['a']);
  });

  test('no overlap: a slow read is never doubled; the next tick is a full period after it finished', async () => {
    const t = setup();
    const calls: string[] = [];
    const s = slowRead(calls, 'a');
    t.host.connect();
    t.poll.every('a', 5_000, s.run);
    await t.advance(5_000);
    expect(calls).toEqual(['a']);
    await t.advance(30_000); // still pending
    t.resume();
    t.poll.now('a');
    await t.flush();
    expect(calls).toEqual(['a']);
    s.release();
    await t.flush();
    await t.advance(4_999);
    expect(calls).toEqual(['a']);
    await t.advance(1);
    expect(calls).toEqual(['a', 'a']);
  });

  test('`when` false skips the tick and is asked again next period', async () => {
    const t = setup();
    const calls: string[] = [];
    let on = false;
    t.host.connect();
    t.poll.every('a', 10_000, () => void calls.push('a'), { when: () => on });
    await t.advance(30_000);
    expect(calls).toEqual([]);
    on = true;
    await t.advance(10_000);
    expect(calls).toEqual(['a']);
  });

  test('every() with the same id replaces it (the clearInterval + setInterval idiom) and restarts the period', async () => {
    const t = setup();
    const calls: string[] = [];
    t.host.connect();
    t.poll.every('a', 10_000, () => void calls.push('old'));
    await t.advance(6_000);
    t.poll.every('a', 10_000, () => void calls.push('new'));
    await t.advance(6_000);
    expect(calls).toEqual([]);
    await t.advance(4_000);
    expect(calls).toEqual(['new']);
    expect(t.pending()).toBe(1);
  });

  test('cancel() stops a poll, also from inside its own read, and leaves no timer behind', async () => {
    const t = setup();
    const calls: string[] = [];
    t.host.connect();
    let n = 0;
    t.poll.every('a', 3_000, async () => {
      calls.push('a');
      if (++n === 2) t.poll.cancel('a');
    });
    await t.advance(30_000);
    expect(calls).toEqual(['a', 'a']);
    expect(t.poll.has('a')).toBe(false);
    expect(t.pending()).toBe(0);
    t.resume();
    await t.flush();
    expect(calls).toEqual(['a', 'a']);
  });

  test('replaced while its read is pending: the old one never runs again, the new one polls alone', async () => {
    const t = setup();
    const calls: string[] = [];
    const s = slowRead(calls, 'old');
    t.host.connect();
    t.poll.every('a', 5_000, s.run);
    await t.advance(5_000);
    t.poll.every('a', 5_000, () => void calls.push('new'));
    s.release();
    await t.advance(20_000);
    expect(calls).toEqual(['old', 'new', 'new', 'new', 'new']);
    expect(t.pending()).toBe(1);
  });

  test('fresh (default): a resume right after every() does not repeat the host\'s own read; fresh:false does', async () => {
    const t = setup();
    const calls: string[] = [];
    t.host.connect();
    t.poll.every('a', 30_000, () => void calls.push('a'));
    t.poll.every('b', 30_000, () => void calls.push('b'), { fresh: false });
    t.resume();
    await t.flush();
    expect(calls).toEqual(['b']);
    await t.advance(MIN_GAP_MS);
    t.resume();
    await t.advance(1_000);
    expect(calls.filter((c) => c === 'a')).toHaveLength(1); // older than MIN_GAP_MS now: the resume reads it
  });

  test('a read that resolves false or throws backs off; one that resolves anything else keeps the period', async () => {
    const t = setup();
    const calls: string[] = [];
    t.host.connect();
    t.poll.every('bad', 10_000, () => {
      calls.push('bad');
      throw new Error('x');
    });
    t.poll.every('ok', 10_000, () => void calls.push('ok'));
    await t.advance(10_000); // both
    await t.advance(10_000); // ok only (bad waits 20 s)
    await t.advance(10_000); // both
    expect(calls.filter((c) => c === 'ok')).toHaveLength(3);
    expect(calls.filter((c) => c === 'bad')).toHaveLength(2);
    expect(MAX_BACKOFF_MS).toBe(300_000);
  });
});

// ------------------------------------------------------------------------------------------------ the migrated screen families

/**
 * Each family's poll as the screen registers it (period, predicate). The source checks below pin the screens to these registrations;
 * the behaviour checks run the same registrations through the controller: no request while hidden, one on resume, no overlap.
 */
const FAMILIES: { file: string; ids: string[]; periods: Record<string, number>; when?: boolean; setIntervalLeft: number }[] = [
  { file: 'screens/door-windows.ts', ids: ['state', 'emergency'], periods: { state: 15_000, emergency: 5_000 }, setIntervalLeft: 0 },
  { file: 'screens/system-wall.ts', ids: ['profiles'], periods: { profiles: 15_000 }, when: true, setIntervalLeft: 0 },
  { file: 'screens/system-transit.ts', ids: ['catalogue'], periods: { catalogue: 3_000 }, setIntervalLeft: 0 },
  { file: 'screens/devices-synoptic.ts', ids: ['board'], periods: { board: 30_000 }, setIntervalLeft: 1 }, // the 15 s clock makes no request
  { file: 'screens/messaging-policy-card.ts', ids: ['window'], periods: { window: 30_000 }, when: true, setIntervalLeft: 0 },
  { file: 'screens/wiskey-events.ts', ids: ['notices'], periods: { notices: 30_000 }, setIntervalLeft: 0 },
];

test.describe('screens polled through PollController', () => {
  for (const f of FAMILIES) {
    test(`${f.file}: wired to PollController, no bare server interval left`, () => {
      const s = src(f.file);
      expect(s).toMatch(/import \{ PollController \} from '\.\.\/components\/poll-controller';/);
      expect(s).toMatch(/new PollController\(this\)/);
      for (const id of f.ids) expect(s).toContain(`every('${id}'`);
      expect((s.match(/setInterval\(/g) ?? []).length).toBe(f.setIntervalLeft);
      if (f.when) expect(s).toMatch(/\{ when: \(\) =>/);
    });

    test(`${f.file}: no request while hidden, one per source on resume, no overlap`, async () => {
      const t = setup();
      const calls: string[] = [];
      const slow = new Map<string, ReturnType<typeof slowRead>>();
      t.host.connect();
      for (const id of f.ids) {
        const s = slowRead(calls, id);
        slow.set(id, s);
        t.poll.every(id, f.periods[id], s.run, f.when ? { when: () => true } : {});
      }
      const longest = Math.max(...Object.values(f.periods));
      t.state.visible = false;
      await t.advance(longest * 3);
      expect(calls).toEqual([]);
      t.state.visible = true;
      t.resume();
      await t.advance(1_000); // the staggered resume runs (300 ms apart)
      expect([...calls].sort()).toEqual([...f.ids].sort());
      // every read still pending: however long it takes, no second one starts
      await t.advance(longest * 4);
      t.resume();
      await t.flush();
      expect([...calls].sort()).toEqual([...f.ids].sort());
      for (const s of slow.values()) s.release();
      await t.flush();
      await t.advance(longest);
      expect(calls.length).toBeGreaterThan(f.ids.length);
    });
  }

  test('system-wall: no poll while a profile is being edited or added', () => {
    expect(src('screens/system-wall.ts')).toMatch(/every\('profiles', POLL_MS, \(\) => this\.load\(true\), \{ when: \(\) => !this\.editing && !this\.adding \}\)/);
  });

  test('messaging-policy-card: polls only while a self-messages window is open', () => {
    expect(src('screens/messaging-policy-card.ts')).toMatch(/every\('window', 30_000, \(\) => this\.refreshWindow\(\), \{ when: \(\) => !!this\.view\?\.self_messages\.active \}\)/);
  });

  test('system-transit: the catalogue poll stops itself once the refresh is done, and on detach', () => {
    const s = src('screens/system-transit.ts');
    expect(s).toMatch(/every\('catalogue', 3000,/);
    expect((s.match(/this\.poll\.cancel\('catalogue'\)/g) ?? []).length).toBe(2);
  });

  test('wiskey-events: polls only while the change notices are down', () => {
    const s = src('screens/wiskey-events.ts');
    expect(s).toMatch(/if \(on\) this\.poll\.every\('notices', POLL_MS, \(\) => this\.onChangeNotice\(\)\);\s*else this\.poll\.cancel\('notices'\);/);
  });

  test('door-windows: both polls only with a live backend', () => {
    const s = src('screens/door-windows.ts');
    expect(s).toMatch(/if \(!isApi\(\)\) return;\s*void this\.load\(\);\s*this\.poll\.every\('state', POLL_MS, \(\) => this\.load\(\)\);\s*this\.poll\.every\('emergency', EM_POLL_MS, \(\) => this\.loadEmergency\(\)\);/);
  });
});
