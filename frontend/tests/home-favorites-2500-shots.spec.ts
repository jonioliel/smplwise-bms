import { test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockFavs, type FavOpts } from './home-favorites-2500-mocks';

// HOME-FAVORITES-2500: the before / after captures for private/planning/home_favorites_2500_compare_2026-11-23.html (tablet 1024 x 768
// and phone 390). The same spec runs against the 2.47.0 build (SW_SHOT_TAG=before) and this branch (after); a step the old build does not
// have (a hole, the drag, the suggestion, the scene sheet) is captured as whatever that build shows. Mocked backend.
// Output: test-results/home-favorites-2500/<tag>-<name>-<size>.png

const TAG = process.env.SW_SHOT_TAG || 'after';
const DIR = process.env.SW_SHOT_DIR || 'test-results/home-favorites-2500';
const SIZES = { tablet: { width: 1024, height: 768 }, phone: { width: 390, height: 844 } } as const;
const home = (page: Page) => page.locator('sw-home');

async function open(page: Page, route: string, size: { width: number; height: number }, o: FavOpts = {}) {
  await page.setViewportSize(size);
  await page.goto('about:blank');
  await mockFavs(page, o);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'));
  await settle(page);
}
const shot = (page: Page, name: string, size: string) => page.screenshot({ path: `${DIR}/${TAG}-${name}-${size}.png` });
const soft = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* the old build has no such control */ } };

test.describe('HOME-FAVORITES-2500 captures', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const [size, vp] of Object.entries(SIZES)) {
    test(`grid, edit, drag, add - ${size}`, async ({ page }) => {
      await open(page, 'r/living', vp);
      await shot(page, 'grid', size);
      await home(page).locator('[data-act="edit"]').click();
      await settle(page);
      await shot(page, 'edit', size);
      await soft(async () => {
        const b = (await home(page).locator('.wdg[data-ix="0"]').boundingBox({ timeout: 1500 }))!;
        await page.mouse.move(b.x + 10, b.y + 8);
        await page.mouse.down();
        await page.waitForTimeout(650);
        await page.mouse.move(b.x + 10 - (size === 'tablet' ? 300 : 0), b.y + 8 + (size === 'tablet' ? 40 : 150), { steps: 8 });
        await shot(page, 'drag', size);
        await page.mouse.up();
      });
      await home(page).locator('[data-act="edit"]').click();
      await settle(page);
      if (size === 'phone') await soft(async () => { await home(page).locator('.pager [data-d="1"]').first().click({ timeout: 1500 }); await settle(page); });
      await soft(async () => {
        await home(page).locator('.fav-add').first().click({ timeout: 1500 });
        await settle(page);
        await shot(page, 'add', size);
      });
    });

    test(`scene suggestion - ${size}`, async ({ page }) => {
      await open(page, 'scenes', vp, { backDoor: true, armCode: 'pin' });
      await home(page).locator('[data-act="scene"][data-scene="leave"]').first().click();
      await page.waitForTimeout(700);
      await settle(page);
      await shot(page, 'suggest-lock', size);
      await soft(async () => {
        await home(page).locator('[data-scene-next="lock"] [data-act="scNextYes"]').click({ timeout: 1500 });
        await settle(page);
        await shot(page, 'suggest-arm', size);
        await home(page).locator('[data-scene-next="arm"] [data-act="scNextYes"]').click({ timeout: 1500 });
        await settle(page);
        await shot(page, 'suggest-code', size);
      });
    });

    test(`scene editing for a floor home manager - ${size}`, async ({ page }) => {
      await open(page, 'settings/scenes', vp, { sceneManager: true, editable: ['evening', 'night'], policy: { home_only: true, may_switch: false } });
      await shot(page, 'scenes-settings', size);
      await soft(async () => {
        await home(page).locator('[data-scene-edit="evening"]').click({ timeout: 1500 });
        await page.waitForTimeout(300);
        await settle(page);
        await shot(page, 'scene-edit', size);
      });
    });
  }
});
