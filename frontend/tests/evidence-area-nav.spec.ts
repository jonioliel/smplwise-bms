import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';

// Owner request 2026-09-30 - the area screen's header is ONE interactive navigation: a breadcrumb of real controls
// (חשמל והתקנים › קומה ▾ › אזור ▾), each level a button that lists its siblings with counts; the title is the current area with
// no chevron, the subtitle keeps only the counts, no separate tabs row on the desktop; on a phone the floor is a bottom sheet
// and the floor's areas are a scrollable row of 44 px chips. Fixture backend (tests/fixtures/devices_fake_ha.py, SW_LIVE=1
// SW_DEVICES_FIXTURE=1) with three floors. SW_SHOTS=<dir> saves screenshots there (docs/evidence/UIR2-area/).
const SHOTS = process.env.SW_SHOTS ?? '';
const FLOORS = [
  { floor_id: 'ar3_f0', name: 'קומת כניסה', level: 0 },
  { floor_id: 'ar3_f1', name: 'קומה 1', level: 1 },
  { floor_id: 'ar3_f2', name: 'גג', level: 2 },
];
const AREAS = [
  { area_id: 'ar3_offices', name: 'משרדים', floor_id: 'ar3_f0' },
  { area_id: 'ar3_spaces', name: 'מרחבים', floor_id: 'ar3_f0' },
  { area_id: 'ar3_yard', name: 'חוץ', floor_id: 'ar3_f0' },
  { area_id: 'ar3_offices1', name: 'משרדים', floor_id: 'ar3_f1' },
  { area_id: 'ar3_meeting', name: 'חדר ישיבות', floor_id: 'ar3_f1' },
  { area_id: 'ar3_roof', name: 'מרפסת גג', floor_id: 'ar3_f2' },
];
const ENT: { entity_id: string; area_id: string }[] = [];
const ST: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
AREAS.forEach((a, i) => {
  for (let n = 1; n <= i + 1; n++) {
    ENT.push({ entity_id: `light.ar3_${a.area_id}_${n}`, area_id: a.area_id });
    ST.push({ entity_id: `light.ar3_${a.area_id}_${n}`, state: n % 2 ? 'on' : 'off', attributes: { friendly_name: `תאורה ${n}`, brightness: 150 } });
  }
});

test.describe('the area screen navigation', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENT, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    expect((await request.post('/api/v1/ha/dev/states', { data: { states: ST } })).status()).toBe(200);
    for (const a of AREAS) await request.delete(`/api/v1/devices/layouts/area/${a.area_id}`);
    await request.patch('/api/v1/settings', { data: { 'devices.area_design': 'tiles' } });
  }

  async function open(page: Page, areaId = 'ar3_offices') {
    await page.goto('about:blank');
    await page.goto(`/?design=a#/devices/areas/${areaId}`);
    await page.waitForSelector('devices-area devices-area-nav');
    await page.waitForTimeout(500);
  }

  const shot = async (page: Page, name: string, testInfo: { project: { name: string } }) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${testInfo.project.name === 'mobile' ? '390' : '1440'}.png`) });
  };

  const nav = (page: Page) => page.locator('devices-area devices-area-nav');
  const title = (page: Page) => page.locator('devices-area sw-page h1');
  const hash = (page: Page) => page.evaluate(() => location.hash);

  test('one breadcrumb of controls: home, floor, area; no chevron by the title, no floor in the subtitle, no tabs row', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    await expect(title(page)).toHaveText('משרדים');
    await expect(nav(page).locator('[data-crumb="home"]')).toContainText('חשמל והתקנים');
    await expect(nav(page).locator('[data-crumb="floor"]')).toContainText('קומת כניסה');
    await expect(nav(page).locator('[data-crumb="area"]')).toContainText('משרדים');
    await expect(nav(page).locator('[data-crumb="area"]')).toHaveAttribute('aria-current', 'location');
    await expect(page.locator('devices-area sw-page [data-page-back]')).toHaveCount(0); // the unexplained chevron
    await expect(page.locator('devices-area sw-page .titlebar + .sub')).toHaveText('1 התקנים'); // counts only
    await expect(page.locator('devices-area sw-chip[data-nav-option]')).toHaveCount(0); // the tabs row is merged into the area list
    // a crumb is a real control, 30 px+ on a desktop
    expect((await nav(page).locator('[data-crumb="floor"]').boundingBox())!.height).toBeGreaterThanOrEqual(30);
    await shot(page, 'nav-crumbs', testInfo);
  });

  test('the floor list: every floor with its count, the current one marked; a floor lands on the same-named area, else its first', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    await nav(page).locator('[data-crumb="floor"]').click();
    const menu = nav(page).locator('[data-nav-menu="floor"]');
    for (const f of ['ar3_f0', 'ar3_f1', 'ar3_f2']) await expect(menu.locator(`[data-nav-option="${f}"]`)).toHaveCount(1, { timeout: 15000 }); // (other specs may have left floors of their own)
    await expect(menu.locator('[data-nav-option="ar3_f0"]')).toHaveAttribute('aria-checked', 'true');
    await expect(menu.locator('[data-nav-option="ar3_f0"]')).toHaveAttribute('data-count', '6'); // 1 + 2 + 3 lights
    await expect(menu.locator('[data-nav-option="ar3_f1"]')).toHaveAttribute('data-count', '9'); // 4 + 5
    await shot(page, 'nav-floor-list', testInfo);
    // the floor that has an area of the same name lands there
    await menu.locator('[data-nav-option="ar3_f1"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_offices1');
    await expect(title(page)).toHaveText('משרדים');
    await expect(nav(page).locator('[data-crumb="floor"]')).toContainText('קומה 1');
    // a floor without one lands on its first area
    await nav(page).locator('[data-crumb="floor"]').click();
    await nav(page).locator('[data-nav-menu="floor"] [data-nav-option="ar3_f2"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_roof');
    await expect(title(page)).toHaveText('מרפסת גג');
    await expect(nav(page).locator('[data-crumb="floor"]')).toContainText('גג');
  });

  test('the area list: the areas of this floor with counts; choosing one goes there; the home crumb goes back to the overview', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    await nav(page).locator('[data-crumb="area"]').click();
    const menu = nav(page).locator('[data-nav-menu="area"]');
    await expect(menu.locator('[data-nav-option]')).toHaveCount(3);
    await expect(menu.locator('[data-nav-option="ar3_offices"]')).toHaveAttribute('aria-checked', 'true');
    await expect(menu.locator('[data-nav-option="ar3_spaces"]')).toHaveAttribute('data-count', '2');
    await expect(menu.locator('[data-nav-option="ar3_meeting"]')).toHaveCount(0); // another floor
    await shot(page, 'nav-area-list', testInfo);
    await menu.locator('[data-nav-option="ar3_yard"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_yard');
    await expect(title(page)).toHaveText('חוץ');
    await expect(menu).toHaveCount(0); // closed after choosing
    await nav(page).locator('[data-crumb="home"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/building');
    // a deep link opens the area with the right crumbs
    await open(page, 'ar3_meeting');
    await expect(nav(page).locator('[data-crumb="floor"]')).toContainText('קומה 1');
    await expect(title(page)).toHaveText('חדר ישיבות');
  });

  test('keyboard: ArrowDown opens and moves through a list, Home / End, Enter chooses, Escape closes and returns to the crumb', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    const area = nav(page).locator('[data-crumb="area"]');
    await area.focus();
    await page.keyboard.press('ArrowDown');
    const menu = nav(page).locator('[data-nav-menu="area"]');
    await expect(menu).toBeVisible();
    const focused = () => nav(page).evaluate((el) => el.shadowRoot!.activeElement?.getAttribute('data-nav-option') ?? '');
    await expect.poll(focused).toBe('ar3_offices'); // the current one first
    await page.keyboard.press('ArrowDown');
    await expect.poll(focused).toBe('ar3_spaces');
    await page.keyboard.press('End');
    await expect.poll(focused).toBe('ar3_yard');
    await page.keyboard.press('ArrowDown'); // wraps
    await expect.poll(focused).toBe('ar3_offices');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect.poll(() => nav(page).evaluate((el) => el.shadowRoot!.activeElement?.getAttribute('data-crumb') ?? '')).toBe('area');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_spaces');
    // a click outside closes an open list
    await nav(page).locator('[data-crumb="floor"]').click();
    await expect(nav(page).locator('[data-nav-menu="floor"]')).toBeVisible();
    await title(page).click();
    await expect(nav(page).locator('[data-nav-menu="floor"]')).toHaveCount(0);
  });

  test('both directions of the screen keep the same header', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await request.patch('/api/v1/settings', { data: { 'devices.area_design': 'sections' } });
    try {
      await open(page);
      await expect(page.locator('devices-area')).toHaveAttribute('data-area-design', 'sections');
      await expect(nav(page).locator('[data-crumb="floor"]')).toContainText('קומת כניסה');
      await nav(page).locator('[data-crumb="area"]').click();
      await expect(nav(page).locator('[data-nav-menu="area"] [data-nav-option]')).toHaveCount(3);
      await shot(page, 'nav-sections', testInfo);
    } finally {
      await request.patch('/api/v1/settings', { data: { 'devices.area_design': 'tiles' } });
    }
  });

  test('phone: home + floor crumbs (the floor is a bottom sheet), the floor\'s areas as a scrollable row of 44 px chips, no page scroll sideways', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await open(page);
    await expect(nav(page).locator('[data-crumb="area"]')).toHaveCount(0);
    for (const c of ['home', 'floor']) expect((await nav(page).locator(`[data-crumb="${c}"]`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const chips = nav(page).locator('sw-chip[data-nav-option]');
    await expect(chips).toHaveCount(3);
    await expect(nav(page).locator('sw-chip[data-nav-option="ar3_offices"]')).toHaveAttribute('selected', '');
    for (const box of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'nav-phone', testInfo);
    // one tap on a chip switches the area
    await nav(page).locator('sw-chip[data-nav-option="ar3_yard"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_yard');
    await expect(title(page)).toHaveText('חוץ');
    // the floor sheet
    await nav(page).locator('[data-crumb="floor"]').click();
    const sheet = nav(page).locator('[data-nav-menu="floor"]');
    for (const f of ['ar3_f0', 'ar3_f1', 'ar3_f2']) await expect(sheet.locator(`[data-nav-option="${f}"]`)).toHaveCount(1, { timeout: 15000 });
    const box = (await sheet.boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(Math.round(box.y + box.height)).toBe(vh); // pinned to the bottom edge
    for (const h of await sheet.locator('[data-nav-option]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
    await shot(page, 'nav-phone-floor-sheet', testInfo);
    await sheet.locator('[data-nav-option="ar3_f1"]').click();
    await expect.poll(() => hash(page)).toBe('#/devices/areas/ar3_offices1');
    await expect(nav(page).locator('[data-nav-menu]')).toHaveCount(0);
  });
});
