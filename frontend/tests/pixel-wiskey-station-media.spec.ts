import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock, type StationMediaMock } from './wiskey-station-media-mocks';

// CR-036 slice S18 pixel baselines: a station's drawer with the live video (a drawn canvas through the fake media stack) and the
// push-to-talk, desktop 1440 and phone 390, against the mocked backend (fixed clock, performance:full). Every skin the build has:
// the idle drawer; the classic skin also: talking (countdown + end), busy, and a station without talk (the classic link).
// Baselines are per OS and are NOT committed by the slice that wrote this spec: they are generated on the runner and reviewed
// image by image; until they exist the checks are skipped (annotated), never failed on a missing file.
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-station-media.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'wiskey-stations';

const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function toDrawer(page: Page, skin: string, over: Partial<StationMediaMock> = {}, station = 'gate', scheme: 'light' | 'dark' = 'light') {
  const base = newMock();
  await installStationsMock(page, base);
  await installStationMediaMock(page, base, newMediaMock({ mode: 'video_talk', ...over }));
  await openStations(page, { skin, scheme });
  await page.waitForSelector(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`, { timeout: 30_000 });
  // GATE-FIX-2270 (the STATIONS-FLAKE-2270 cause in this spec): the drawer shot shows the page behind it, and the click that opens
  // the drawer scrolls its card into view from wherever the R5 entrance motion has it at that moment. Let the entrance finish first,
  // and on the desktop put the shell's scroll back where every desktop baseline was taken (the top) once the drawer is open.
  await settlePage(page);
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${station}"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
  // the phone's lobby baseline (no-talk) shows the lobby card 1 px above the top edge of the screen behind the sheet; the gate card's shots
  // (talking, busy, drawer) already land at one offset once the entrance has settled and are left as they are
  const phone = page.viewportSize()?.width === 390;
  if (!phone || station === 'lobby') {
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${station}"]`).evaluate((card, at) => {
      const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
      if (!main) return;
      main.scrollTop = at === null ? 0 : Math.max(0, Math.round(main.scrollTop + card.getBoundingClientRect().top - at));
    }, phone ? -1 : null);
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
  await page.evaluate(() => document.fonts.ready);
}

const player = (page: Page) => page.locator(`${SCREEN} sw-drawer wk-station-live sw-live-player`);
const playing = (page: Page) => expect.poll(() => player(page).evaluate((el) => (el as unknown as { status: string }).status), { timeout: 15_000 }).toBe('playing');

async function shoot(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  // the live picture itself is a moving canvas: masked, the frame around it is what is compared
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [player(page)] });
}

test.describe('pixel: station live video and push-to-talk', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of SKIN_IDS) {
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the drawer with live video and push-to-talk'), async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      const check = skinCheck(page, skin);
      await toDrawer(page, skin);
      await playing(page);
      await check(() => shoot(page, info, `station-media-${skin}-drawer`), player(page));
    });
  }

  test('classic is pixel-stable: talking, busy, and a station without talk', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await toDrawer(page, 'classic');
    await playing(page);
    const btn = page.locator(`${SCREEN} sw-drawer wk-talk-button [data-wk-ptt]`);
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up(); // WKF01F02-295: one click opens a full-duplex talk (no press-and-hold)
    await expect(btn).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
    await shoot(page, info, 'station-media-classic-talking');
    await page.goto('about:blank');
    await toDrawer(page, 'classic', { busy: true });
    await playing(page);
    await shoot(page, info, 'station-media-classic-busy');
    await page.goto('about:blank');
    await toDrawer(page, 'classic', { station: { lobby: 'video_only' } }, 'lobby');
    await playing(page);
    await shoot(page, info, 'station-media-classic-no-talk');
  });
});

// AVPIXEL-295 retargeted (MEDIACARD-297, owner choice 2026-10-26: "the WisKey media drawer, dark / tablet", not the multimedia screens):
// the same station drawer as above - the one media panel the product has for a station's video and talk - in the dark scheme on all
// three viewports, and in the light scheme on the tablet (the block above covers light on desktop and phone). Separate file names
// (`-dark-` / `-1024-`), so none of the baselines above is touched.
const WIDTH: Record<string, number> = { desktop: 1440, tablet: 1024, mobile: 390 };

async function shootAt(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${WIDTH[info.project.name] ?? 1440}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [player(page)] });
}

test.describe('pixel: station live video and push-to-talk, dark and tablet', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of SKIN_IDS) {
    // GATELANES-297 policy (2.24.1 integration): pixels for the skins in helpers/pixel-skins.ts (classic, domus) only; tesla / crystal
    // run the same case as the structural smoke, their MEDIACARD-297 baselines were deleted
    test(pixelTitle(skin, 'the drawer with live video and push-to-talk, dark'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await toDrawer(page, skin, {}, 'gate', 'dark');
      await playing(page);
      await check(() => shootAt(page, info, `station-media-${skin}-drawer-dark`), player(page));
    });

    test(pixelTitle(skin, 'the drawer with live video and push-to-talk, light tablet'), async ({ page }, info) => {
      test.skip(info.project.name !== 'tablet', 'light desktop and phone are the block above');
      const check = skinCheck(page, skin);
      await toDrawer(page, skin);
      await playing(page);
      await check(() => shootAt(page, info, `station-media-${skin}-drawer-light`), player(page));
    });
  }

  test('classic is pixel-stable: talking, dark', async ({ page }, info) => {
    await toDrawer(page, 'classic', {}, 'gate', 'dark');
    await playing(page);
    const btn = page.locator(`${SCREEN} sw-drawer wk-talk-button [data-wk-ptt]`);
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up(); // WKF01F02-295: one click opens a full-duplex talk
    await expect(btn).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
    await shootAt(page, info, 'station-media-classic-talking-dark');
  });
});
