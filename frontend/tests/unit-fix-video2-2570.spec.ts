import { test, expect } from '@playwright/test';
import { markReviewed, type ReviewList } from '../src/api/frigate';
import { applyReviewed, settleMark } from '../src/screens/reviews-logic';
import { REVIEW_ITEMS, reviewList } from '../src/fixtures/frigate';

// FIX-VIDEO2-2570 (second deep review VD2-11): a Frigate "reviewed" mark across two recorders that half fails keeps what was saved and
// reverts only the items of the recorder that failed - never over a list that was reloaded meanwhile. Node only: a stubbed fetch.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-video2-2570.spec.ts

type Call = { url: string; body: string | null };

async function withFetch<T>(failPath: string, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : null });
    const bad = String(url).includes(failPath);
    const body = bad ? { code: 'source_unavailable', user_message: 'x', retryable: false, correlation_id: '', details: {} } : { updated: 1 };
    return new Response(JSON.stringify(body), { status: bad ? 502 : 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

const ITEMS = [
  { id: 'a1', recorder_id: 'fa' },
  { id: 'a2', recorder_id: 'fa' },
  { id: 'b1', recorder_id: 'fb' },
];

test('a mark across two recorders where one fails names the failed items and keeps the saved ones', async () => {
  const out = await withFetch('frigate/fb/', async (calls) => {
    const res = await markReviewed(ITEMS, true);
    expect(calls.length).toBe(2); // one request per recorder
    expect(calls.map((c) => c.url).filter((u) => u.includes('frigate/fa/reviews/reviewed') || u.includes('frigate/fb/reviews/reviewed')).length).toBe(2);
    return res;
  });
  expect(out).toEqual({ failed: ['b1'] });
  const ok = await withFetch('nothing-fails', () => markReviewed(ITEMS, true));
  expect(ok).toEqual({ failed: [] });
  // every recorder failed: an error, as before
  await expect(withFetch('frigate/', () => markReviewed(ITEMS, true))).rejects.toBeTruthy();
});

test('only the failed items go back, and never over a list reloaded meanwhile', () => {
  const before: ReviewList = reviewList(REVIEW_ITEMS.map((i) => ({ ...i })), { layer: 'alert' });
  const ids = before.items.slice(0, 3).map((i) => i.id);
  const optimistic = applyReviewed(before, ids, true);
  const failedId = ids.find((id) => !before.items.find((i) => i.id === id)!.reviewed)!;
  const settled = settleMark(optimistic, optimistic, before, [failedId], true);
  for (const id of ids) {
    const want = id === failedId ? before.items.find((i) => i.id === id)!.reviewed : true;
    expect(settled.items.find((i) => i.id === id)!.reviewed).toBe(want);
  }
  expect(settled.unreviewed.alert).toBe(optimistic.unreviewed.alert + 1); // the counter follows the one item put back
  expect(settleMark(optimistic, optimistic, before, [], true)).toBe(optimistic); // nothing failed: nothing changes
  const reloaded = { ...optimistic, items: optimistic.items.map((i) => ({ ...i })) };
  expect(settleMark(reloaded, optimistic, before, [failedId], true)).toBe(reloaded); // a newer list is the truth: no revert over it
});
