import { test, expect } from '@playwright/test';
import { LOCK_WAIT_MS, PointerLockGate, type FrameInfo, type LockDocument, type LockEnv, type LockTarget, type LockVerdict, type RefusalReason } from '../src/map/pointer-lock-gate';

// Plan Studio 6, slice S5-B (CR-029 section 4.5, docs/changes/CR-029-ST7-S5B-NOTES.md) in node: pointer lock is an opt-in that
// degrades quietly. Every way an embedding frame (the Home Assistant Ingress iframe) or a browser can refuse it is played here -
// a synchronous SecurityError, a rejected promise, the `pointerlockerror` event, silence, a missing API, a sandboxed frame -
// and in each the walk is left on drag with nothing thrown and nothing asked twice. The real browser refusal in a sandboxed
// iframe is in evidence-pointer-lock.spec.ts.

class FakeDoc implements LockDocument {
  pointerLockElement: unknown = null;
  private readonly handlers = new Map<string, Set<() => void>>();
  addEventListener(type: string, fn: () => void): void {
    (this.handlers.get(type) ?? this.handlers.set(type, new Set()).get(type)!).add(fn);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.handlers.get(type)?.delete(fn);
  }
  fire(type: string): void {
    for (const f of [...(this.handlers.get(type) ?? [])]) f();
  }
  listeners(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}

interface Setup {
  doc: FakeDoc;
  env: LockEnv;
  store: { value: string | null };
  timers: { fn: () => void; ms: number; id: number }[];
  refused: RefusalReason[];
  gate: PointerLockGate;
  fireTimers(): void;
}

function setup(over: { supported?: boolean; frame?: FrameInfo | null; store?: { value: string | null } } = {}): Setup {
  const doc = new FakeDoc();
  const store = over.store ?? { value: null };
  const timers: Setup['timers'] = [];
  let ids = 0;
  const env: LockEnv = {
    doc,
    frame: () => (over.frame === undefined ? null : over.frame),
    supported: () => over.supported !== false,
    store: { get: () => store.value, set: (v) => (store.value = v) },
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms, id: ++ids });
      return ids;
    },
    clearTimeout: (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  const refused: RefusalReason[] = [];
  return {
    doc, env, store, timers, refused,
    gate: new PointerLockGate(env, (r) => refused.push(r)),
    fireTimers: () => {
      for (const t of [...timers]) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    },
  };
}

const target = (impl?: () => unknown): LockTarget & { calls: number } => {
  const t: LockTarget & { calls: number } = { calls: 0, requestPointerLock: () => (t.calls++, impl?.()) };
  return t;
};

test.describe('where pointer lock is worth asking', () => {
  test('a plain top-level page is not blocked; the modes pass through', () => {
    const s = setup();
    expect(s.gate.blocked).toBeNull();
    expect(s.gate.effectiveMode('lock')).toBe('lock');
    expect(s.gate.effectiveMode('auto')).toBe('auto');
    expect(s.gate.effectiveMode('drag')).toBe('drag');
  });

  test('no API at all (iPad Safari): lock and auto fall back to drag, and a request is never made', async () => {
    const s = setup({ supported: false });
    expect(s.gate.blocked).toBe('unsupported');
    expect(s.gate.effectiveMode('lock')).toBe('drag');
    expect(s.gate.effectiveMode('auto')).toBe('drag');
    const t = target();
    expect(await s.gate.request(t)).toEqual({ state: 'blocked', reason: 'unsupported' });
    expect(t.calls).toBe(0);
  });

  test('a frame whose sandbox lacks allow-pointer-lock is known up front; an unsandboxed or allowing frame is not blocked', async () => {
    const closed = setup({ frame: { sandbox: ['allow-scripts', 'allow-same-origin'] } });
    expect(closed.gate.blocked).toBe('frame-sandbox');
    expect(closed.gate.effectiveMode('lock')).toBe('drag');
    const t = target();
    expect(await closed.gate.request(t)).toEqual({ state: 'blocked', reason: 'frame-sandbox' });
    expect(t.calls).toBe(0);
    expect(setup({ frame: { sandbox: ['allow-scripts', 'allow-pointer-lock'] } }).gate.blocked).toBeNull();
    expect(setup({ frame: { sandbox: null } }).gate.blocked).toBeNull(); // an iframe with no sandbox attribute
    expect(setup({ frame: null }).gate.blocked).toBeNull(); // cross-origin parent: the request decides
  });
});

test.describe('every refusal degrades the same way', () => {
  const refusedVerdict: LockVerdict = { state: 'refused', reason: 'refused' };

  test('a synchronous SecurityError', async () => {
    const s = setup();
    const t = target(() => {
      throw new DOMException('sandboxed', 'SecurityError');
    });
    expect(await s.gate.request(t)).toEqual(refusedVerdict);
    expect(s.gate.blocked).toBe('refused');
    expect(s.gate.effectiveMode('lock')).toBe('drag');
    expect(s.refused).toEqual(['refused']);
    expect(s.doc.listeners('pointerlockerror')).toBe(0); // the request cleaned up after itself
    expect(s.doc.listeners('pointerlockchange')).toBe(0);
    expect(s.timers).toHaveLength(0);
  });

  test('a rejected promise (no unhandled rejection: the verdict is returned)', async () => {
    const s = setup();
    const t = target(() => Promise.reject(new DOMException('not allowed', 'NotAllowedError')));
    expect(await s.gate.request(t)).toEqual(refusedVerdict);
    expect(s.gate.blocked).toBe('refused');
    expect(s.refused).toEqual(['refused']);
  });

  test('the pointerlockerror event (a browser whose request returns nothing)', async () => {
    const s = setup();
    const t = target();
    const pending = s.gate.request(t);
    s.doc.fire('pointerlockerror');
    expect(await pending).toEqual(refusedVerdict);
    expect(s.gate.blocked).toBe('refused');
  });

  test('silence: no event and no promise within LOCK_WAIT_MS counts as refused', async () => {
    const s = setup();
    const t = target();
    const pending = s.gate.request(t);
    expect(s.timers).toHaveLength(1);
    expect(s.timers[0].ms).toBe(LOCK_WAIT_MS);
    s.fireTimers();
    expect(await pending).toEqual(refusedVerdict);
    expect(s.gate.blocked).toBe('refused');
  });

  test('a target without the method', async () => {
    const s = setup();
    expect(await s.gate.request({})).toEqual({ state: 'refused', reason: 'unsupported' });
    expect(s.gate.blocked).toBe('unsupported');
  });

  test('after a refusal nothing is asked again in this tab session, and a new gate (the next walk) knows at once', async () => {
    const s = setup();
    const t = target(() => {
      throw new DOMException('x', 'SecurityError');
    });
    await s.gate.request(t);
    expect(t.calls).toBe(1);
    expect(await s.gate.request(t)).toEqual({ state: 'blocked', reason: 'refused' });
    expect(t.calls).toBe(1);
    const next = setup({ store: s.store });
    expect(next.gate.blocked).toBe('refused');
    expect(next.gate.effectiveMode('auto')).toBe('drag');
    next.gate.reset();
    expect(next.gate.blocked).toBeNull();
  });
});

test.describe('success and the browser cool-down', () => {
  test('a granted lock is "locked", and the request leaves no listener behind', async () => {
    const s = setup();
    const t = target(() => {
      s.doc.pointerLockElement = t;
      queueMicrotask(() => s.doc.fire('pointerlockchange'));
      return Promise.resolve();
    });
    expect(await s.gate.request(t)).toEqual({ state: 'locked' });
    expect(s.gate.blocked).toBeNull();
    expect(s.refused).toEqual([]);
    expect(s.doc.listeners('pointerlockerror') + s.doc.listeners('pointerlockchange')).toBe(0);
    expect(s.timers).toHaveLength(0);
  });

  test('once the lock has worked, a later error is the cool-down after Esc: not remembered, not reported', async () => {
    const s = setup();
    const stop = s.gate.attach();
    const t = target();
    s.doc.pointerLockElement = t;
    s.doc.fire('pointerlockchange'); // locked
    s.doc.pointerLockElement = null;
    s.doc.fire('pointerlockchange'); // the person pressed Esc
    s.doc.fire('pointerlockerror'); // an immediate re-request is turned down by the browser
    expect(s.gate.blocked).toBeNull();
    expect(s.refused).toEqual([]);
    expect(s.gate.effectiveMode('lock')).toBe('lock');
    stop();
  });
});

test.describe('learning a refusal made by somebody else (the walk asks on its own)', () => {
  test('a pointerlockerror on the document is remembered and reported exactly once', () => {
    const s = setup();
    const stop = s.gate.attach();
    expect(s.gate.blocked).toBeNull();
    s.doc.fire('pointerlockerror');
    s.doc.fire('pointerlockerror');
    expect(s.gate.blocked).toBe('refused');
    expect(s.gate.effectiveMode('lock')).toBe('drag');
    expect(s.refused).toEqual(['refused']);
    stop();
  });

  test('attach is reference counted and stop is idempotent; a detached gate hears nothing', () => {
    const s = setup();
    const a = s.gate.attach();
    const b = s.gate.attach();
    expect(s.doc.listeners('pointerlockerror')).toBe(1);
    a();
    a();
    expect(s.doc.listeners('pointerlockerror')).toBe(1);
    b();
    expect(s.doc.listeners('pointerlockerror')).toBe(0);
    s.doc.fire('pointerlockerror');
    expect(s.gate.blocked).toBeNull();
  });
});
