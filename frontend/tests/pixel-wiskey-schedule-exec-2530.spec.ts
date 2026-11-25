import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock } from './schedule-writes-mocks';
import { execRead, installExecMock, newExecMock, type ExecMock } from './schedule-exec-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-A2-EXEC-2530 pixel baselines: the read-only "status in WisKey" block of the schedule library's management view, classic skin,
// light and dark - off (the administrator's switch line) and on with one row per typical phase (run and verified, waiting for the
// owner, waiting for a second approval) - desktop 1440 and phone 390, against the mocked backend (deterministic data, fixed clock,
// performance:full). Element screenshots of the block only (the rest of the view is pinned by pixel-wiskey-schedule-writes.spec.ts).
// Linux baselines are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is skipped.
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const BLOCK = `${LIB} wk-schedule-exec`;
const ON = { 'access.ui.schedules': 'smplwise' };

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, scheme: 'light' | 'dark', over: Partial<ExecMock> = {}): Promise<void> {
  await installAccessMock(page, { settings: ON });
  await installSchedWritesMock(page, newSchedMock());
  await installExecMock(page, newExecMock(over));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#/wiskey/schedules?manage=1`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(`${LIB} [data-se-row="sch-contractors"]`, { timeout: 30_000 });
  await page.waitForSelector(`${BLOCK} [data-sx]`);
  await page.locator(BLOCK).scrollIntoViewIfNeeded();
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page.locator(BLOCK)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

function reads() {
  return [
    execRead('job-a1', 'executed', { job_status: 'verified', deployment_status: 'verified', steps_total: 2, steps_verified: 2 }),
    execRead('job-a2', 'waiting_owner', { job_status: 'blocked', code: 'schedule_writes_unverified' }),
    execRead('job-c1', 'review_pending', { job_status: 'ready', station_id: 'entry-c', reviews: { pending: 1, approved: 0, rejected: 0 } }),
  ];
}

test.describe('pixel: the read-only status in WisKey block', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme}: off`, async ({ page }, info) => {
      await open(page, scheme);
      await compare(page, info, `sched-exec-off-${scheme}`);
    });

    test(`classic ${scheme}: on, one row per phase`, async ({ page }, info) => {
      await open(page, scheme, { enabled: true, jobs: reads() });
      await compare(page, info, `sched-exec-rows-${scheme}`);
    });
  }
});
