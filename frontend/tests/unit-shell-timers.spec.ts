import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import type { LiveEnv } from '../src/api/live-refresh';
import { PollController } from '../src/components/poll-controller';
import { DD_IDLE_CHECK_MS, DD_SETTLE_PASSES, DD_TICK_MS, FitScheduler, type FitEnv, type FitPass } from '../src/shell/header-fit';

// CR-SHELL-TIMERS-2439 (review 07:F14, 07:F24): the shell's two timers and the component polls.
//  - the system-status poll (summary + alert counts, 60 s) goes through PollController: nothing while hidden, one read on return;
//  - the header fit (was sw-app.ts fitDd every 1.2 s for the life of the page) lives in shell/header-fit.ts: measured after every render,
//    on a size change and on the 1.2 s tick only until the row is settled, then a slow re-check; nothing while hidden;
//  - the component timers that request something poll through PollController; the local clocks stay plain timers (no request).
// Node only: fake clocks, fake page events, a fake Lit host; the elements' wiring is checked in the source.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/** A fake clock + visibility for FitScheduler. */
function fitEnv() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true };
  let onVisible: () => void = () => undefined;
  let listeners = 0;
  const env: FitEnv = {
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    onVisible: (fn) => {
      onVisible = fn;
      listeners++;
      return () => {
        listeners--;
        onVisible = () => undefined;
      };
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = end;
  };
  return { env, state, advance, show: () => onVisible(), pending: () => timers.size, listeners: () => listeners, now: () => now };
}

/** A header whose measurement answers what the test says; counts the passes and when they ran. */
function header(first: FitPass[] = [], then: FitPass = 'clear') {
  const answers = [...first];
  const at: number[] = [];
  let fitted = true;
  return {
    answers,
    at,
    setFitted: (v: boolean) => (fitted = v),
    fitted: () => fitted,
    pass: (now: () => number) => () => {
      at.push(now());
      return answers.length ? answers.shift()! : then;
    },
  };
}

test.describe('header fit timing (shell/header-fit.ts FitScheduler)', () => {
  test('measures every 1.2 s until settled, then only every 6 s (was: every 1.2 s for the life of the page)', () => {
    const f = fitEnv();
    const h = header();
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.advance(DD_TICK_MS * DD_SETTLE_PASSES);
    expect(h.at).toEqual([1200, 2400, 3600, 4800]);
    expect(s.idle()).toBe(true);
    f.advance(DD_IDLE_CHECK_MS * 3);
    expect(h.at.slice(4)).toEqual([10_800, 16_800, 22_800]);
    // the old tick would have measured 19 times by now
    expect(h.at.length).toBe(7);
    s.stop();
  });

  test('a pending pass (a collision being timed, a title being waited for) keeps the 1.2 s tick; so does a row not yet fitted', () => {
    const f = fitEnv();
    const h = header(['pending', 'pending', 'pending']);
    h.setFitted(false);
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.advance(DD_TICK_MS * 8);
    expect(h.at.length).toBe(8); // never settles while the row is not fitted
    h.setFitted(true);
    f.advance(DD_TICK_MS * DD_SETTLE_PASSES);
    expect(s.idle()).toBe(true);
    s.stop();
  });

  test('the slow re-check finding something pending goes back to the 1.2 s tick (a control drawn late is still caught)', () => {
    const f = fitEnv();
    const h = header();
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.advance(DD_TICK_MS * DD_SETTLE_PASSES);
    h.answers.push('pending');
    f.advance(DD_IDLE_CHECK_MS);
    const n = h.at.length;
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(n + 1); // the next pass came 1.2 s later, not 6 s
    s.stop();
  });

  test('a measurement after a render that finds something pending wakes the fast tick; a clear one does not', () => {
    const f = fitEnv();
    const h = header();
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.advance(DD_TICK_MS * DD_SETTLE_PASSES);
    s.report('clear');
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(DD_SETTLE_PASSES); // still on the slow re-check
    s.report('pending');
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(DD_SETTLE_PASSES + 1);
    s.stop();
  });

  test('wake() (a route / placement change, a size change) restarts the 1.2 s tick', () => {
    const f = fitEnv();
    const h = header();
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.advance(DD_TICK_MS * DD_SETTLE_PASSES);
    expect(s.idle()).toBe(true);
    s.wake();
    expect(s.idle()).toBe(false);
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(DD_SETTLE_PASSES + 1);
    s.stop();
  });

  test('hidden: no measurement at all; on return one measurement at once, then the 1.2 s tick', () => {
    const f = fitEnv();
    const h = header(['pending', 'pending']);
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    f.state.visible = false;
    f.advance(10 * 60_000);
    expect(h.at.length).toBe(0);
    expect(f.pending()).toBe(0); // no timer keeps running while hidden
    f.state.visible = true;
    f.show();
    expect(h.at.length).toBe(1);
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(2);
    s.stop();
  });

  test('stop() leaves no timer and no listener; nothing runs afterwards; start() again works', () => {
    const f = fitEnv();
    const h = header();
    const s = new FitScheduler(h.pass(f.now), h.fitted, f.env);
    s.start();
    expect(f.listeners()).toBe(1);
    s.stop();
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);
    f.advance(60_000);
    expect(h.at.length).toBe(0);
    s.report('pending'); // a late rAF measurement after disconnect arms nothing
    expect(f.pending()).toBe(0);
    s.start();
    s.start(); // idempotent
    expect(f.listeners()).toBe(1);
    f.advance(DD_TICK_MS);
    expect(h.at.length).toBe(1);
    s.stop();
  });
});

test.describe('the shell wiring (shell/sw-app.ts)', () => {
  const app = src('shell/sw-app.ts');

  test('no bare interval left in the shell', () => {
    expect(app).not.toMatch(/setInterval\(/);
    expect(app).not.toMatch(/sysTimer|ddTimer|fitDd\(\)/);
  });

  test('the system status polls through PollController every 60 s, without back-off, and stops on detach', () => {
    expect(app).toContain("import { PollController } from '../components/poll-controller';");
    expect(app).toContain('const SYS_POLL_MS = 60_000;');
    expect(app).toMatch(/private shellPoll = new PollController\(this\);/);
    expect(app).toMatch(/this\.shellPoll\.every\('system', SYS_POLL_MS, \(\) => Promise\.allSettled\(\[this\.pollSummary\(\), this\.pollAlerts\(\)\]\)\);/);
    expect(app).toMatch(/this\.shellPoll\.cancel\('system'\);\s*this\.sysStarted = false;/);
  });

  test('the header fit is the HeaderFit controller, synced after every render', () => {
    expect(app).toMatch(/private headerFit = new HeaderFit\(this\);/);
    expect(app).toMatch(/this\.headerFit\.enterRoute\(route\);/);
    expect(app).toMatch(/this\.headerFit\.sync\(`\$\{route\}\|\$\{place\}\|\$\{dd \?\? ''\}`\);/);
    expect(app).toMatch(/const place = declined \|\| this\.headerFit\.collideRoute \? '1' : asked;/);
    const fit = src('shell/header-fit.ts');
    expect(fit).toMatch(/new ResizeObserver\(/);
    expect(fit).not.toMatch(/setInterval\(/);
  });
});

/** A fake clock + page events + Lit host for PollController (the pattern of unit-poll-controller.spec.ts). */
function pollEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
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
    onResume: (a) => {
      onResume = a;
      registered++;
      return () => {
        registered--;
        onResume = () => undefined;
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
  const controllers: { hostConnected?: () => void; hostDisconnected?: () => void }[] = [];
  const host = {
    addController: (c: (typeof controllers)[number]) => void controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
  };
  return {
    env,
    state,
    advance,
    flush,
    host,
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
    resume: () => onResume(),
    pending: () => timers.size,
    listeners: () => registered,
  };
}

test.describe('the shell system-status poll (behaviour, as wired)', () => {
  test('60 s while visible; nothing while hidden; one read on return; a failing read keeps the 60 s period; detach stops everything', async () => {
    const t = pollEnv();
    const poll = new PollController(t.host, { env: t.env });
    t.connect();
    const reads: string[] = [];
    let fail = false;
    const pollSummary = async () => {
      reads.push('summary');
      if (fail) throw new Error('down');
    };
    const pollAlerts = async () => void reads.push('alerts');
    poll.every('system', 60_000, () => Promise.allSettled([pollSummary(), pollAlerts()]));
    await t.advance(60_000);
    expect(reads).toEqual(['summary', 'alerts']);
    t.state.visible = false;
    await t.advance(10 * 60_000);
    expect(reads.length).toBe(2);
    t.state.visible = true;
    t.resume();
    t.resume();
    await t.flush();
    expect(reads.length).toBe(4);
    fail = true;
    await t.advance(60_000);
    expect(reads.length).toBe(6);
    await t.advance(60_000); // no back-off after the failure
    expect(reads.length).toBe(8);
    poll.cancel('system');
    t.disconnect();
    expect(t.pending()).toBe(0);
    expect(t.listeners()).toBe(0);
    await t.advance(10 * 60_000);
    expect(reads.length).toBe(8);
  });
});

/** The component timers: every setInterval left in components/ is a local clock (no request); the request polls use PollController. */
const POLLED: { file: string; field: string; id: string; line: RegExp }[] = [
  { file: 'components/media-player-panel.ts', field: 'poll', id: 'state', line: /this\.poll\.every\('state', POLL_MS, \(\) => this\.load\(false\), \{ when: \(\) => this\.pend\.size === 0 && this\.joining\.size === 0 \}\);/ },
  { file: 'components/media-remote.ts', field: 'poll', id: 'state', line: /this\.poll\.every\('state', POLL_MS, \(\) => this\.load\(false\), \{ when: \(\) => this\.pend\.size === 0 && !this\.editing \}\);/ },
  { file: 'components/media-queue-list.ts', field: 'poll', id: 'upnext', line: /this\.poll\.every\('upnext', UP_NEXT_REFRESH_MS, \(\) => this\.load\(\)\);/ },
  { file: 'components/wk-call-history.ts', field: 'poll', id: 'calls', line: /this\.poll\.every\('calls', REFRESH_MS, \(\) => this\.load\(false\)\);/ },
  { file: 'components/sw-live-player.ts', field: 'stillPoll', id: 'still', line: /this\.stillPoll\.every\('still', STILL_REFRESH_MS, \(\) => void \(this\.posterTick \+= 1\)\);/ },
];

/** Every bare interval kept in components/ (file -> count): local clocks and animation ticks, none of them sends a request. */
const LOCAL_CLOCKS: Record<string, number> = {
  'components/cast-store.ts': 1, // the 1 s "elapsed" clock of open cast sessions
  'components/media-now-hero.ts': 1, // the 1 s progress ticker while playing
  'components/media-player-card.ts': 1, // same
  'components/media-player-panel.ts': 1, // same (tickTimer)
  'components/media-remote.ts': 1, // same (tickTimer)
  'components/media-remote-logic.ts': 2, // the repeat-press seam (injected timers) and its default
  'components/media-screen-card.ts': 1, // the progress ticker
  'components/notify-center.ts': 1, // notifyStore.tick(): the "ago" clock (local recompute)
  'components/sw-camera-tile.ts': 1, // the 1 s still scheduler: stillDue() requests only when visible, in view and due
  'components/sw-demo-banner.ts': 1, // a 15 s clock
  'components/sw-incoming-call.ts': 2, // the call clock; the door picture refresh (skips while hidden)
  'components/update-run.ts': 1, // the 1 s clock
  'components/wk-announce-dialog.ts': 1, // the retry countdown
  'components/wk-installer-confirm.ts': 1, // the elapsed seconds
  'components/wk-listen-button.ts': 1, // the 150 ms level animation
  'components/wk-station-maintenance.ts': 1, // the 1 s clock
  'components/wk-talk-button.ts': 1, // the 1 s clock
  'components/wk-triage-panel.ts': 1, // a 15 s clock
};

test.describe('component timers (components/)', () => {
  for (const p of POLLED) {
    test(`${p.file}: '${p.id}' polls through PollController`, () => {
      const code = src(p.file);
      expect(code).toContain("import { PollController } from './poll-controller';");
      expect(code).toMatch(new RegExp(`private ${p.field} = new PollController\\(this\\);`));
      expect(code).toMatch(p.line);
    });
  }

  test('every bare interval left in a component is a recorded local clock (no request)', () => {
    for (const [file, n] of Object.entries(LOCAL_CLOCKS)) expect((src(file).match(/setInterval\(/g) ?? []).length, file).toBe(n);
    const dir = new URL('../src/components/', import.meta.url);
    const withInterval = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && /setInterval\(/.test(readFileSync(new URL(f, dir), 'utf8')))
      .map((f) => `components/${f}`)
      .sort();
    expect(withInterval).toEqual(Object.keys(LOCAL_CLOCKS).sort()); // a new bare interval in a component must be recorded here (or poll)
    for (const p of POLLED) {
      const n = (src(p.file).match(/setInterval\(/g) ?? []).length;
      expect(n, p.file).toBe(LOCAL_CLOCKS[p.file] ?? 0);
    }
  });
});
