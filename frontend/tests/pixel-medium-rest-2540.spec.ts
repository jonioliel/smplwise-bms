import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { TABLET_L, asDevice, expectWall, wall } from './wall-followups-mocks';
import { mockMotionCamera, mockWalls, openMotionConfirm } from './medium-rest-2540-mocks';

// MEDIUM-REST-2540 pixel baselines (titles carry `pixel-stable`: the gate's pixel shard runs only those), mocked backends, a fixed clock:
//   - the kiosk's counters row with the system tile following the health summary ("שגיאה", red) - desktop 1440 and phone 390;
//   - the motion-detection confirmation's change line (old -> new in the reading direction) - desktop and phone;
//   - the wall display's quiet "new version" notice - a landscape tablet (the wall's own device; desktop project).
// Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is
// skipped, not failed. Same raster rules as pixel-honest-states-2540 (grayscale text, fonts loaded first).
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-26T10:00:00+02:00');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, el: Locator, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  await page.evaluate(async () => { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Heebo`, 'אבג abc 123'))); await document.fonts.ready; });
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(el).toHaveScreenshot(file, { maxDiffPixels: 250, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel: MEDIUM-REST-2540', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(NOW);
  });

  test('pixel-stable: kiosk counters with the system tile from the health summary', async ({ page }, info) => {
    await mockWalls(page, {}, 'error');
    await page.goto('/?design=a#/kiosk/all?cols=2&rows=2');
    const stats = page.locator('kiosk-wall .stats');
    await expect(stats.locator('[data-word]')).toHaveText('שגיאה');
    await compare(page, info, stats, 'mr-kiosk-stats');
  });

  test('pixel-stable: motion confirmation change line', async ({ page }, info) => {
    await mockMotionCamera(page, 40);
    const dlg = await openMotionConfirm(page, 60);
    const line = dlg.locator('div:has(> [data-motion-change="sensitivity"])');
    await expect(line).toBeVisible();
    await compare(page, info, line, 'mr-motion-change');
  });

  test('pixel-stable: wall display new-version notice', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the wall runs on its own device, emulated here');
    await mockWalls(page, { admin: false, wall: true, cams: 4 }, 'ok', '99.0.0');
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expectWall(page);
    const note = wall(page).locator('[data-wall-new-build]');
    await expect(note).toBeVisible();
    await compare(page, info, note, 'mr-wall-newbuild');
  });
});
