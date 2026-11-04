import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { FOLDS, installCardsMock, openAccess } from './settings-cards-mocks';
import { settlePage } from './pixel-settle';

// SETTINGS-CARDS-ACCORDION-2402 pixel baseline, the NEW state only: Settings › "מתגי מסכי כניסה" in layout "כרטיסים: נפתחים במקום"
// (accordion) at 1366x768 with the stations-screen display card open in place - classic light, mocked backend, fixed clock,
// performance:full. The phone is not imaged here: the phone layout does not change (layout-settings-cards-accordion-2402 compares it).
// Baselines are per OS (Linux ones from the runner with `--update-snapshots`); without one the check is skipped.
//   ~/run_remote.sh spec <branch> tests/pixel-settings-cards-accordion-2402.spec.ts --project=desktop [--update-snapshots]

const noBaseline = (name: string) => {
  const info = test.info();
  return !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
};

test.describe('pixel: SETTINGS-CARDS-ACCORDION-2402', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('accordion: the display card open in place at 1366x768 is pixel-stable', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a desktop size');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await installCardsMock(page, { layout: 'accordion' });
    await openAccess(page);
    await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
    await expect(page.locator(`${FOLDS} [data-fold-summary="calls"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
    await expect(page.locator(`${FOLDS} [data-fold-summary="pairing"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
    const head = page.locator(`${FOLDS} [data-fold-toggle="display"]`);
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(0, 0);
    await settlePage(page);
    const file = 'accordion-display-1366.png';
    if (noBaseline(file)) {
      info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      return;
    }
    await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  });
});
