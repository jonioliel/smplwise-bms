import { test, expect } from '@playwright/test';
import { KioskIdle, PauseGate, idleMs, type IdlePhase, type IdleReason, type IdleScheduler } from '../src/map/kiosk-idle';

// Plan Studio 6, slice S5-B (CR-029 section 3.4, docs/changes/CR-029-ST7-S5B-NOTES.md) in node: the kiosk idle machine against a fake
// scheduler - the exact moment of going idle, one timer whatever the input rate, wake on input / on a plan change, hold (a walk),
// the screen coming back, a changed setting, a tablet that slept (late timers), re-entrancy, and the pause reasons.

/** A scheduler whose time only moves when the test says so; timers fire in order of their due time. */
class FakeScheduler implements IdleScheduler {
  t = 1_000_000;
  private seq = 0;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + Math.max(0, ms), fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }
  get pending(): number {
    return this.timers.size;
  }
  private due(limit: number): [number, { at: number; fn: () => void }] | undefined {
    return [...this.timers.entries()].filter(([, v]) => v.at <= limit).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
  }
  /** Advance the clock by `ms`, firing every timer that falls due on the way. */
  tick(ms: number): void {
    const end = this.t + ms;
    for (let next = this.due(end); next; next = this.due(end)) {
      this.t = Math.max(this.t, next[1].at);
      this.timers.delete(next[0]);
      next[1].fn();
    }
    this.t = end;
  }
  /** The clock jumps (the tablet slept) and only then do the due timers get to run - late, once. */
  jump(ms: number): void {
    this.t += ms;
    for (let next = this.due(this.t); next; next = this.due(this.t)) {
      this.timers.delete(next[0]);
      next[1].fn();
    }
  }
}

function make(idleS: number, over: { wakeOnChange?: boolean } = {}) {
  const sched = new FakeScheduler();
  const log: { phase: IdlePhase; reason: IdleReason }[] = [];
  const idle = new KioskIdle({ idleS, scheduler: sched, ...over, onChange: (phase, reason) => log.push({ phase, reason }) });
  return { sched, log, idle };
}

test.describe('going idle', () => {
  test('the view goes idle exactly idleS seconds after the last activity', () => {
    const { sched, idle, log } = make(30);
    expect(idle.phase).toBe('active');
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    expect(log).toEqual([{ phase: 'idle', reason: 'timeout' }]);
    sched.tick(10 * 60_000);
    expect(log).toHaveLength(1); // nothing fires again while idle
    expect(sched.pending).toBe(0);
  });

  test('an input moves the deadline; a flood of inputs keeps one timer', () => {
    const { sched, idle, log } = make(30);
    for (let i = 0; i < 100; i++) {
      sched.tick(10_000);
      idle.input(); // a pointermove stream
      for (let k = 0; k < 20; k++) idle.input();
      expect(sched.pending).toBeLessThanOrEqual(1);
    }
    expect(idle.phase).toBe('active');
    expect(log).toHaveLength(0);
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
  });

  test('an input wakes an idle view and the idle time starts again from the input', () => {
    const { sched, idle, log } = make(30);
    sched.tick(30_000);
    expect(idle.phase).toBe('idle');
    idle.input();
    expect(idle.phase).toBe('active');
    expect(log.map((l) => `${l.phase}:${l.reason}`)).toEqual(['idle:timeout', 'active:input']);
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    expect(log).toHaveLength(3);
  });
});

test.describe('plan changes', () => {
  test('a change keeps an active view awake and wakes an idle one', () => {
    const { sched, idle, log } = make(30);
    sched.tick(20_000);
    idle.change(); // a door opened
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    idle.change();
    expect(idle.phase).toBe('active');
    expect(log.map((l) => `${l.phase}:${l.reason}`)).toEqual(['idle:timeout', 'active:change']);
    sched.tick(30_000);
    expect(idle.phase).toBe('idle'); // the quiet period restarted at the change
  });

  test('wakeOnChange off: a change still keeps an active view awake but cannot wake an idle one', () => {
    const { sched, idle, log } = make(30, { wakeOnChange: false });
    sched.tick(20_000);
    idle.change();
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    idle.change();
    expect(idle.phase).toBe('idle');
    expect(log).toHaveLength(1);
    idle.input(); // a person still wakes it
    expect(idle.phase).toBe('active');
  });
});

test.describe('the idle time setting', () => {
  test('0 and invalid values mean never', () => {
    for (const bad of [0, -5, NaN, Infinity, '', 'x', null, undefined]) {
      const { sched, idle, log } = make(bad as number);
      sched.tick(24 * 3_600_000);
      expect(idle.phase, String(bad)).toBe('active');
      expect(log).toHaveLength(0);
      expect(sched.pending).toBe(0);
    }
    expect(idleMs(30)).toBe(30_000);
    expect(idleMs('120')).toBe(120_000);
    expect(idleMs(0.5)).toBe(500);
  });

  test('a new value re-arms; 0 wakes an idle view; a value on an idle view wakes it so the rule starts from a live view', () => {
    const { sched, idle, log } = make(30);
    sched.tick(10_000);
    idle.setIdleS(120);
    sched.tick(119_999);
    expect(idle.phase).toBe('active'); // 120 s counted from the change of setting
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    idle.setIdleS(0);
    expect(idle.phase).toBe('active');
    expect(log.at(-1)).toEqual({ phase: 'active', reason: 'config' });
    sched.tick(10 * 3_600_000);
    expect(idle.phase).toBe('active');
    idle.setIdleS(10);
    expect(idle.idleS).toBe(10);
    sched.tick(10_000);
    expect(idle.phase).toBe('idle');
    idle.setIdleS(10); // the same value changes nothing
    expect(idle.phase).toBe('idle');
  });
});

test.describe('hold, the screen and the clock', () => {
  test('a hold keeps the view awake; when the last hold ends the idle time restarts from that moment', () => {
    const { sched, idle } = make(30);
    idle.hold('walk', true);
    idle.hold('tour', true);
    sched.tick(10 * 60_000);
    expect(idle.phase).toBe('active');
    expect(sched.pending).toBe(0);
    idle.hold('walk', false);
    sched.tick(10 * 60_000);
    expect(idle.phase).toBe('active'); // one hold is still on
    idle.hold('tour', false);
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
    idle.hold('x', false); // ending a hold that was never on changes nothing
    expect(idle.phase).toBe('idle');
  });

  test('a hold that starts while idle wakes the view', () => {
    const { sched, idle, log } = make(30);
    sched.tick(30_000);
    idle.hold('walk', true);
    expect(idle.phase).toBe('active');
    expect(log.at(-1)).toEqual({ phase: 'active', reason: 'hold' });
  });

  test('the screen coming back is a person: it wakes an idle view; hiding it changes nothing', () => {
    const { sched, idle, log } = make(30);
    idle.setVisible(false);
    sched.tick(30_000);
    expect(idle.phase).toBe('idle');
    idle.setVisible(false);
    expect(idle.phase).toBe('idle');
    idle.setVisible(true);
    expect(idle.phase).toBe('active');
    expect(log.at(-1)).toEqual({ phase: 'active', reason: 'visible' });
    sched.tick(20_000);
    idle.setVisible(true); // visible again while active restarts the quiet period
    sched.tick(29_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
  });

  test('a tablet that slept: the late timer goes idle once, from the wall clock', () => {
    const { sched, idle, log } = make(30);
    sched.tick(5_000);
    idle.input();
    sched.jump(8 * 3_600_000); // eight hours asleep, then the timers run
    expect(idle.phase).toBe('idle');
    expect(log).toHaveLength(1);
  });

  test('a timer that fires after an input re-arms for what is left instead of going idle early', () => {
    const { sched, idle } = make(30);
    sched.tick(29_000);
    idle.input(); // the first timer is due in 1 s, the new deadline is 30 s away
    sched.tick(1_000);
    expect(idle.phase).toBe('active');
    sched.tick(28_999);
    expect(idle.phase).toBe('active');
    sched.tick(1);
    expect(idle.phase).toBe('idle');
  });
});

test.describe('lifecycle', () => {
  test('dispose clears the timer and every later call is ignored', () => {
    const { sched, idle, log } = make(30);
    idle.dispose();
    expect(sched.pending).toBe(0);
    sched.tick(10 * 60_000);
    idle.input();
    idle.change();
    idle.hold('walk', true);
    idle.setIdleS(10);
    sched.tick(10 * 60_000);
    expect(log).toHaveLength(0);
    expect(sched.pending).toBe(0);
  });

  test('a callback may call back into the machine (a wake inside the idle callback ends active, once)', () => {
    const sched = new FakeScheduler();
    const log: string[] = [];
    let idle!: KioskIdle;
    idle = new KioskIdle({
      idleS: 30,
      scheduler: sched,
      onChange: (phase, reason) => {
        log.push(`${phase}:${reason}`);
        if (phase === 'idle') idle.input();
      },
    });
    sched.tick(30_000);
    expect(log).toEqual(['idle:timeout', 'active:input']);
    expect(idle.phase).toBe('active');
    sched.tick(30_000);
    expect(log).toHaveLength(4);
  });
});

test.describe('pause reasons', () => {
  test('paused is the union of the reasons; clearing one never un-pauses another', () => {
    const g = new PauseGate();
    expect(g.paused).toBe(false);
    expect(g.set('hidden', true)).toBe(true);
    expect(g.set('idle', true)).toBe(false); // already paused
    expect(g.has('idle')).toBe(true);
    expect(g.set('hidden', false)).toBe(false); // idle still pauses
    expect(g.paused).toBe(true);
    expect(g.set('idle', false)).toBe(true);
    expect(g.paused).toBe(false);
    expect(g.set('host', false)).toBe(false); // a reason that was never set
    expect(g.set('host', true)).toBe(true);
    expect(g.paused).toBe(true);
  });
});
