import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { band, install, newMock, open, stills, type Dev } from './wall-plan-mocks';

// Plan Studio 6, slice S5-B: the layout guard (tests/layout-guard.ts) over the two surfaces this slice drew, against the mocked backend
// (tests/wall-plan-mocks.ts): (1) the map section of the wall screen's settings drawer (הגדרות › מסכי קיר) in every registered skin x light /
// dark x widths 320..1440 - the toggle, the three selects and the "no floor" note; (2) the plan in the map band of a portrait wall display on
// the tablet sizes a wall really is (7 inch and up, portrait), baked stills in every skin and the live bare view. FAILS on escape / overflow /
// floating / clipped (and target on the band). The drawer is measured by itself (`within`), because the rest of the drawer belongs to the wall
// screens' own specs; its target findings are filtered like the older settings screens' specs do: the section is built from the drawer's own
// `sel` / `tog` helpers (a 32 px select, the 42 x 24 toggle of sw-toggle), the same controls the alerts section uses, so a 44 px touch size is
// a settings-wide pass, not this section's.
//   npx playwright test tests/layout-wall-plan.spec.ts --project=desktop --workers=1     (LAYOUT_QUICK=1: 320/768/1440 and two tablets)
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 768, 1440] : [320, 390, 768, 1024, 1440];
const TABLETS: Dev[] = QUICK
  ? [{ w: 600, h: 960, touch: true, mobile: false }, { w: 800, h: 1280, touch: true, mobile: false }]
  : [{ w: 600, h: 960, touch: true, mobile: false }, { w: 768, h: 1024, touch: true, mobile: false }, { w: 800, h: 1280, touch: true, mobile: false }, { w: 1024, h: 1366, touch: true, mobile: false }];
const SCHEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

function report(name: string, runs: number, results: Finding[], errors: string[]) {
  const { byCls, lines } = summarize(results);
  console.log(`${name}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
};

test.describe('S5-B layout guard: the settings drawer\'s map section', () => {
  test.describe.configure({ timeout: 10 * 60_000 });
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  for (const skin of SKIN_IDS) for (const scheme of SCHEMES) test(`${skin} / ${scheme}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep (it resizes the viewport itself)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const sweep = async (ctx: string) => {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await settle(page);
        runs++;
        results.push(...(await page.evaluate(inPageCheck, { ctx: `${ctx} ${skin} ${scheme} ${w}`, within: '[data-wall-section="map"]' })).filter((f) => f.cls !== 'target'));
      }
    };

    // a screen with a floor: the toggle and the three dials, then the dials hidden (the toggle off)
    await install(page, newMock({ admin: true, skin, scheme, plan: { mode: 'stills', quality: 'schematic', idle_s: 120 } }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/system/wall`);
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    const map = page.locator('sw-drawer[data-wall-drawer] [data-wall-section="map"]');
    await expect(map.locator('select[data-wall-field="plan-idle"]')).toHaveValue('120');
    await sweep('map-on');
    await map.locator('sw-toggle[data-wall-field="show-map"]').click();
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toHaveCount(0);
    await sweep('map-off');
    report(`drawer ${skin} / ${scheme}`, runs, results, errors);
  });

  test('a screen with no floor: the note that the map will not show', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep (it resizes the viewport itself)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    await install(page, newMock({ admin: true, floor: null }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    await expect(page.locator('sw-drawer[data-wall-drawer] [data-wall-map-nofloor]')).toBeVisible();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: height(w) });
      await settle(page);
      results.push(...(await page.evaluate(inPageCheck, { ctx: `nofloor ${w}`, within: '[data-wall-section="map"]' })).filter((f) => f.cls !== 'target'));
    }
    report('drawer, no floor', WIDTHS.length, results, errors);
  });
});

test.describe('S5-B layout guard: the plan in the map band of a portrait wall', () => {
  test.describe.configure({ timeout: 5 * 60_000 });
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  for (const dev of TABLETS) for (const skin of SKIN_IDS) test(`${dev.w}x${dev.h} / ${skin}: the baked stills`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, newMock({ skin, scheme: 'light', theme: 'dark', plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }), dev, `?design=a&skin=${skin}&scheme=light`);
    await expect(stills(page).locator('svg[data-stills]')).toBeVisible({ timeout: 30_000 });
    await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1, { timeout: 30_000 });
    await expect(band(page)).toBeVisible();
    await settle(page);
    const found = await page.evaluate(inPageCheck, { ctx: `band ${dev.w}x${dev.h} ${skin}`, within: '[data-wall-map-slot]' });
    report(`band ${dev.w}x${dev.h} ${skin}`, 1, found, errors);
  });

  for (const dev of TABLETS) test(`${dev.w}x${dev.h}: the live bare view`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, newMock({ scheme: 'light', theme: 'dark', plan: { mode: 'live', quality: 'schematic', idle_s: 0 } }), dev, '?design=a');
    await expect(band(page).locator('sw-wall-plan [data-wall-plan="live"] sw-plan-3d[kiosk]')).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    await settle(page);
    const found = await page.evaluate(inPageCheck, { ctx: `band-live ${dev.w}x${dev.h}`, within: '[data-wall-map-slot]' });
    report(`band live ${dev.w}x${dev.h}`, 1, found, errors);
  });
});
