import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installDtMock, newDtMock } from './wiskey-door-tech-mocks';

// WISKEY-DOOR-TECH-2390 pixel baselines: the door technical dialog of the stations drawer, desktop 1440 and phone 390, against the mocked
// backend (invented stations, fixed clock, performance:full), default skin: the hold-open schedules list, the schedule editor with its
// confirmation, the public code form (typed phrase, no value ever drawn) and the programs. Linux baselines are generated on the runner
// with `--update-snapshots`; on an OS without a baseline the check is skipped (the design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-door-tech.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'wiskey-stations';
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
const inDt = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] wk-door-tech ${sel}`);

async function shoot(page: Page, info: TestInfo, name: string, endAt?: string) {
  // a fixed scroll: the dialog's body at its top (a click or a focus may have scrolled it by a run-dependent amount)
  await inDt(page, 'sw-dialog[data-wk-dt-dialog]').evaluate((d) => {
    const body = d.shadowRoot?.querySelector<HTMLElement>('.body');
    if (body) body.scrollTop = 0;
  });
  if (endAt) await inDt(page, endAt).evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function openDialog(page: Page) {
  const base = newMock();
  await installStationsMock(page, base);
  await installDtMock(page, base, newDtMock());
  await openStations(page, { skin: 'classic', scheme: 'light' });
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await settlePage(page);
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`).click();
  await page.locator(`${SCREEN} sw-drawer [data-wk-settings-toggle]`).click();
  await inDt(page, '[data-wk-dt-open]').click();
  await expect(inDt(page, 'sw-dialog[data-wk-dt-dialog][data-wk-dt-state="ready"]')).toHaveCount(1, { timeout: 15_000 });
}

test.describe('pixel: the door technical dialog', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('classic is pixel-stable: the door technical dialog - schedules, the editor and its confirmation', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await openDialog(page);
    await expect(inDt(page, '[data-wk-dt-hold="1"]')).toContainText('שעות לובי');
    await shoot(page, info, 'door-tech-hold');
    await inDt(page, '[data-wk-dt-hold-edit="2"]').click();
    await inDt(page, '[data-wk-dt-name]').fill('מחסום ערב');
    await inDt(page, '[data-wk-dt-add-period="Sunday"]').click();
    await inDt(page, '[data-wk-dt-save]').click();
    await expect(inDt(page, '[data-wk-dt-confirm="hold_save"]')).toBeVisible();
    await shoot(page, info, 'door-tech-confirm', '[data-wk-dt-confirm="hold_save"]');
  });

  test('classic is pixel-stable: the door technical dialog - the public code form and the programs', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await openDialog(page);
    await inDt(page, '[data-wk-dt-tab="codes"]').click();
    await inDt(page, '[data-wk-dt-code-set="2"]').click();
    await expect(inDt(page, '[data-wk-dt-code-form="2"]')).toBeVisible();
    await shoot(page, info, 'door-tech-code');
    await inDt(page, '[data-wk-dt-code-cancel]').click();
    await inDt(page, '[data-wk-dt-tab="programs"]').click();
    await expect(inDt(page, '[data-wk-dt-program="2"][data-state="on"]')).toBeVisible();
    await shoot(page, info, 'door-tech-programs');
  });
});
