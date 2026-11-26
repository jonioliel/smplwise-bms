import { test, expect, type Locator, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { CHANGE_ID, NOTIFY, installUndo, openSetup } from './nvr-undo-mock';
import { settlePage } from './pixel-settle';

// LISTENER-DEADLINE-2540 pixel baselines: the NVR change log's "revert anyway" confirmation (the shared confirmation dialog, danger, focus
// on cancel) and the amber reason line of a `changed_since` refusal, against the mocked backend (tests/nvr-undo-mock.ts; fixed clock,
// performance:full). The ELEMENT is compared (the dialog panel, the result line), not the page behind it. Desktop 1440 and phone 390, light
// and dark. "pixel-stable" in every title: the release gate runs its pixel group with --grep pixel-stable.
// Baselines are per OS: the Linux ones are generated on the runner; on an OS without a baseline the check is skipped, not failed:
//   npx playwright test tests/pixel-nvr-undo-force-2540.spec.ts --project=desktop --project=mobile --update-snapshots

const wide = (info: TestInfo) => (info.project.name === 'mobile' ? '390' : '1440');
const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(el: Locator, info: TestInfo, name: string) {
  await settlePage(el.page());
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(el).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('NVR revert-anyway pixels', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme} is pixel-stable: the revert-anyway confirmation and the changed-since reason`, async ({ page }, info) => {
      await installUndo(page, { mode: 'changed_since' });
      await page.clock.setFixedTime(new Date('2026-10-04T09:00:00Z'));
      await openSetup(page, `&skin=classic&scheme=${scheme}&look=performance:full`);
      const card = page.locator(NOTIFY);
      const revert = card.locator(`[data-nvr-rollback="${CHANGE_ID}"]`);
      await expect(revert).toBeVisible({ timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await revert.click();
      const box = page.locator('sw-confirm-dialog sw-dialog .box[role="dialog"]');
      await expect(box).toBeVisible();
      await compare(box, info, `undo-confirm-${scheme}`);
      await page.locator('sw-confirm-dialog [data-confirm-cancel]').click();
      await expect(page.locator('sw-confirm-dialog')).toHaveCount(0);
      const msg = card.locator('[data-nvr-result="warn"]');
      await expect(msg).toBeVisible();
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        let a: Element | null = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        (a as HTMLElement | null)?.blur?.();
      });
      await page.waitForTimeout(300);
      await compare(msg, info, `undo-reason-${scheme}`);
    });
  }
});
