import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LiveEnv } from '../src/api/live-refresh';
import { PollController } from '../src/components/poll-controller';

// CR-POLL-FEATURES-2439 (review D2 / 08:F06): the feature modules' hand-rolled polls (tickets queues, generator, maintenance, the wall
// plan, the door emergency follow-up) moved onto the shared PollController. The periods and the conditions stay; the intentional changes
// are: no request in a hidden tab (the two tickets queues, the wall plan, the door follow-up) and no overlapping incident reads.
// A fake clock + fake page events + a fake Lit host, node only (the elements themselves need a DOM: their wiring is checked in the source).
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

function fakeEnv() {
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
  return { env, state, advance, flush, resume: () => onResume(), pending: () => timers.size, listeners: () => registered };
}

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

/** Each migrated poll: file, registration id, the period as written in the source, and the `when` predicate kept from the old loop. */
const SITES: { file: string; id: string; period: string; field?: string; when?: string; run: string }[] = [
  { file: 'tickets/inbound-queue.ts', id: 'inbound', period: '60_000', run: 'this.refresh()' },
  { file: 'tickets/intake-queue.ts', id: 'summary', period: '60_000', run: 'this.refreshSummary()' },
  { file: 'generator/gen-alerts-page.ts', id: 'alerts', period: 'POLL_MS', run: 'this.load(true)', when: "this.mode === 'alerts'" },
  { file: 'generator/gen-chart-set.ts', id: 'history', period: '60_000', run: 'this.load(true)', when: "this.range !== 'custom'" },
  { file: 'generator/gen-live-page.ts', id: 'live', period: 'POLL_MS', field: 'poller', run: '' },
  { file: 'generator/gen-log-page.ts', id: 'runs', period: 'POLL_MS', run: 'this.load(true)' },
  { file: 'maintenance/emergency-page.ts', id: 'readiness', period: '60_000', run: 'this.load()' },
  { file: 'maintenance/list-page.ts', id: 'tasks', period: 'POLL_MS', run: 'this.load()', when: '!this.run && !this.form' },
  { file: 'maintenance/log-page.ts', id: 'log', period: '60_000', run: 'this.load()' },
  { file: 'wall/sw-wall-plan.ts', id: 'floor', period: 'REFRESH_MS', run: 'this.refresh()' },
  { file: 'door-windows/emergency.ts', id: 'incident', period: 'FOLLOW_MS', run: 'this.readIncident()' },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('feature polls wired to PollController', () => {
  for (const s of SITES) {
    test(`${s.file}: '${s.id}' every ${s.period}${s.when ? ` while ${s.when}` : ''}, no bare server interval left`, () => {
      const code = src(s.file);
      const field = s.field ?? 'poll';
      expect(code).toMatch(/import \{ PollController \} from '\.\.\/components\/poll-controller';/);
      expect(code).toMatch(new RegExp(`private ${field} = new PollController\\(this\\);`));
      const head = `this.${field}.every('${s.id}', ${s.period}, `;
      expect(code).toContain(head);
      if (s.run) {
        const tail = s.when ? `() => ${s.run}, { when: () => ${s.when} });` : `() => ${s.run});`;
        expect(code).toMatch(new RegExp(esc(head + tail)));
      }
      // the old loops are gone: no server read from a bare interval, no hand-made visibility check around one
      expect(code).not.toMatch(/setInterval\(\s*(async\s*)?\(\)\s*=>\s*(\{\s*)?(void\s+)?this\.(load|refresh|poll|refreshSummary)\(/);
      expect(code).not.toMatch(/setInterval\(async/);
      expect(code).not.toMatch(/clearInterval\(this\.(timer|poll)\)/);
    });
  }

  test('only the door sheet keeps a bare interval: the local 0.5 s confirm countdown (no request)', () => {
    for (const s of SITES) {
      const n = (src(s.file).match(/setInterval\(/g) ?? []).length;
      expect(n, s.file).toBe(s.file === 'door-windows/emergency.ts' ? 1 : 0);
    }
    expect(src('door-windows/emergency.ts')).toMatch(/this\.tick = window\.setInterval\(\(\) => \{\s*this\.left = /);
  });

  test('gen-live-page: the "ago" clock moves with each read', () => {
    expect(src('generator/gen-live-page.ts')).toMatch(/this\.poller\.every\('live', POLL_MS, \(\) => \{\s*this\.tick = Date\.now\(\);\s*return this\.poll\(\);\s*\}\);/);
  });

  test('door emergency follow-up: stops by itself when the incident is no longer applying, on close, and drops an answer that is not ours', () => {
    const code = src('door-windows/emergency.ts');
    expect(code).toContain('const FOLLOW_MS = 1500;');
    expect(code).toMatch(/if \(!inc \|\| inc\.state !== 'applying'\) \{\s*this\.poll\.cancel\('incident'\);\s*return;/);
    expect(code).toMatch(/private stopTimers\(\): void \{[^}]*this\.poll\.cancel\('incident'\);/);
    expect(code).toMatch(/if \(this\.poll\.has\('incident'\) && this\.incident\?\.id === inc\.id\) this\.incident = next;/);
  });
});

test.describe('the in-flight guard (door emergency follow-up, 1.5 s)', () => {
  test('a slow incident read is never overtaken: no second read while one is pending, so an older answer cannot land after a newer one', async () => {
    const f = fakeEnv();
    const host = fakeHost();
    const poll = new PollController(host, { env: f.env });
    host.connect();
    const started: number[] = [];
    const answers: (() => void)[] = [];
    const applied: number[] = [];
    let n = 0;
    poll.every('incident', 1500, () => {
      const my = ++n;
      started.push(my);
      return new Promise<void>((r) =>
        answers.push(() => {
          applied.push(my);
          r();
        }),
      );
    });
    await f.advance(1500);
    expect(started).toEqual([1]);
    // the old setInterval fired every 1.5 s regardless: 20 more reads would have started here
    await f.advance(30_000);
    f.resume();
    poll.now('incident');
    await f.flush();
    expect(started).toEqual([1]);
    answers.shift()!();
    await f.flush();
    await f.advance(1500);
    expect(started).toEqual([1, 2]);
    answers.shift()!();
    await f.flush();
    expect(applied).toEqual([1, 2]); // in order, one at a time
  });

  test('hidden tab: no follow-up read; one on resume; cancel (sheet closed) leaves no timer and no listener after disconnect', async () => {
    const f = fakeEnv();
    const host = fakeHost();
    const poll = new PollController(host, { env: f.env });
    host.connect();
    let reads = 0;
    poll.every('incident', 1500, () => void reads++);
    f.state.visible = false;
    await f.advance(15_000);
    expect(reads).toBe(0);
    f.state.visible = true;
    f.resume();
    await f.flush();
    expect(reads).toBe(1);
    poll.cancel('incident');
    await f.advance(15_000);
    expect(reads).toBe(1);
    expect(f.pending()).toBe(0);
    host.disconnect();
    expect(f.listeners()).toBe(0);
  });

  test('a poll that cancels itself from inside its read (incident no longer applying) never runs again', async () => {
    const f = fakeEnv();
    const host = fakeHost();
    const poll = new PollController(host, { env: f.env });
    host.connect();
    let reads = 0;
    let applying = true;
    poll.every('incident', 1500, async () => {
      reads++;
      if (!applying) {
        poll.cancel('incident');
        return;
      }
      applying = false;
    });
    await f.advance(1500);
    await f.advance(1500);
    expect(reads).toBe(2);
    await f.advance(30_000);
    expect(reads).toBe(2);
    expect(poll.has('incident')).toBe(false);
    expect(f.pending()).toBe(0);
  });
});

test.describe('the start / stop lifecycle of a migrated element', () => {
  test('connect starts, disconnect stops every timer and listener, reconnect resumes at the full period (no leak across screen changes)', async () => {
    const f = fakeEnv();
    const host = fakeHost();
    const poll = new PollController(host, { env: f.env });
    let reads = 0;
    // the element registers in connectedCallback after super.connectedCallback(): the controller is already started
    host.connect();
    poll.every('readiness', 60_000, () => void reads++);
    await f.advance(60_000);
    expect(reads).toBe(1);
    host.disconnect(); // the screen is left
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);
    await f.advance(600_000);
    expect(reads).toBe(1);
    host.connect(); // the screen is opened again; connectedCallback registers again (replaces, never doubles)
    poll.every('readiness', 60_000, () => void reads++);
    expect(f.listeners()).toBe(1);
    expect(f.pending()).toBe(1);
    await f.advance(60_000);
    expect(reads).toBe(2);
    host.disconnect();
    expect(f.pending()).toBe(0);
  });
});
