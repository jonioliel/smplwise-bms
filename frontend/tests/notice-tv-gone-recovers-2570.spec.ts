import { test, expect } from '@playwright/test';
import { lobbyFeed, TOKEN } from './notice-tv-fixtures';

// CU2-11 (FIX-UTIL-B-2570): one 404 used to stop a notice TV for good (the poll returned at once while "gone"). The screen now keeps asking
// slowly and comes back by itself when the board answers 200 again.
//   npx playwright test tests/notice-tv-gone-recovers-2570.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

test('a board that answered 404 once is asked again and recovers on its own', async ({ page }) => {
  let calls = 0;
  const feed = lobbyFeed();
  await page.clock.install();
  await page.route('**/api/v1/notices/display/lobby', async (route) => {
    calls += 1;
    if (calls === 1) await route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
    else await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"${feed.board.version}"` }, body: JSON.stringify(feed) });
  });
  await page.goto(new URL(`notice-tv.html?board=lobby#t=${TOKEN}`, base()).toString());
  await expect(page.locator('#cv')).toHaveAttribute('data-net', 'gone');
  expect(calls).toBe(1);
  await page.clock.runFor(61_000); // the first probe is due after one minute
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#cv')).not.toHaveAttribute('data-net', 'gone');
});
