import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { NOW } from './access-control-mocks';
import { settlePage } from './pixel-settle';
import { installDiagMock, type DiagOptions } from './wiskey-access-diag-mocks';

// WISKEY-ACCESS-DIAG-2400 pixel baselines: "אבחון הרשאות" - the scenario's answer, a comparison of two people, a review with the decision
// form, the lifecycle window and a station permission audit - classic light, desktop 1440 and phone 390, against the mocked backend
// (fixed clock, performance:full; tests/wiskey-access-diag-mocks.ts). Baselines are per OS, generated on the runner and reviewed image by
// image; until they exist the checks are skipped (annotated), never failed on a missing file.
//   run_smart.py spec <branch> tests/pixel-wiskey-access-diag.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'sw-app wiskey-access-diag';

const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', fullPage: false });
}

async function open(page: Page, view = '', o: DiagOptions = {}) {
  await installDiagMock(page, o);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/access-diag${view ? `?view=${view}` : ''}`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page[data-diag-state="ready"]`)).toBeVisible({ timeout: 30_000 });
}

async function pick(page: Page, slot: string, text: string, id: string) {
  await page.locator(`${SCREEN} input[data-diag-picker="${slot}"]`).fill(text);
  await page.locator(`${SCREEN} [data-diag-options="${slot}"] [data-diag-option="${id}"]`).click();
  await expect(page.locator(`${SCREEN} [data-diag-chosen="${slot}"]`)).toBeVisible();
}

test.describe('pixel: אבחון הרשאות', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('classic is pixel-stable: "can X open door Y" with its explanation', async ({ page }, info) => {
    await open(page);
    await pick(page, 'scenario', 'דנה', 'p1');
    await page.locator(`${SCREEN} select[data-diag-door="scenario"]`).selectOption('entry-b:2');
    await page.locator(`${SCREEN} sw-button[data-diag-check]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-answer="no"]`)).toBeVisible();
    await page.locator(`${SCREEN} [data-diag-answer]`).scrollIntoViewIfNeeded();
    await shoot(page, info, 'diag-scenario-answer');
  });

  test('classic is pixel-stable: two people compared', async ({ page }, info) => {
    await open(page, 'compare');
    await pick(page, 'left', 'דנה', 'p1');
    await pick(page, 'right', 'יוסי', 'p2');
    await page.locator(`${SCREEN} sw-button[data-diag-run]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-comparison] [data-diag-row]`)).toHaveCount(4);
    await shoot(page, info, 'diag-compare-people');
  });

  test('classic is pixel-stable: a periodic review with the decision form', async ({ page }, info) => {
    await open(page, 'reviews');
    await expect(page.locator(`${SCREEN} [data-diag-review]`)).toHaveCount(3);
    await shoot(page, info, 'diag-reviews-list');
    await page.locator(`${SCREEN} [data-diag-review="p1"] sw-button[data-diag-open-review]`).click();
    const dialog = page.locator(`${SCREEN} sw-dialog[data-diag-review-dialog]`);
    await expect(dialog.locator('[data-diag-decide]')).toBeVisible();
    await dialog.locator('textarea[data-diag-reason]').fill('נבדק מול רשימת העובדים');
    await shoot(page, info, 'diag-review-dialog');
  });

  test('classic is pixel-stable: who loses access in the next 30 days', async ({ page }, info) => {
    await open(page, 'lifecycle');
    await expect(page.locator(`${SCREEN} [data-diag-lifecycle]`)).toBeVisible();
    await shoot(page, info, 'diag-lifecycle');
  });

  test('classic is pixel-stable: a station permission audit', async ({ page }, info) => {
    await open(page, 'audit');
    await page.locator(`${SCREEN} sw-button[data-diag-run-audit]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-audit] [data-diag-audit-row]`)).toHaveCount(4);
    await shoot(page, info, 'diag-audit');
  });
});
