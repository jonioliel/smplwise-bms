import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { PUSH_POLL_RETRY_MAX, pushPollRetryDelay } from '../src/api/push-approval';
import { IDLE_LOOK_MS, look, resetPushApprovalWatchForTests, type LookDeps } from '../src/shell/push-approval-watch';

// FIX-PUSH-APPROVAL-2560: FE-06 (the watcher's lock is released when the approval sheet fails to load) and SA-01 (the requesting screen
// retries after a temporary 429; the phone looks slowly while nothing is pending). Node only: injected deps, no page.

const req = (id: string) => ({ request_id: id, action: 'door.open', expires_in: 80 });
const deps = (over: Partial<LookDeps>): LookDeps => ({ visible: () => true, list: async () => ({ enabled: true, pending: [] }), show: async () => undefined, ...over });
const body = { code: 'rate_limited', user_message: 'x', retryable: true, correlation_id: '', details: {} };

test.beforeEach(() => resetPushApprovalWatchForTests());

test('FE-06: a sheet that fails to load does not stop the watcher; the next request is shown', async () => {
  const shown: string[] = [];
  let pending = [req('pa_1')];
  const d = deps({
    list: async () => ({ enabled: true, pending }),
    show: async (first) => {
      shown.push(first.request_id);
      if (first.request_id === 'pa_1') throw new Error('Failed to fetch dynamically imported module');
    },
  });
  await expect(look('k1', d)).resolves.toBeGreaterThan(0); // no rejection escapes
  pending = [req('pa_1'), req('pa_2')];
  await look('k1', d); // before the fix `showing` stayed true and this returned without asking
  expect(shown).toEqual(['pa_1', 'pa_2']);
});

test('SA-01: nothing pending -> the slow look; the feature off -> stop', async () => {
  expect(await look('k1', deps({}))).toBe(IDLE_LOOK_MS);
  expect(await look('k1', deps({ list: async () => ({ enabled: false, pending: [] }) }))).toBe(false);
  expect(await look('k1', deps({ list: async () => Promise.reject(new Error('offline')) }))).toBe(IDLE_LOOK_MS);
});

test('SA-01: a 429 on the requester poll is retried a few times, any other error is final', () => {
  const tooMany = new ApiError(429, body);
  for (let n = 0; n < PUSH_POLL_RETRY_MAX; n++) expect(pushPollRetryDelay(tooMany, n)).toBeGreaterThanOrEqual(3000);
  expect(pushPollRetryDelay(tooMany, PUSH_POLL_RETRY_MAX)).toBeNull();
  expect(pushPollRetryDelay(new ApiError(404, { ...body, code: 'push_approval_unknown' }), 0)).toBeNull();
  expect(pushPollRetryDelay(new Error('x'), 0)).toBeNull();
});
