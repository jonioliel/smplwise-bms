import { test } from '@playwright/test';
import { installBv1Mock, BV1_NOW } from './bv1-mocks';

// HAND-SWITCH-HOME-EDIT-2500: before / after captures of the installation's home editor (`#/devices/building?edit=1`, the "בית" tab of
// the edit drawer) for the owner's compare page (not a gate). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<size>-<scheme>.png over the BV1 mocks (tests/bv1-mocks.ts: an invented home, no backend; the media
// widget is off there, so an "off" row is in the picture). The same file runs against the build before the change (each widget row's
// "הצג" and its phone line's "הצג" are check boxes) and after it (the compact switch). Desktop 1440x900 (side drawer) and phone 390x844
// (bottom sheet), light and dark.
//   SW_SHOTS=1 SW_SHOTS_PHASE=after SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/hand-switch-home-edit-2500-shots.spec.ts --project=desktop --workers=1

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/hand_switch_home_edit_compare_2026-11-24';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const SIZES: [string, number, number][] = [['desktop', 1440, 900], ['phone', 390, 844]];

test.describe('HAND-SWITCH-HOME-EDIT-2500 captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only with SW_SHOTS=1');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per capture'); });

  for (const [size, w, h] of SIZES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size} ${scheme}: the home editor, the widget rows`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await installBv1Mock(page);
        await page.clock.setFixedTime(new Date(BV1_NOW));
        await page.goto(`/?design=a&skin=classic&scheme=${scheme}#/devices/building?edit=1`);
        const drawer = page.locator('sw-app devices-building [data-home-drawer]');
        await drawer.waitFor({ timeout: 20_000 });
        // the widget list: the first rows (one of them off) in view inside the drawer's own scroll
        const first = drawer.locator('home-edit-panel [data-home-wrow]').first();
        await first.waitFor({ timeout: 15_000 });
        await first.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${PHASE}-${size}-${scheme}.png` });
        // a closer look at the rows themselves (the drawer at 1440, the sheet on the phone)
        await drawer.screenshot({ path: `${OUT}/${PHASE}-${size}-${scheme}-drawer.png` });
      });
    }
  }
});
