import { test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHonestHome, type HonestCase } from './honest-states-2540-mocks';

// HONEST-STATES-2540: before / after captures for the owner's compare page (not a gate). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<size>-<scheme>-<state>.png. The same file runs against the build before the change (phase "before")
// and after it. Desktop 1440x900 and phone 390x844, light and dark. Mocked backend (tests/honest-states-2540-mocks.ts).

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/honest_states_compare_2026-11-25';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const SIZES: [string, number, number][] = [['desktop', 1440, 900], ['phone', 390, 844]];
const NOW = new Date('2026-11-03T10:00:00+02:00');

async function open(page: Page, c: HonestCase, scheme: 'light' | 'dark', route: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await mockHonestHome(page, c, { theme: scheme === 'dark' ? 'midnight' : 'classic', scheme });
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await page.locator('sw-home').locator('.hs.v2').waitFor();
  await page.waitForTimeout(1200);
  await settle(page);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${PHASE}-${name}.png` });
}

test.describe('HONEST-STATES-2540 captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only with SW_SHOTS=1');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per capture'); });

  for (const [size, w, h] of SIZES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size} ${scheme}: home, doors, alarm`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await open(page, 'offline', scheme, 'r/home');
        await shot(page, `${size}-${scheme}-home`);
        await open(page, 'offline', scheme, 'doors');
        await shot(page, `${size}-${scheme}-doors`);
        await open(page, 'mixed', scheme, 'security');
        await shot(page, `${size}-${scheme}-alarm`);
      });
    }
  }
});
