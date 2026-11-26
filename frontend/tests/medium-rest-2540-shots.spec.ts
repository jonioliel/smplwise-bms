import { test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { TABLET_L, asDevice, expectWall } from './wall-followups-mocks';
import { mockMotionCamera, mockWalls, openMotionConfirm } from './medium-rest-2540-mocks';

// MEDIUM-REST-2540: before / after captures for the owner's compare page (not a gate). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<name>.png. The same file runs against the build before the change (phase "before") and after it.
// Mocked backends (tests/medium-rest-2540-mocks.ts); nothing here uses a selector that only the new build has.

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/medium_rest_2540_compare';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const NOW = new Date('2026-11-26T10:00:00+02:00');

async function shot(page: Page, name: string) {
  await settle(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${PHASE}-${name}.png` });
}

test.describe('MEDIUM-REST-2540 captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only with SW_SHOTS=1');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'sizes are set per capture');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(NOW);
  });

  for (const [size, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size} ${scheme}: kiosk with a recorder fault and an offline camera`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        const st = await mockWalls(page, {}, 'error');
        st.offline.add('cam-2');
        await page.goto(`/?design=a&scheme=${scheme}#/kiosk/all?cols=2&rows=2`);
        await page.locator('kiosk-wall .stats').waitFor();
        await page.locator('kiosk-wall [data-kiosk-health]').waitFor();
        await shot(page, `kiosk-${size}-${scheme}`);
      });
    }
    for (const lang of ['he', 'en'] as const) {
      test(`${size} ${lang}: motion confirmation 40 -> 60`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        if (lang === 'en') await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* private mode */ } });
        await mockMotionCamera(page, 40);
        await openMotionConfirm(page, 60);
        await shot(page, `motion-${size}-${lang}`);
      });
    }
  }

  test('tablet: wall display after an add-on update (server 99.0.0)', async ({ page }) => {
    await mockWalls(page, { admin: false, wall: true, cams: 4 }, 'ok', '99.0.0');
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expectWall(page);
    await page.waitForTimeout(1500);
    await shot(page, 'wall-tablet');
  });
});
