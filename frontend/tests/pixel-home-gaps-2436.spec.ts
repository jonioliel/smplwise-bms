import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockGaps, type GapOpts } from './home-v3-gaps-mocks';

// HOME-V3-GAPS-2436 pixel baselines (titles carry `pixel-stable`: the gate's pixel shard runs only those): the screens this branch changed - "ההתראות שלי" with the personal alarm code row, the home diary's
// "אזעקה" filter, "מערכות הבית" with "דווח על תקלה" and the new-ticket sheet opened from a leak - desktop 1440 and phone 390, light
// and dark, mocked backend, a fixed clock and mock stamps relative to that clock (never an hour of the real day). Baselines are per OS:
// the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   private/runner/run_smart.py preview <branch> tests/pixel-home-gaps-2436.spec.ts --project=desktop --project=mobile -u --workers=1

// HOME-V3-AUDITFIX-2437: grayscale text antialiasing, always. The "bold Hebrew raster flip" (49-352 px) is Chromium switching between
// grayscale and subpixel (LCD, coloured fringes) text antialiasing from run to run: the gate's failing dark shot was LCD against a
// grayscale baseline, and the committed baselines held both kinds. Chromium uses LCD text only in an opaque, non-animating layer, so
// the choice follows the compositing state at the moment of the shot (likely the screen-entry animation `.hs-main.enter > *`, kept
// until the next render). With LCD text off every run draws the same glyph pixels.
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, route: string, o: GapOpts, scheme: 'light' | 'dark') {
  await mockGaps(page, { now: NOW.getTime(), ...o });
  // the theme comes from the person's stored layout, as in the product: writing the host attributes after load raced the layout's own
  // apply (the first runner check saw light shots drawn dark)
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

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, sel: string, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  // HOME-V3-AUDITFIX-2437: every Heebo weight / subset loaded before the shot - a bold Hebrew glyph drawn before its file arrived
  // (a lazily loaded unicode-range face) differed run to run on a loaded runner
  await page.evaluate(async () => { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Heebo`, 'אבג abc 123'))); await document.fonts.ready; });
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(home(page).locator(sel)).toHaveScreenshot(file, { maxDiffPixels: 250 /* the runner rasterises bold Hebrew glyphs two ways run to run (49-213 px seen; AUDITFIX-2437 uses the same) */, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel: home v3 gaps (alarm code row, diary alarm filter, report a fault)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`pixel-stable: my notifications with the alarm code ${scheme}`, async ({ page }, info) => {
      await open(page, 'notif', {}, scheme);
      await expect(home(page).locator('[data-gap-pin]')).toBeVisible();
      await compare(page, info, '#main', `home-gaps-notif-${scheme}`);
    });

    test(`pixel-stable: diary alarm filter ${scheme}`, async ({ page }, info) => {
      await open(page, 'events', {}, scheme);
      await home(page).locator('[data-act="evTab"][data-v="alarm"]').click();
      await expect(home(page).locator('[data-diary="alarm"]')).toHaveCount(3);
      await compare(page, info, '#main', `home-gaps-diary-alarm-${scheme}`);
    });

    test(`pixel-stable: house systems with report a fault ${scheme}`, async ({ page }, info) => {
      await open(page, 'systems', { systems: 'bad' }, scheme);
      await home(page).locator('[data-gap-ticket="fault"]').click();
      await expect(home(page).locator('[data-sheet="tkNew"]')).toBeVisible();
      await compare(page, info, '[data-sheet="tkNew"]', `home-gaps-fault-sheet-${scheme}`);
    });
  }
});
