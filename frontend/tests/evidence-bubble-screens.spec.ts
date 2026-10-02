import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBubbleMock, type BubbleMockState } from './bubble-mocks';

// Bubble phase C (owner 2026-10-02): the real screens in the bubble skin.
//   1. the evidence shots: the home (cards + tiles), the area (+ the light / climate / cover sheets), the players page (+ the volume
//      morph), the screens page and the groups page at 390 / 820 / 1440, light and dark -> docs/design/evidence/bubble-screens/
//   2. behaviour against the mocked backend (tests/bubble-mocks.ts): a pill's tap sends ONE power command, the keyboard works on a
//      pill (Enter toggles, arrows step the brightness), the ring opens the device sheet (focus moves in, Esc closes, focus returns),
//      a cover's open arms on the first press and sends WITH the confirmation grant on the second, the climate stepper sends
//      set_temperature, the row density is one column, the classic skin is untouched (the area keeps its tiles and rows).
// Needs the Vite DEV server (the dials go through /src/design/look.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5215      then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/evidence-bubble-screens.spec.ts --project=desktop --project=mobile --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/bubble-screens');

async function open(page: Page, hash: string, query = '') {
  await page.clock.setFixedTime(new Date('2026-10-02T13:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const area = (page: Page) => page.locator('sw-app devices-area');
const pill = (page: Page, id: string) => area(page).locator(`sw-pill[data-entity="${id}"]`);
const activeDesc = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a ? `${a.tagName.toLowerCase()}${a.getAttribute('data-entity') ? '[' + a.getAttribute('data-entity') + ']' : ''}${a.hasAttribute('data-pill-ring') ? '[ring]' : ''}${a.hasAttribute('data-sheet-close') ? '[close]' : ''}` : 'none';
  });

test.describe('bubble screens', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked / demo spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.devices.treeCollapsed');
        localStorage.removeItem('sw.devices.layout');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('evidence shots: home, area, players, screens, groups - light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    test.setTimeout(10 * 60_000);
    const widths = info.project.name === 'mobile' ? [390] : [1440, 820];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const scheme of ['light', 'dark'] as const) {
        const q = `&scheme=${scheme}`;
        // the mocked backend: the home and the area
        const mock = await installBubbleMock(page);
        void mock;
        await open(page, '/devices/building', q);
        await expect(page.locator('html')).toHaveAttribute('data-skin', 'bubble');
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await shot(page, `home-${w}-${scheme}`);
        await page.evaluate(() => localStorage.setItem('sw.devices.layout', 'tiles'));
        await open(page, '/devices/building', q);
        await shot(page, `home-tiles-${w}-${scheme}`);
        await page.evaluate(() => localStorage.removeItem('sw.devices.layout'));
        await open(page, '/devices/areas/living', q);
        await expect(pill(page, 'light.living_main')).toBeVisible();
        await shot(page, `area-${w}-${scheme}`);
        for (const [id, name] of [['light.living_main', 'light'], ['climate.living_ac', 'climate'], ['cover.living_balcony', 'cover']] as const) {
          await pill(page, id).locator('[data-pill-ring]').click();
          await page.waitForTimeout(700);
          await shot(page, `area-sheet-${name}-${w}-${scheme}`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
        if (scheme === 'light') {
          await open(page, '/devices/areas/living', `${q}&look=density:row,surface:glass`);
          await shot(page, `area-row-glass-${w}-${scheme}`);
          await open(page, '/devices/areas/living', `${q}&look=density:wide,surface:gradient,radius:soft`);
          await shot(page, `area-wide-gradient-${w}-${scheme}`);
        }
        await page.unroute('**/api/v1/**');
        // the static demo: the multimedia screens
        await open(page, '/multimedia/players', q);
        await expect(page.locator('sw-app multimedia-players media-player-card').first()).toBeVisible();
        await shot(page, `players-${w}-${scheme}`);
        const vb = page.locator('sw-app multimedia-players media-player-card .vb').first();
        if (await vb.count()) {
          await vb.click();
          await page.waitForTimeout(400);
          await shot(page, `players-volume-morph-${w}-${scheme}`);
        }
        await open(page, '/multimedia/screens', q);
        await shot(page, `screens-${w}-${scheme}`);
        await open(page, '/multimedia/groups', q);
        await shot(page, `groups-${w}-${scheme}`);
      }
    }
  });

  // The performance tier (owner pre-approval 2026-10-02): the glass surface drawn in `full` and in `lite`, same screens, same widths.
  // lite = no backdrop-filter on pills, cards, rows and lists; the dock / rail / tree and the open pop-up keep their blur.
  // Evidence -> docs/design/evidence/bubble-performance/ (390 from the mobile project, 1440 from the desktop project).
  test('performance tier evidence: home, area and players, glass surface, full vs lite, light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is not shot');
    test.setTimeout(10 * 60_000);
    const w = info.project.name === 'mobile' ? 390 : 1440;
    const blurOf = (loc: ReturnType<Page['locator']>) => loc.first().evaluate((el) => getComputedStyle(el).backdropFilter);
    for (const scheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const tier of ['full', 'lite'] as const) {
        const q = `&scheme=${scheme}&look=surface:glass,performance:${tier}`;
        await installBubbleMock(page);
        await open(page, '/devices/building', q);
        await expect(page.locator('html')).toHaveAttribute('data-bubble-performance', tier);
        await shot(page, `../bubble-performance/home-${tier}-${w}-${scheme}`);
        await open(page, '/devices/areas/living', q);
        await expect(pill(page, 'light.living_main')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-bubble-performance', tier);
        // the glass pill: blurred in full, none in lite; the dock (phone) or the rail (desktop) is blurred in both
        const pillBlur = await blurOf(area(page).locator('sw-pill[data-surface="glass"]'));
        const nav = page.locator(w <= 480 ? 'sw-app nav.bottom .stack' : 'sw-app nav.rail');
        const navBlur = await blurOf(nav);
        if (tier === 'lite') expect(pillBlur, `lite pill ${w} ${scheme}`).toBe('none');
        else expect(pillBlur, `full pill ${w} ${scheme}`).toContain('blur(');
        expect(navBlur, `nav ${tier} ${w} ${scheme}`).toContain('blur(');
        await shot(page, `../bubble-performance/area-${tier}-${w}-${scheme}`);
        // the open pop-up keeps its blur in lite
        await pill(page, 'light.living_main').locator('[data-pill-ring]').click();
        await page.waitForTimeout(700);
        // Playwright locators pierce the open shadow roots
        const sheetPanel = area(page).locator('sw-sheet[data-device-sheet] .sheet');
        await expect(sheetPanel).toBeVisible();
        const sheetBlur = await blurOf(sheetPanel);
        expect(sheetBlur, `sheet ${tier} ${w} ${scheme}`).toContain('blur(');
        await shot(page, `../bubble-performance/area-sheet-${tier}-${w}-${scheme}`);
        await page.keyboard.press('Escape');
        await page.unroute('**/api/v1/**');
        await open(page, '/multimedia/players', q);
        await expect(page.locator('sw-app multimedia-players media-player-card').first()).toBeVisible();
        await shot(page, `../bubble-performance/players-${tier}-${w}-${scheme}`);
      }
    }
  });
  test('the area: one tap = one command, the keyboard, the sheet, the cover confirmation, the climate stepper, the list view', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st: BubbleMockState = await installBubbleMock(page);
    await open(page, '/devices/areas/living', '&scheme=light');
    const main = pill(page, 'light.living_main');
    await expect(main).toHaveAttribute('role', 'slider');
    await expect(main).toHaveAttribute('aria-valuenow', '72');
    // a tap toggles: ONE light.turn_off
    await main.click({ position: { x: 150, y: 20 } });
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'light.living_main', action_id: 'light.turn_off', confirmed: false });
    // the keyboard: ArrowLeft (RTL = up) steps the brightness 5 %, debounced into one light.turn_on
    await main.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => st.actions.length, { timeout: 3000 }).toBe(2);
    expect(st.actions[1]).toMatchObject({ entity_id: 'light.living_main', action_id: 'light.turn_on' });
    expect(st.actions[1].args).toEqual({ brightness_pct: 77 });
    // the ring opens the sheet: focus moves in, Esc closes it, focus returns to the ring
    await main.locator('[data-pill-ring]').focus();
    await page.keyboard.press('Enter');
    const sheet = area(page).locator('sw-sheet[data-device-sheet]');
    await expect(sheet).toHaveAttribute('data-device-sheet', 'light.living_main');
    await expect(sheet).toHaveAttribute('open', '');
    await expect(sheet).toHaveAttribute('data-layout', 'centred');
    await page.waitForTimeout(500);
    expect(await activeDesc(page)).toBe('sw-pill'); // the brightness pill (the sheet's first control) holds focus
    await expect(sheet.locator('sw-pill[data-control="brightness"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveAttribute('open', '');
    await page.waitForTimeout(150);
    expect(await activeDesc(page)).toContain('[ring]');
    // a switch is a toggle pill: Space toggles - ONE switch.turn_off
    const n = st.actions.length;
    await pill(page, 'switch.boiler').focus();
    await page.keyboard.press('Space');
    await expect.poll(() => st.actions.length).toBe(n + 1);
    expect(st.actions[n]).toMatchObject({ entity_id: 'switch.boiler', action_id: 'switch.turn_off' });
    // the cover: open arms on the first press (nothing sent), sends with the confirmation grant on the second
    const cover = pill(page, 'cover.living_big');
    const openBtn = cover.locator('[data-control="open"]');
    await openBtn.click();
    await expect(openBtn).toHaveClass(/armed/);
    const armedLabel = await openBtn.getAttribute('aria-label');
    expect([...(armedLabel ?? '')].map((c) => c.codePointAt(0)!.toString(16)).join(' ')).toBe([...'לאשר פתיחה?'].map((c) => c.codePointAt(0)!.toString(16)).join(' '));
    expect(st.actions.length).toBe(n + 1);
    await openBtn.click();
    await expect.poll(() => st.actions.length).toBe(n + 2);
    expect(st.actions[n + 1]).toMatchObject({ entity_id: 'cover.living_big', action_id: 'cover.open_cover', confirmed: true });
    // stop is never gated
    await cover.locator('[data-control="stop"]').click();
    await expect.poll(() => st.actions.length).toBe(n + 3);
    expect(st.actions[n + 2]).toMatchObject({ action_id: 'cover.stop_cover', confirmed: false });
    // the climate stepper: +0.5 (the entity's own step) -> set_temperature 23.5
    await pill(page, 'climate.living_ac').locator('[data-control="temp-up"]').click();
    await expect.poll(() => st.actions.length, { timeout: 3000 }).toBe(n + 4);
    expect(st.actions[n + 3]).toMatchObject({ entity_id: 'climate.living_ac', action_id: 'climate.set_temperature' });
    expect(st.actions[n + 3].args).toEqual({ temperature: 23.5 });
    // a read-only row (no can_control) sends nothing on a tap
    const before = st.actions.length;
    await pill(page, 'input_boolean.guest').click({ position: { x: 150, y: 20 } });
    await page.waitForTimeout(400);
    expect(st.actions.length).toBe(before);
    // the sections are separators with the bulk buttons; the main sensors are value tiles
    await expect(area(page).locator('[data-bubble-section="lighting"] [data-section-bulk-kind="lights_off"]')).toBeVisible();
    await expect(area(page).locator('[data-main-sensors] [data-main-sensor="sensor.living_temp"]')).toContainText('25.5');
    // the list view: the row density makes every grid one column
    await open(page, '/devices/areas/living', '&scheme=light&look=density:row');
    const cols = await area(page).locator('[data-bubble-grid="lighting"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
    await expect(pill(page, 'light.living_main')).toHaveAttribute('data-density', 'row');
  });

  test('the classic skin keeps its rows and tiles; the home draws the quick pills only in bubble', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await installBubbleMock(page);
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/areas/living');
    await page.waitForSelector('sw-app');
    await expect(area(page).locator('.tile[data-entity="light.living_main"]')).toBeVisible();
    expect(await area(page).locator('sw-pill').count()).toBe(0);
    await expect(area(page).locator('sw-card[data-card="lighting"]')).toHaveAttribute('heading', 'תאורה');
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/building');
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app devices-building home-widgets [data-home-quick="lights_off"]')).toBeVisible();
    expect(await page.locator('sw-app devices-building home-widgets sw-pill').count()).toBe(0);
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=bubble#/devices/building');
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app devices-building home-widgets sw-pill[data-home-quick-pill="lights_off"]')).toBeVisible();
  });
});
