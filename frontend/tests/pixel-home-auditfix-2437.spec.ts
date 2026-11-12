import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockGaps, type GapOpts } from './home-v3-gaps-mocks';

// HOME-V3-AUDITFIX-2437 pixel baselines: the screens the round-30 audit fixes changed - the phone recordings header with the day stepper,
// the phone alarm screen, the cameras screen's state words, and (desktop project, viewport set here) the portrait tablet 768 room screen
// and the wall panel's recordings header with the named camera stepper. Light and dark, mocked backend, a fixed clock, stamps relative to
// it. Linux baselines are generated on the runner with --update-snapshots; on an OS without a baseline the check is skipped, not failed.
//   private/runner/run_smart.py preview <branch> tests/pixel-home-auditfix-2437.spec.ts --project=desktop --project=mobile -u --workers=1

const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, route: string, o: GapOpts, scheme: 'light' | 'dark') {
  await mockGaps(page, { now: NOW.getTime(), ...o });
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.getAttribute('data-hs-scheme'))).toBe(scheme);
  await settle(page);
}

// 250 px: on the loaded runner a few bold Hebrew glyphs rasterise in one of two ways from run to run (~100-210 px on a 768x1024 shot, seen
// with the same baseline and every font face loaded); a layout change moves thousands of pixels
async function compare(page: Page, info: Parameters<typeof noBaseline>[0], sel: string, file: string) {
  // HOME-V3-AUDITFIX-2437: every Heebo weight / subset loaded before the shot - a bold Hebrew glyph drawn before its file arrived
  // (a lazily loaded unicode-range face) differed run to run on a loaded runner
  await page.evaluate(async () => { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Heebo`, 'אבג abc 123'))); await document.fonts.ready; });
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(home(page).locator(sel)).toHaveScreenshot(file, { maxDiffPixels: 250, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel: home v3 audit fixes (round 30)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  for (const scheme of ['light', 'dark'] as const) {
    test(`phone: recordings, alarm, cameras ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone screens');
      await open(page, 'playback/cam1', {}, scheme);
      await expect(home(page).locator('.hs-head .pb-days')).toBeVisible();
      await compare(page, info, '.hs-head', `auditfix-playback-head-${scheme}-390.png`);
      await open(page, 'security', {}, scheme);
      await compare(page, info, '#main', `auditfix-alarm-${scheme}-390.png`);
      await open(page, 'cameras', {}, scheme);
      await expect(home(page).locator('.cam-t .cap [data-cam-mode="still"]').first()).toBeVisible();
      await compare(page, info, '#main', `auditfix-cameras-${scheme}-390.png`);
    });

    test(`portrait tablet 768 room and wall recordings head ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'viewport set here');
      await page.setViewportSize({ width: 768, height: 1024 });
      await open(page, 'r/living', {}, scheme);
      await compare(page, info, '.hs', `auditfix-room-${scheme}-768.png`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, 'playback/cam1', {}, scheme);
      await expect(home(page).locator('.hs-head .pb-cams .pbc')).toBeVisible();
      await compare(page, info, '.hs-head', `auditfix-playback-head-${scheme}-1280.png`);
    });
  }
});
