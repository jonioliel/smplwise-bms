import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { newMock } from './nvr-cameras-write-mock';
import { settlePage } from './pixel-settle';
import { batchCameras, installBatch, newBatchMock } from './nvr-batch-mock';

// CR-020 phase D pixel baselines: the bulk encoding change's two new screens - the target settings form and the preview - in the four skins
// (classic, domus, tesla, bubble), desktop 1440 and phone 390, against the mocked backend (deterministic data, fixed clock, performance:full).
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a
// baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
//   ~/run_remote.sh spec <branch> tests/pixel-nvr-encoding-batch.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const PAGE = 'sw-app system-security system-security-cameras';
const DLG = `${PAGE} nvr-encoding-batch sw-dialog[open][data-nvr-enc]`;

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function toSettings(page: Page, skin: string) {
  await page.clock.setFixedTime(new Date('2026-10-04T09:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/system/security/cameras`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
  await page.evaluate(() => document.fonts.ready);
  await page.locator(`${PAGE} [data-nvr-encoding-open]`).click();
  await expect(page.locator(`${DLG} [data-nvr-enc-stream="cam-1:101"]`)).toHaveAttribute('aria-disabled', 'false');
  for (const k of ['cam-1:101', 'cam-1:102', 'cam-2:201', 'cam-3:301']) await page.locator(`${DLG} [data-nvr-enc-stream="${k}"]`).click();
  await page.locator(`${DLG} [data-nvr-enc-next]`).click();
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="codec-target"] [data-dropdown-chip]`).click();
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="codec-target"] [role="option"][data-id="H.264"]`).click();
  await page.locator(`${DLG} [data-nvr-enc-input="gop"]`).fill('25');
  await page.locator(`${DLG} [data-nvr-enc-input="gop"]`).blur();
  await settlePage(page);
}

test.describe('pixel: the bulk encoding change', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of SKINS) {
    // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
    test(`${skin} is pixel-stable: settings and preview`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      const st = newMock();
      st.canBatch = true;
      st.cameras = batchCameras(4, { h265: [2] });
      const bm = newBatchMock();
      bm.encSkip['cam-3:301'] = 'codec_not_offered';
      await installBatch(page, st, bm);
      await toSettings(page, skin);
      const settingsName = `enc-${skin}-settings-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
      if (noBaseline(info, settingsName)) test.info().annotations.push({ type: 'skipped-pixel', description: `${settingsName}: no baseline on ${process.platform}` });
      else await expect(page).toHaveScreenshot(settingsName, { maxDiffPixels: 40, animations: 'disabled' });
      await page.locator(`${DLG} [data-nvr-enc-preview]`).click();
      await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
      await settlePage(page);
      const previewName = `enc-${skin}-preview-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
      if (noBaseline(info, previewName)) test.info().annotations.push({ type: 'skipped-pixel', description: `${previewName}: no baseline on ${process.platform}` });
      else await expect(page).toHaveScreenshot(previewName, { maxDiffPixels: 40, animations: 'disabled' });
    });
  }
});
