import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock, type SchedMock } from './schedule-writes-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-SCHED-WRITE-2390 pixel baselines: the schedule library editor in the classic skin - the management view, the editor with a check
// result, the deploy preview with its impact, and the finished deploy progress - desktop 1440 and phone 390, against the mocked backend
// (deterministic data, fixed clock, performance:full). Baselines are per OS: the Linux ones are generated on the runner with
// `--update-snapshots`; on an OS without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
//   run_smart.py preview <branch> tests/pixel-wiskey-schedule-writes.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const ON = { 'access.ui.schedules': 'smplwise' };

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, over: Partial<SchedMock> = {}): Promise<SchedMock> {
  await installAccessMock(page, { settings: ON });
  const m = newSchedMock(over);
  await installSchedWritesMock(page, m);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/schedules?manage=1');
  await page.waitForSelector('sw-app');
  await page.waitForSelector(`${LIB} [data-se-row="sch-contractors"]`, { timeout: 30_000 });
  await settlePage(page);
  return m;
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  // the shell's top tab strip is masked: its horizontal scroll position after load is the shell's, not this screen's (a first-test-of-
  // the-worker variance seen on the phone in the runner run of 04.11), and it is pinned by the shell's own pixel specs
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [page.locator('sw-app sw-tabs').first()] });
}

test.describe('pixel: the schedule library editor', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('classic is pixel-stable: the library management view', async ({ page }, info) => {
    await open(page);
    await compare(page, info, 'sched-write-manage');
  });

  test('classic is pixel-stable: the editor with a passed check', async ({ page }, info) => {
    await open(page);
    await page.locator(`${LIB} [data-se-edit="sch-contractors"]`).click();
    await page.locator(`${LIB} [data-se-check-run]`).click();
    await page.waitForSelector(`${LIB} [data-se-check-result]`);
    await settlePage(page);
    await compare(page, info, 'sched-write-editor');
  });

  test('classic is pixel-stable: the deploy preview with its impact', async ({ page }, info) => {
    await open(page);
    await page.locator(`${LIB} [data-se-deploy="sch-contractors"]`).click();
    const drawer = `${LIB} sw-drawer[data-se-deploy-drawer="sch-contractors"]`;
    await page.locator(`${drawer} [data-se-pick="entry-b"] input`).check();
    await page.locator(`${drawer} [data-se-preview="entry-b"]`).click();
    await page.waitForSelector(`${drawer} [data-se-target="entry-b"][data-phase="previewed"] [data-se-impact]`);
    await settlePage(page);
    await compare(page, info, 'sched-write-deploy-impact');
  });

  test('classic is pixel-stable: the finished deploy progress', async ({ page }, info) => {
    await open(page, { failAt: new Set(['entry-b']) });
    await page.locator(`${LIB} [data-se-deploy="sch-contractors"]`).click();
    const drawer = `${LIB} sw-drawer[data-se-deploy-drawer="sch-contractors"]`;
    await page.locator(`${drawer} [data-se-pick="entry-a"] input`).check();
    await page.locator(`${drawer} [data-se-pick="entry-b"] input`).check();
    await page.locator(`${drawer} [data-se-preview-all]`).click();
    await page.waitForSelector(`${drawer} [data-se-target="entry-b"][data-phase="previewed"]`);
    await page.locator(`${drawer} [data-se-deploy-go]`).click();
    await page.locator(`${LIB} sw-dialog[data-se-confirm="deploy"] [data-se-confirm-send]`).click();
    await page.waitForSelector(`${drawer} [data-se-progress][data-done="true"]`, { timeout: 20_000 });
    await settlePage(page);
    await compare(page, info, 'sched-write-deploy-done');
  });
});
