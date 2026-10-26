import { test, expect, type Page } from '@playwright/test';

// FIX2232A-295: the setting home.screen.phone_floors. `selector` (default) = one floor with the floor switch and the tree button on a
// phone; `all` = every floor card stacked down the page, no switch, no tree button. Tablet / desktop unchanged. Demo mode (no backend):
// the option comes from `?hs_phone_floors=`, the many-floors state from `?hs_state=many`.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-home-phonefloors-295.spec.ts --project=desktop

const VP = { m: { width: 390, height: 844 }, t: { width: 1180, height: 820 }, d: { width: 1366, height: 768 } } as const;

async function open(page: Page, vp: keyof typeof VP, state: string, q: string, mode: 'cards' | 'tiles' = 'cards') {
  await page.setViewportSize(VP[vp]);
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('sw.devices.layout', m);
    } catch {
      /* storage unavailable */
    }
  }, mode);
  await page.goto('about:blank');
  await page.goto(`/?design=a&hs_state=${state}${q}#/devices/building`);
  await page.waitForSelector('sw-app devices-building');
  await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  await page.waitForTimeout(350);
}
const B = (page: Page) => page.locator('sw-app devices-building');

for (const state of ['site', 'many']) {
  test(`phone, ${state}: phone_floors=all stacks every floor card, no chips, no tree button`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, 'm', state, '&hs_phone_floors=selector');
    const b = B(page);
    const n = Number(await b.locator('[data-floor-count]').first().getAttribute('data-floor-count'));
    expect(n).toBeGreaterThanOrEqual(3);
    await expect(b.locator('[data-phone-floors]')).toBeVisible();
    await expect(b.locator('[data-phone-floor]')).toHaveCount(n);
    await expect(b.locator('section.fcard[data-floor-card]:not(.loose)')).toHaveCount(1); // unchanged: one floor at a time

    await open(page, 'm', state, '&hs_phone_floors=all');
    await expect(b.locator('[data-phone-floors]')).toHaveCount(0);
    await expect(b.locator('[data-phone-floor]')).toHaveCount(0);
    await expect(b.locator('[data-phone-tree]')).toHaveCount(0);
    await expect(b.locator('section.fcard[data-floor-card]:not(.loose)')).toHaveCount(n);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('phone, tiles view: phone_floors=all stacks every floor section', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
  await open(page, 'm', 'site', '&hs_phone_floors=all', 'tiles');
  const b = B(page);
  await expect(b.locator('[data-phone-floors]')).toHaveCount(0);
  expect(await b.locator('section.floor[data-floor]:not([data-floor="unassigned"])').count()).toBeGreaterThanOrEqual(3);
});

test('tablet and desktop ignore phone_floors', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
  for (const vp of ['t', 'd'] as const) {
    await open(page, vp, 'site', '&hs_phone_floors=all');
    await expect(B(page).locator('[data-phone-floors]')).toHaveCount(0); // never drawn there
    await expect(B(page).locator('section.fcard[data-floor-card]:not(.loose)').first()).toBeVisible();
  }
});
