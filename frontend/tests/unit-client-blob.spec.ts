import { test, expect } from '@playwright/test';
import { ApiError, apiBlob, apiResponse, setUnauthorizedHandler } from '../src/api/client';

// CR-API-BLOB-2436 (docs/changes/CR-API-BLOB-2436.md, review 07:F5): binary reads go through the client's own `send` path, so they
// get the remote channel's 401 refresh-and-retry and the one error model. No browser page.

type Call = { url: string; method: string; credentials?: RequestCredentials; signal?: AbortSignal | null; cache?: RequestCache };
type Reply = { status: number; body?: BodyInit | null; headers?: Record<string, string>; statusText?: string };

async function withFetch<T>(reply: (n: number) => Reply, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', credentials: init?.credentials, signal: init?.signal, cache: init?.cache });
    const r = reply(calls.length);
    return new Response(r.status === 204 ? null : (r.body ?? null), { status: r.status, statusText: r.statusText ?? '', headers: r.headers });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    setUnauthorizedHandler(null);
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

const errorJson = (code: string, msg: string) => JSON.stringify({ code, user_message: msg, retryable: true, correlation_id: 'c-1', details: { a: 1 } });

test.describe('apiBlob', () => {
  test('200: the body as a Blob with the answer headers; one same-origin request; the signal is passed on', async () => {
    const ctrl = new AbortController();
    await withFetch(() => ({ status: 200, body: 'a,b\r\n1,2\r\n', headers: { 'Content-Disposition': 'attachment; filename="x.csv"', 'X-Export-Rows': '1' } }), async (calls) => {
      const { blob, headers } = await apiBlob('/tickets/export.csv?x=1', { signal: ctrl.signal });
      expect(await blob.text()).toBe('a,b\r\n1,2\r\n');
      expect(headers.get('X-Export-Rows')).toBe('1');
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('http://h/app/api/v1/tickets/export.csv?x=1');
      expect(calls[0].credentials).toBe('same-origin');
      expect(calls[0].signal).toBe(ctrl.signal);
    });
  });

  test('an error with the JSON error model is thrown as that ApiError', async () => {
    await withFetch(() => ({ status: 429, body: errorJson('export_rate', 'נסו שוב בעוד דקה'), headers: { 'Content-Type': 'application/json' } }), async () => {
      const err = await apiBlob('x.pdf').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.status).toBe(429);
      expect(e.body).toEqual({ code: 'export_rate', user_message: 'נסו שוב בעוד דקה', retryable: true, correlation_id: 'c-1', details: { a: 1 } });
      expect(e.message).toBe('נסו שוב בעוד דקה');
    });
  });

  test('401 with a handler that answers true: the request is retried once and the second answer is used', async () => {
    let asked = 0;
    await withFetch((n) => (n === 1 ? { status: 401, body: errorJson('unauthorized', '') } : { status: 200, body: 'PDF' }), async (calls) => {
      setUnauthorizedHandler(async () => {
        asked += 1;
        return true;
      });
      const { blob } = await apiBlob('bills/1/pdf');
      expect(await blob.text()).toBe('PDF');
      expect(asked).toBe(1);
      expect(calls).toHaveLength(2);
      expect(calls[1].url).toBe(calls[0].url);
    });
  });

  test('401 with a handler that answers false: no retry, the 401 is thrown', async () => {
    let asked = 0;
    await withFetch(() => ({ status: 401, body: errorJson('unauthorized', 'נדרשת כניסה') }), async (calls) => {
      setUnauthorizedHandler(async () => {
        asked += 1;
        return false;
      });
      const err = await apiBlob('bills/1/pdf').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).code).toBe('unauthorized');
      expect(asked).toBe(1);
      expect(calls).toHaveLength(1);
    });
  });

  test('without a handler (Ingress) a 401 is final: one request', async () => {
    await withFetch(() => ({ status: 401, body: errorJson('unauthorized', '') }), async (calls) => {
      const err = await apiBlob('x.csv').catch((e: unknown) => e);
      expect((err as ApiError).status).toBe(401);
      expect(calls).toHaveLength(1);
    });
  });

  test('apiResponse hands back the raw answer (no throw on a status) with the 401 retry and the caller options', async () => {
    await withFetch((n) => (n === 1 ? { status: 401 } : { status: 202 }), async (calls) => {
      setUnauthorizedHandler(async () => true);
      const res = await apiResponse('events/e1/thumbnail', { cache: 'no-store' });
      expect(res.status).toBe(202);
      expect(calls).toHaveLength(2);
      expect(calls.every((c) => c.cache === 'no-store' && c.credentials === 'same-origin')).toBe(true);
    });
  });

  test('an absolute address built by apiUrl is kept as it is', async () => {
    await withFetch(() => ({ status: 200, body: 'jpg' }), async (calls) => {
      await apiBlob('http://h/app/api/v1/cameras/c1/frame?at=2026-11-13T10:00:00Z');
      expect(calls[0].url).toBe('http://h/app/api/v1/cameras/c1/frame?at=2026-11-13T10:00:00Z');
    });
  });
});
