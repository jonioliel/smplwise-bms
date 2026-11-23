import { test, expect } from '@playwright/test';
import { guardShot, type Shoot } from './helpers/capture-guard';

// FLAKY-CAPTURE-SCREENSHOT-2490: the capture guard retries ONLY a refused capture. No browser: the capture and the page are fakes.
//   npx playwright test tests/unit-capture-guard.spec.ts --project=desktop
test.beforeEach(({ browserName }, info) => {
  void browserName;
  info.skip(info.project.name !== 'desktop', 'one project only: nothing here depends on a viewport');
});

const REFUSED = new Error('page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot');
const fakePage = () => {
  const calls = { evaluate: 0, waits: [] as number[] };
  const page = {
    evaluate: async () => { calls.evaluate += 1; },
    waitForTimeout: async (ms: number) => { calls.waits.push(ms); },
    viewportSize: () => ({ width: 1, height: 1 }),
  };
  return { page, calls };
};

test('a refused capture is taken again after two frames and a growing beat; options reach the capture unchanged', async () => {
  const { page, calls } = fakePage();
  const seen: unknown[] = [];
  let n = 0;
  const shoot: Shoot = async (options) => {
    seen.push(options);
    n += 1;
    if (n < 3) throw REFUSED;
    return Buffer.from('png');
  };
  const options = { fullPage: true, path: 'x.png' };
  const out = await guardShot(shoot, () => page as never).call({}, options);
  expect(out.toString()).toBe('png');
  expect(n).toBe(3);
  expect(seen.every((o) => o === options)).toBe(true);
  expect(calls.evaluate).toBe(2);
  expect(calls.waits).toEqual([500, 1000]);
});

test('any other error is thrown at once, never retried', async () => {
  const { page, calls } = fakePage();
  let n = 0;
  const shoot: Shoot = async () => { n += 1; throw new Error('page.screenshot: Target page, context or browser has been closed'); };
  await expect(guardShot(shoot, () => page as never).call({})).rejects.toThrow(/has been closed/);
  expect(n).toBe(1);
  expect(calls.evaluate).toBe(0);
});

test('a page that keeps refusing fails after the last try with the browser\'s own message', async () => {
  const { page } = fakePage();
  let n = 0;
  const shoot: Shoot = async () => { n += 1; throw REFUSED; };
  await expect(guardShot(shoot, () => page as never).call({})).rejects.toThrow(/Unable to capture screenshot/);
  expect(n).toBe(4);
});

test('a page that went away during the retry throws its own error, not a silent success', async () => {
  const page = { evaluate: async () => { throw new Error('Target page, context or browser has been closed'); }, waitForTimeout: async () => {}, viewportSize: () => null };
  const shoot: Shoot = async () => { throw REFUSED; };
  await expect(guardShot(shoot, () => page as never).call({})).rejects.toThrow(/has been closed/);
});
