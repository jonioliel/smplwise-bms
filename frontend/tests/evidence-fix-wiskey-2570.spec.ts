import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { BANNER, installCallsMock, openApp } from './incoming-call-mocks';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock } from './schedule-writes-mocks';
import { execRead, installExecMock, newExecMock } from './schedule-exec-mocks';
import { settlePage } from './pixel-settle';

// FIX-WISKEY-2570 - the two new honest lines over the REAL shell, against MOCKED backends (invented data; no WisKey, no Home Assistant,
// no station). Desktop and phone, light and dark:
//   - SCR-51: the call banner after a read of the call list that failed for another reason than 403 keeps the last list and its buttons
//     (owner, LOWS-FRONTEND-2550 question 2 a) and says that it shows the last state read; the next good read clears the line;
//   - WA-02: a schedule execution row whose approvals could not be read in the last check says that the phase is the last complete one.
// Screenshots (compare page only, not committed) go to $FIX2570_SHOTS when it is set; the spec takes the picture before it asserts, so the
// same spec run on the base sources gives the "before" pictures.
const SHOTS = process.env.FIX2570_SHOTS;
const SCHEMES = ['light', 'dark'] as const;
const LIB = 'sw-app wiskey-schedules wk-schedule-library';
const BLOCK = `${LIB} wk-schedule-exec`;

async function shot(page: Page, info: TestInfo, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

test.describe('FIX-WISKEY-2570 honest lines', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  for (const scheme of SCHEMES) {
    test(`banner: a failed read (not 403) keeps the call and says it shows the last state read (${scheme})`, async ({ page }, info) => {
      const m = await installCallsMock(page);
      await openApp(page, '#/explore/floors/f0', { scheme });
      const banner = page.locator(BANNER);
      await expect(banner).toBeVisible({ timeout: 30_000 });
      let fail = true;
      await page.route('**/api/v1/intercom/calls/active', (route) =>
        fail
          ? route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ code: 'http_502', user_message: 'שגיאת שרת', retryable: true, correlation_id: 'm', details: {} }) })
          : route.fallback(),
      );
      const before = m.activeReads;
      m.stations.push();
      await page.waitForTimeout(1500);
      await shot(page, info, `banner-unread-${scheme}`);
      await expect(page.locator(`${BANNER} [data-call-unread]`)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`${BANNER} [data-call-answer]`)).toBeEnabled(); // the last list stays with its buttons
      expect(m.stations.signals).toEqual([]); // nothing was sent because of the failed read
      fail = false;
      m.stations.push();
      await expect.poll(() => m.activeReads, { timeout: 10_000 }).toBeGreaterThan(before);
      await expect(page.locator(`${BANNER} [data-call-unread]`)).toHaveCount(0, { timeout: 10_000 });
    });

    test(`schedule execution: approvals that could not be read are said so (${scheme})`, async ({ page }, info) => {
      await installAccessMock(page, { settings: { 'access.ui.schedules': 'smplwise' } });
      await installSchedWritesMock(page, newSchedMock());
      const unread = execRead('job-c1', 'review_pending', {
        job_status: 'ready',
        station_id: 'entry-c',
        reviews: { pending: 1, approved: 0, rejected: 0 },
        reviews_read: false,
        reviews_unread: true,
      });
      await installExecMock(page, newExecMock({ enabled: true, jobs: [unread] }));
      await page.clock.setFixedTime(NOW);
      await page.goto('about:blank');
      await page.goto(url('/wiskey/schedules?manage=1', 'classic', scheme));
      await page.waitForSelector('sw-app');
      const row = page.locator(`${BLOCK} [data-sx-job="job-c1"]`);
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.scrollIntoViewIfNeeded();
      await shot(page, info, `sched-exec-unread-${scheme}`);
      await expect(row).toHaveAttribute('data-phase', 'review_pending');
      await expect(row).toContainText('מוצג המצב המלא האחרון שנקרא');
    });
  }
});
