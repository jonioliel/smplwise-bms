import { test, expect } from '@playwright/test';
import { ApiError, patch, post, setStepUpHandler, type StepUpDetails } from '../src/api/client';

// MFA-STEPUP-TRAIN-2490 slice 2: the client's answer to the server's step-up gate (403 step_up_required with `verify_path`). The handler
// (the shell's code dialog) is asked once; a true answer re-sends the SAME request exactly once, a false answer or a second refusal is
// final. A 403 of the same code without `verify_path` (the bridge-key reveal, which asks for its own code) is left to its screen.
// No browser page: a stubbed fetch and document.

type Call = { url: string; method: string; body: unknown };
type Reply = { status: number; body?: unknown };

async function withFetch<T>(reply: (n: number) => Reply, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ?? null });
    const r = reply(calls.length);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    setStepUpHandler(null);
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

const GATE = { code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action: 'system.configure', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } };
const BRIDGE = { code: 'step_up_required', user_message: 'קוד', retryable: false, correlation_id: 'c', details: {} };
const FORBIDDEN = { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'c', details: {} };

test('a confirmed step-up re-sends the same request once and returns its answer', async () => {
  const asked: StepUpDetails[] = [];
  setStepUpHandler(async (d) => {
    asked.push(d);
    return true;
  });
  await withFetch((n) => (n === 1 ? { status: 403, body: GATE } : { status: 200, body: { saved: true } }), async (calls) => {
    expect(await patch<{ saved: boolean }>('settings', { 'home.title': 'x' })).toEqual({ saved: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['PATCH', 'http://h/app/api/v1/settings', '{"home.title":"x"}'],
      ['PATCH', 'http://h/app/api/v1/settings', '{"home.title":"x"}'],
    ]);
  });
  expect(asked).toEqual([GATE.details]);
});

test('a cancelled step-up sends nothing more and the refusal reaches the caller', async () => {
  setStepUpHandler(async () => false);
  await withFetch(() => ({ status: 403, body: GATE }), async (calls) => {
    const err = await patch('settings', { a: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).body.code).toBe('step_up_required');
    expect(calls).toHaveLength(1);
  });
});

test('the retried request is never retried again: a second refusal is final and the dialog is not asked twice', async () => {
  let asked = 0;
  setStepUpHandler(async () => {
    asked += 1;
    return true;
  });
  await withFetch(() => ({ status: 403, body: GATE }), async (calls) => {
    const err = await post('access/bindings', { role_id: 'viewer' }).catch((e: unknown) => e);
    expect((err as ApiError).body.code).toBe('step_up_required');
    expect(calls).toHaveLength(2);
  });
  expect(asked).toBe(1);
});

test('only the central gate is intercepted: the bridge-key 403 and a plain 403 are left to the screen', async () => {
  let asked = 0;
  setStepUpHandler(async () => {
    asked += 1;
    return true;
  });
  await withFetch(() => ({ status: 403, body: BRIDGE }), async (calls) => {
    await expect(post('system/bridge-key/revoke/reveal', {})).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });
  await withFetch(() => ({ status: 403, body: FORBIDDEN }), async (calls) => {
    await expect(patch('settings', {})).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });
  expect(asked).toBe(0);
});

test('without a handler (a page that never installed the shell) the refusal is returned as it is', async () => {
  await withFetch(() => ({ status: 403, body: GATE }), async (calls) => {
    const err = await patch('settings', {}).catch((e: unknown) => e);
    expect((err as ApiError).body.code).toBe('step_up_required');
    expect(calls).toHaveLength(1);
  });
});
