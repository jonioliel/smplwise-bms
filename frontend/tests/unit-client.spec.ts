import { test, expect } from '@playwright/test';
import { ApiError, api, del, get, inflightGetCount, post } from '../src/api/client';

// CR-API-BLOB-2436 (docs/changes/CR-API-BLOB-2436.md, review 07:F16): the JSON client's answers that are not the happy path.
// A JSON error body that is not the error model (FastAPI's 422 `{detail}`) is normalised field by field instead of cast. No browser page.

type Reply = { status: number; text?: string | null; statusText?: string };

async function withFetch<T>(reply: (n: number) => Reply, run: (calls: { url: string; method: string; signal?: AbortSignal | null }[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: { url: string; method: string; signal?: AbortSignal | null }[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', signal: init?.signal });
    const r = reply(calls.length);
    await new Promise((res) => setTimeout(res, 5));
    return new Response(r.status === 204 ? null : (r.text ?? null), { status: r.status, statusText: r.statusText ?? '' });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
};

test.describe('client error model', () => {
  test('422 with a FastAPI `detail` body: a full error body (code, message, details) instead of undefined fields', async () => {
    const detail = [{ loc: ['body', 'name'], msg: 'field required', type: 'missing' }];
    await withFetch(() => ({ status: 422, text: JSON.stringify({ detail }), statusText: 'Unprocessable Entity' }), async () => {
      const e = await failure(post('things', { a: 1 }));
      expect(e.status).toBe(422);
      expect(e.body).toEqual({ code: 'http_422', user_message: 'Unprocessable Entity', retryable: false, correlation_id: '', details: {} });
      expect(e.code).toBe('http_422');
      expect(e.message).toBe('Unprocessable Entity');
    });
  });

  test('a conforming error body is passed through unchanged (extra keys included)', async () => {
    const body = { code: 'revision_conflict', user_message: 'השתנה בינתיים', retryable: false, correlation_id: 'r-9', details: { revision: 4 }, extra: 'kept' };
    await withFetch(() => ({ status: 409, text: JSON.stringify(body) }), async () => {
      const e = await failure(post('things', {}));
      expect(e.body).toEqual(body);
    });
  });

  test('a model body missing some fields gets each missing field filled', async () => {
    await withFetch(() => ({ status: 403, text: JSON.stringify({ code: 'forbidden' }), statusText: 'Forbidden' }), async () => {
      const e = await failure(get('things'));
      expect(e.body).toEqual({ code: 'forbidden', user_message: '', retryable: false, correlation_id: '', details: {} });
      expect(e.message).toBe('forbidden');
    });
  });

  test('204: no body is read, the call answers undefined', async () => {
    await withFetch(() => ({ status: 204 }), async (calls) => {
      expect(await del('things/1')).toBeUndefined();
      expect(calls[0].method).toBe('DELETE');
    });
  });

  test('a non-JSON 502 (a proxy page) becomes the fallback body with the status text', async () => {
    await withFetch(() => ({ status: 502, text: '<html><body>Bad Gateway</body></html>', statusText: 'Bad Gateway' }), async () => {
      const e = await failure(get('settings'));
      expect(e.status).toBe(502);
      expect(e.body).toEqual({ code: 'http_502', user_message: 'Bad Gateway', retryable: false, correlation_id: '', details: {} });
    });
  });

  test('a JSON array or scalar error body is not the model either', async () => {
    await withFetch(() => ({ status: 500, text: '"boom"', statusText: 'Internal Server Error' }), async () => {
      const e = await failure(api('x'));
      expect(e.body.code).toBe('http_500');
      expect(e.body.user_message).toBe('Internal Server Error');
    });
  });

  test('concurrent plain GETs still share one request; a GET with a signal is never shared', async () => {
    await withFetch(() => ({ status: 200, text: JSON.stringify({ ok: 1 }) }), async (calls) => {
      const [a, b] = await Promise.all([get('me'), get('me')]);
      expect(a).toEqual(b);
      expect(calls).toHaveLength(1);
      const ctrl = new AbortController();
      await Promise.all([get('me', { signal: ctrl.signal }), get('me')]);
      expect(calls).toHaveLength(3);
      expect(calls[1].signal).toBe(ctrl.signal);
      expect(inflightGetCount()).toBe(0);
    });
  });
});
