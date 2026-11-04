import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { DESKTOP, FOLD_INNER, FOLD_INNER_TURNED, asDevice, expectWall, install, newMock, wall } from './wall-followups-mocks';

// WALL-FOLLOWUPS-2390 (display D5) pixel baselines: the NEW states only - the wall on a desktop monitor ("wall mode on desktop"),
// the wall on an unfolded foldable's inner screen in both orientations, and the drawer's user section with the new switch on.
// Mocked backend, fixed clock, classic skin. The camera tiles are masked: what this slice drew is the geometry around them (strip,
// grid, gaps, scale), not the video placeholder of sw-camera-tile. Baselines are per OS: the Linux ones are written on the runner
//   run_smart.py preview <branch> tests/pixel-wall-followups-2390.spec.ts --project=desktop --update-snapshots=changed --workers=1
// and on an OS without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule).
const NOW = new Date('2026-11-04T08:00:00Z'); // 10:00 in Israel

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function check(target: Page | Locator, info: Parameters<typeof noBaseline>[0] & { annotations: { type: string; description?: string }[] }, name: string, mask: Locator[] = []) {
  if (noBaseline(info, name)) info.annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
  else await expect(target).toHaveScreenshot(name, { maxDiffPixels: 40, animations: 'disabled', mask, maskColor: '#3a3f4b' });
}

async function wallReady(page: Page) {
  await expect(wall(page).locator('[data-wall-health]').first()).not.toHaveAttribute('data-tone', 'stale'); // the health read landed
  // every tile has reached its final mocked state (no media -> stale with the frozen time), so the badges never race the shot
  await expect(wall(page).locator('[data-wall-tile]:not([data-health="stale"])')).toHaveCount(0, { timeout: 20_000 });
  await page.mouse.move(0, 0);
  await settlePage(page);
}

test.describe('pixel: the wall display follow-ups', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`classic is pixel-stable: the wall on a desktop monitor, 6 cameras, ${theme} wall`, async ({ page }, info) => {
      await page.clock.setFixedTime(NOW);
      await install(page, newMock({ desktop: true, cams: 6, theme }));
      await asDevice(page, DESKTOP);
      await page.goto('/?design=a&look=performance:full#/');
      await expectWall(page, 'tablet-landscape');
      await wallReady(page);
      await check(page, info, `wall-desktop-${theme}.png`, [wall(page).locator('sw-camera-tile')]);
    });
  }

  for (const [name, dev, preset] of [['portrait', FOLD_INNER, 'tablet-portrait'], ['landscape', FOLD_INNER_TURNED, 'tablet-landscape']] as const) {
    test(`classic is pixel-stable: the wall on an unfolded foldable, ${name}`, async ({ page }, info) => {
      await page.clock.setFixedTime(NOW);
      await install(page, newMock({ cams: 4 }));
      await asDevice(page, dev);
      await page.goto('/?design=a&look=performance:full#/');
      await expectWall(page, preset);
      await wallReady(page);
      await check(page, info, `wall-fold-inner-${name}.png`, [wall(page).locator('sw-camera-tile')]);
    });
  }

  test('classic is pixel-stable: the wall drawer\'s user section with "מסך קיר גם במחשב" on', async ({ page }, info) => {
    await page.clock.setFixedTime(NOW);
    await install(page, newMock({ admin: true, desktop: true, scheme: 'light' }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-reception"]').first().click();
    const section = page.locator('sw-drawer[data-wall-drawer] [data-wall-section="user"]');
    await expect(section.locator('[data-wall-desktop-note]')).toBeVisible();
    await settlePage(page);
    await check(section, info, 'wall-settings-user-desktop.png');
  });
});
