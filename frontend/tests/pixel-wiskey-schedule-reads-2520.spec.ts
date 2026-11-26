import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW } from './access-control-mocks';
import { installSchedWritesMock, newRead, newSchedMock, type SchedMock } from './schedule-writes-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-SCHED-READS-2520 pixel baselines: the signed schedule reads block of the schedule library's management view, in the classic
// skin, light and dark - unsupported (the default) and supported with one row per honest state - desktop 1440 and phone 390, against
// the mocked backend (deterministic data, fixed clock, performance:full). Element screenshots of the block only (the rest of the view
// is pinned by pixel-wiskey-schedule-writes.spec.ts). Linux baselines are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const BLOCK = `${LIB} wk-schedule-reads`;
const ON = { 'access.ui.schedules': 'smplwise' };
const SUPPORTED = { state: 'supported', reason: null, contract: 'wiskey-schedule-reads.v1' };

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, scheme: 'light' | 'dark', over: Partial<SchedMock> = {}): Promise<void> {
  await installAccessMock(page, { settings: ON });
  await installSchedWritesMock(page, newSchedMock(over));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#/wiskey/schedules?manage=1`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(`${LIB} [data-se-row="sch-contractors"]`, { timeout: 30_000 });
  await page.waitForSelector(`${BLOCK} [data-sr]:not([data-sr-state="loading"])`);
  await page.locator(BLOCK).scrollIntoViewIfNeeded();
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page.locator(BLOCK)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

function rows() {
  return [
    newRead('readiness', 'entry-a', 'completed', { created_at: '2026-09-27T10:29:00Z' }),
    newRead('dependencies', 'entry-b', 'running', { created_at: '2026-09-27T10:28:00Z' }),
    newRead('readiness', 'entry-b', 'unknown', { created_at: '2026-09-27T10:27:00Z', wiskey_code: 'media_outcome_unknown' }),
    newRead('dependencies', 'entry-a', 'refused', { created_at: '2026-09-27T10:26:00Z', wiskey_code: 'station_offline' }),
  ];
}

// RELEASE-2520-TRAIN: every case title carries "pixel-stable" - the gate's pixel step runs --grep pixel-stable (gate run 1:
// pixel_53 "No tests found" for this file)
test.describe('pixel: the signed schedule reads block', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme} is pixel-stable: unsupported`, async ({ page }, info) => {
      await open(page, scheme);
      await compare(page, info, `sched-reads-unsupported-${scheme}`);
    });

    test(`classic ${scheme} is pixel-stable: supported, one row per state`, async ({ page }, info) => {
      await open(page, scheme, { readsSupport: SUPPORTED, reads: rows() });
      await compare(page, info, `sched-reads-rows-${scheme}`);
    });
  }
});
