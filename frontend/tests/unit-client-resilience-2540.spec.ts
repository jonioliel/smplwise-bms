import { test, expect } from '@playwright/test';
import {
  ApiError, ApiUnreachable, GET_DEADLINE_MS, PHYSICAL_STEP_UP_ACTIONS, STEP_UP_REPLAY_MS, get, inflightGetCount, patch, post, setGetDeadline,
  setStepUpHandler, setUnauthorizedHandler,
} from '../src/api/client';
import { LiveController, STALL_MIN_MS, type LiveEnv } from '../src/api/live-refresh';

// CLIENT-RESILIENCE-2540 (review FC-05, FC-03, SCR-23): the API client's plumbing that is not the happy path, with a stubbed fetch
// (no browser page) - a request that never answers, a sign-in service that cannot be reached, a step-up confirmation that came too
// late for a physical action - and the live refresh controller with a read that never settles (a fake clock).
//   npx playwright test -c playwright.unit.config.ts tests/unit-client-resilience-2540.spec.ts

type Call = { url: string; method: string; signal: AbortSignal | null | undefined };
/** One answer of the stub: a status and a body, `'hang'` (never answers unless aborted) or `'stall'` (headers, then a body that never ends). */
type Reply = { status: number; body?: unknown } | 'hang' | 'stall';

async function withFetch<T>(reply: (n: number) => Reply, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    const signal = init?.signal;
    calls.push({ url: String(url), method: init?.method ?? 'GET', signal });
    const r = reply(calls.length);
    const aborted = () => new DOMException('The operation was aborted.', 'AbortError');
    if (r === 'hang') {
      // a half-open connection: the browser's fetch only ever ends through its abort signal
      return new Promise<Response>((_, reject) => signal?.addEventListener('abort', () => reject(aborted()), { once: true }));
    }
    if (r === 'stall') {
      const body = new ReadableStream<Uint8Array>({
        start(ctl) {
          ctl.enqueue(new TextEncoder().encode('{"par'));
          signal?.addEventListener('abort', () => ctl.error(aborted()), { once: true });
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }
    return Promise.resolve(new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } }));
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    setGetDeadline(GET_DEADLINE_MS);
    setUnauthorizedHandler(null);
    setStepUpHandler(null);
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

const settle = async (p: Promise<unknown>): Promise<unknown> => p.then(() => null, (e: unknown) => e);

// ------------------------------------------------------------------------------------------------ FC-05: the request deadline

test.describe('FC-05: no request waits for ever', () => {
  test('a plain GET that never answers fails as "no connection" after its deadline, and the next call asks the server again', async () => {
    setGetDeadline(60);
    await withFetch((n) => (n === 1 ? 'hang' : { status: 200, body: { ok: true } }), async (calls) => {
      const err = await settle(get('me'));
      expect(err).toBeInstanceOf(ApiUnreachable);
      expect(err).toBeInstanceOf(TypeError); // every screen's offline state and describeError treat it as a network failure
      expect((err as ApiUnreachable).reason).toBe('timeout');
      expect(calls[0].signal?.aborted).toBe(true); // the connection is let go, not left hanging
      expect(inflightGetCount()).toBe(0);
      expect(await get('me')).toEqual({ ok: true });
      expect(calls).toHaveLength(2);
    });
  });

  test('callers that shared the hung request all get the failure - never one pending promise for every later caller', async () => {
    setGetDeadline(60);
    await withFetch((n) => (n === 1 ? 'hang' : { status: 200, body: { v: n } }), async (calls) => {
      const [a, b] = await Promise.all([settle(get('settings')), settle(get('settings'))]);
      expect(a).toBeInstanceOf(ApiUnreachable);
      expect(b).toBeInstanceOf(ApiUnreachable);
      expect(calls).toHaveLength(1); // they did share it while it was open
      expect(await get('settings')).toEqual({ v: 2 });
    });
  });

  test('an answer whose body stalls half-way fails too (the deadline covers the body of a JSON read)', async () => {
    setGetDeadline(60);
    await withFetch(() => 'stall', async () => {
      const err = await settle(get('devices/tree'));
      expect(err).toBeInstanceOf(ApiUnreachable);
      expect((err as ApiUnreachable).reason).toBe('timeout');
    });
  });

  test('writes get no default deadline; a call with its own signal keeps it; timeoutMs 0 opts out; the default is 60 s', async () => {
    expect(GET_DEADLINE_MS).toBe(60_000);
    await withFetch(() => ({ status: 200, body: {} }), async (calls) => {
      await post('tickets', { a: 1 });
      await patch('settings', { a: 1 });
      expect(calls.map((c) => [c.method, c.signal ?? null])).toEqual([['POST', null], ['PATCH', null]]);
      const ctrl = new AbortController();
      await get('me', { signal: ctrl.signal });
      expect(calls[2].signal).toBe(ctrl.signal);
      await get('reports/long', { timeoutMs: 0 });
      expect(calls[3].signal ?? null).toBeNull();
      await get('me');
      expect(calls[4].signal).toBeInstanceOf(AbortSignal); // the default deadline's own signal
    });
  });

  test('a caller that aborts still gets its abort, not a timeout', async () => {
    await withFetch(() => 'hang', async () => {
      const ctrl = new AbortController();
      const p = settle(get('me', { signal: ctrl.signal, timeoutMs: 5_000 }));
      ctrl.abort();
      const err = await p;
      expect(err).not.toBeInstanceOf(ApiUnreachable);
      expect((err as Error).name).toBe('AbortError');
    });
  });
});

// ------------------------------------------------------------------------------------------------ FC-03: unreachable is not "signed out"

test.describe('FC-03: a 401 while the sign-in service cannot be reached', () => {
  test('the handler says "unreachable": the request fails like an offline one, once, and is not retried', async () => {
    let asked = 0;
    setUnauthorizedHandler(async () => {
      asked++;
      return 'unreachable';
    });
    await withFetch(() => ({ status: 401, body: { code: 'remote_login_required', user_message: 'x', retryable: false, correlation_id: '', details: {} } }), async (calls) => {
      const err = await settle(get('me'));
      expect(err).toBeInstanceOf(ApiUnreachable);
      expect((err as ApiUnreachable).reason).toBe('signin_unreachable');
      expect(calls).toHaveLength(1);
    });
    expect(asked).toBe(1);
  });

  test('renewed: the request is sent once more; ended: the 401 reaches the caller (as before)', async () => {
    setUnauthorizedHandler(async () => true);
    await withFetch((n) => (n === 1 ? { status: 401, body: { code: 'remote_login_required' } } : { status: 200, body: { ok: 1 } }), async (calls) => {
      expect(await get('me')).toEqual({ ok: 1 });
      expect(calls).toHaveLength(2);
    });
    setUnauthorizedHandler(async () => false);
    await withFetch(() => ({ status: 401, body: { code: 'remote_login_required', user_message: 'x' } }), async () => {
      const err = await settle(get('me'));
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    });
  });
});

// ------------------------------------------------------------------------------------------------ SCR-23: no late replay of a physical action

const gate = (action: string) => ({ code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action, methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } });

test.describe('SCR-23: a refused physical action is never sent after the confirmation came too late', () => {
  test('the physical actions are the server gate\'s three', () => {
    expect([...PHYSICAL_STEP_UP_ACTIONS].sort()).toEqual(['alarm.bypass', 'alarm.disarm', 'door.open']);
    expect(STEP_UP_REPLAY_MS).toBe(120_000);
  });

  for (const late of [false, true]) {
    test(`door open confirmed ${late ? 'after' : 'within'} the replay window: ${late ? 'not re-sent, the refusal stays' : 're-sent once'}`, async () => {
      const realNow = Date.now;
      let skew = 0;
      Date.now = () => realNow() + skew;
      try {
        setStepUpHandler(async () => {
          if (late) skew += STEP_UP_REPLAY_MS + 1_000; // somebody typed the code minutes later
          return true;
        });
        await withFetch((n) => (n === 1 ? { status: 403, body: gate('door.open') } : { status: 200, body: { opened: true } }), async (calls) => {
          const out = await settle(post('access-control/doors/d1/open', {}));
          if (late) {
            expect(out).toBeInstanceOf(ApiError);
            expect((out as ApiError).body.code).toBe('step_up_required');
            expect(calls).toHaveLength(1);
          } else {
            expect(out).toBeNull();
            expect(calls).toHaveLength(2);
          }
        });
      } finally {
        Date.now = realNow;
      }
    });
  }

  test('a settings change confirmed late is still re-sent (only physical actions have the window)', async () => {
    const realNow = Date.now;
    let skew = 0;
    Date.now = () => realNow() + skew;
    try {
      setStepUpHandler(async () => {
        skew += STEP_UP_REPLAY_MS + 1_000;
        return true;
      });
      await withFetch((n) => (n === 1 ? { status: 403, body: gate('system.configure') } : { status: 200, body: { saved: true } }), async (calls) => {
        expect(await patch('settings', { a: 1 })).toEqual({ saved: true });
        expect(calls).toHaveLength(2);
      });
    } finally {
      Date.now = realNow;
    }
  });

  test('the wait for the confirmation does not count against the request deadline', async () => {
    setGetDeadline(40);
    setStepUpHandler(async () => {
      await new Promise((r) => setTimeout(r, 120)); // longer than the deadline
      return false;
    });
    await withFetch(() => ({ status: 403, body: gate('system.configure') }), async () => {
      const err = await settle(get('settings/export-preview'));
      expect(err).toBeInstanceOf(ApiError); // the refusal itself, still readable - not a timeout
      expect((err as ApiError).body.code).toBe('step_up_required');
    });
  });
});

// ------------------------------------------------------------------------------------------------ FC-05: the live refresh watchdog

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const env: LiveEnv = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => true,
    online: () => true,
    onResume: () => () => undefined,
    random: () => 0.5,
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      for (let i = 0; i < 4; i++) await Promise.resolve();
    }
    now = end;
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
  return { env, advance };
}

test.describe('FC-05: a live source whose read never settles', () => {
  test('is given up on after the stall time: polled again, counted as failing, and its late answer is ignored', async () => {
    const f = fakeEnv();
    let n = 0;
    let lateDone: ((v: unknown) => void) | null = null;
    const c = new LiveController(f.env).add({
      id: 'tree',
      pollMs: 15_000,
      run: () => {
        n++;
        if (n === 1) return new Promise((res) => (lateDone = res)); // the first read hangs
        return true;
      },
    });
    c.start();
    await f.advance(16_500); // the first poll starts and hangs
    expect(n).toBe(1);
    await f.advance(STALL_MIN_MS + 1_000); // the watchdog lets go of it
    expect(c.failing()).toBe(true);
    await f.advance(40_000); // backed-off next poll (15 s x 2) runs
    expect(n).toBe(2);
    expect(c.failing()).toBe(false);
    const ok = c.ageOf('tree');
    (lateDone as ((v: unknown) => void) | null)?.(false); // the stale read finally answers (a failure): ignored
    await f.advance(1);
    expect(c.failing()).toBe(false);
    expect(c.ageOf('tree')).toBeLessThanOrEqual(ok + 1);
    c.stop();
  });

  test('the retry button works again after a stalled read', async () => {
    const f = fakeEnv();
    let n = 0;
    const c = new LiveController(f.env).add({ id: 'gen', pollMs: 1_000_000, run: () => (++n === 1 ? new Promise(() => undefined) : true) });
    c.start();
    c.refreshOne('gen');
    await f.advance(1);
    expect(n).toBe(1);
    c.refreshOne('gen'); // still running: nothing (as before)
    await f.advance(1);
    expect(n).toBe(1);
    await f.advance(5 * 1_000_000 + 1); // stall time = 5 periods for a long period
    c.refreshOne('gen');
    await f.advance(1);
    expect(n).toBe(2);
    c.stop();
  });
});
