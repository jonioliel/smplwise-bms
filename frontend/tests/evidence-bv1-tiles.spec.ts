import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBv1Mock, bv1Config, BV1_NOW, type Bv1MockState } from './bv1-mocks';

// BV1 (2026-10-05): the evidence shots of the new Bubble variants and their behaviour against the mocked backend (tests/bv1-mocks.ts).
//   1. shots -> docs/design/evidence/bv1-tiles/: the home with the clock / weather tiles, the agenda and the launcher at 1440 / 820
//      (desktop project) and 390 (mobile project), light and dark, surfaces fill / glass / none; the cards style for contrast; the
//      device sheet with vertical sliders; the classic skin (agenda + launcher as cards).
//   2. behaviour: a scene button sends ONE apply (the item id, not the entity id), a quick button opens the screen's bulk dialog, a route
//      button navigates, the agenda is sorted and shows its empty state, the vertical slider's keyboard sends a brightness, the
//      surfaceless pill has no background, the launcher hides what this user may not press.
// Needs the Vite DEV server (the dials go through /src/design/look.ts).
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/bv1-tiles');

async function open(page: Page, hash: string, query = '') {
  await page.clock.setFixedTime(new Date(BV1_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const widgets = (page: Page) => page.locator('sw-app devices-building home-widgets');
const area = (page: Page) => page.locator('sw-app devices-area');

test.describe('BV1 tiles', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked spec');
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

  test('evidence shots: tiles, agenda, launcher, sheet with vertical sliders - light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    test.setTimeout(10 * 60_000);
    const widths = info.project.name === 'mobile' ? [390] : [1440, 820];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const scheme of ['light', 'dark'] as const) {
        await installBv1Mock(page);
        for (const surface of ['fill', 'glass', 'none'] as const) {
          await open(page, '/devices/building', `&skin=bubble&scheme=${scheme}&look=surface:${surface}`);
          await expect(widgets(page).locator('[data-home-widget="agenda"]')).toBeVisible();
          await expect(widgets(page).locator('[data-home-widget="launcher"]')).toBeVisible();
          await shot(page, `home-${surface}-${w}-${scheme}`);
        }
        await open(page, '/devices/areas/living', `&skin=bubble&scheme=${scheme}&look=slider:vertical`);
        await area(page).locator('sw-pill[data-entity="cover.living_balcony"] [data-pill-ring]').click();
        await expect(area(page).locator('sw-sheet[data-device-sheet] sw-vslider').first()).toBeVisible();
        await page.waitForTimeout(700);
        await shot(page, `sheet-vertical-cover-${w}-${scheme}`);
        await page.keyboard.press('Escape');
        await area(page).locator('sw-pill[data-entity="light.living_main"] [data-pill-ring]').click();
        await page.waitForTimeout(700);
        await shot(page, `sheet-vertical-light-${w}-${scheme}`);
        await page.keyboard.press('Escape');
        if (scheme === 'light') {
          await page.unroute('**/api/v1/**');
          await installBv1Mock(page, { config: bv1Config({ clockStyle: 'card', weatherStyle: 'card' }) });
          await open(page, '/devices/building', `&skin=bubble&scheme=${scheme}`);
          await shot(page, `home-cards-${w}-${scheme}`);
          await open(page, '/devices/building', `&skin=classic&scheme=${scheme}`);
          await expect(widgets(page).locator('[data-home-widget="launcher"]')).toBeVisible();
          await shot(page, `home-classic-${w}-${scheme}`);
          await page.unroute('**/api/v1/**');
          await installBv1Mock(page, { agendaEmpty: true });
          await open(page, '/devices/building', `&skin=bubble&scheme=${scheme}`);
          await expect(widgets(page).locator('[data-home-agenda-empty]')).toBeVisible();
          await shot(page, `home-agenda-empty-${w}-${scheme}`);
        }
        await page.unroute('**/api/v1/**');
      }
    }
  });

  test('behaviour: the launcher sends one apply per scene press, a route navigates, a quick action opens the bulk dialog, the agenda is sorted', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    const st: Bv1MockState = await installBv1Mock(page);
    await open(page, '/devices/building', '&skin=bubble&scheme=light');
    const l = widgets(page).locator('[data-home-widget="launcher"]');
    await expect(l).toBeVisible();
    // the tiles are drawn as tiles (the bubble skin), with the weather on its hue
    await expect(widgets(page).locator('[data-home-widget="weather"]')).toHaveClass(/tile/);
    await expect(widgets(page).locator('[data-home-widget="clock"]')).toHaveClass(/tile/);
    // every configured item this user may press: 4 routes, 2 scenes, 1 script, 2 quick actions
    expect(await l.locator('[data-home-launch]').count()).toBe(9);
    await expect(l.locator('[data-home-launch="scene:scene.movie"] .ll')).toHaveText('קולנוע'); // the owner's label
    await expect(l.locator('[data-home-launch="scene:scene.evening"] .ll')).toHaveText('ערב רגוע'); // the entity's name
    // a scene: ONE apply with the automations item id
    await l.locator('[data-home-launch="scene:scene.evening"]').click();
    await expect.poll(() => st.launches.length).toBe(1);
    expect(st.launches[0]).toEqual({ kind: 'scene', id: 's-evening' });
    await expect(l.locator('[data-home-launch-note]')).toHaveText('הסצנה הופעלה');
    // a script
    await l.locator('[data-home-launch="script:script.goodnight"]').click();
    await expect.poll(() => st.launches.length).toBe(2);
    expect(st.launches[1]).toEqual({ kind: 'script', id: 'sc-night' });
    // a quick action opens the screen's own bulk dialog (nothing is sent from the widget)
    const before = st.actions.length;
    await l.locator('[data-home-launch="quick:all_off"]').click();
    // (the dialog host is display: contents, so "open" is the check; its preview request is not mocked here - the screen's own spec covers it)
    const bulk = page.locator('sw-app devices-building devices-bulk-dialog sw-dialog');
    await expect(bulk).toHaveAttribute('open', '', { timeout: 5000 });
    expect(await bulk.getAttribute('data-bulk-dialog')).not.toBe('closed');
    expect(st.actions.length).toBe(before);
    await page.keyboard.press('Escape');
    // the agenda: sorted by start, the first is today's, the all-day one says so, the empty state is not shown
    const ev = widgets(page).locator('[data-home-widget="agenda"] [data-home-event]');
    expect(await ev.count()).toBe(3); // size m shows three of the four
    await expect(ev.nth(0).locator('.ag-when')).toContainText('היום');
    await expect(ev.nth(1).locator('.ag-when')).toContainText('מחר');
    await expect(ev.nth(2).locator('.ag-when')).toContainText('כל היום');
    await expect(widgets(page).locator('[data-home-widget="agenda"] .ag-more')).toContainText('1');
    // a route button navigates (the live wall)
    await l.locator('[data-home-launch="route:live"]').click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/live/wall');
  });

  test('behaviour: a viewer without the scene / script / bulk rights sees only the screens they may open', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await installBv1Mock(page, { perms: ['devices.read', 'video.live', 'map.read'] });
    await open(page, '/devices/building', '&skin=bubble&scheme=light');
    const l = widgets(page).locator('[data-home-widget="launcher"]');
    await expect(l).toBeVisible();
    expect(await l.locator('[data-home-launch]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-launch')))).toEqual(['route:live', 'route:map']);
  });

  test('behaviour: the vertical slider sends a brightness from the keyboard and the cover position stages; the surfaceless pill has no fill', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    const st = await installBv1Mock(page);
    await open(page, '/devices/areas/living', '&skin=bubble&scheme=light&look=slider:vertical');
    await area(page).locator('sw-pill[data-entity="light.living_main"] [data-pill-ring]').click();
    const vs = area(page).locator('sw-sheet[data-device-sheet] sw-vslider[data-vslider="brightness"]');
    await expect(vs).toBeVisible();
    await expect(vs).toHaveAttribute('aria-orientation', 'vertical');
    await expect(vs).toHaveAttribute('aria-valuenow', '72');
    await vs.focus();
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => st.actions.length, { timeout: 3000 }).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'light.living_main', action_id: 'light.turn_on' });
    expect(st.actions[0].args).toEqual({ brightness_pct: 77 });
    await page.keyboard.press('Escape');
    // the cover: the position slider stages (the confirm chip appears under the sliders), nothing is sent before the confirmation
    await area(page).locator('sw-pill[data-entity="cover.living_balcony"] [data-pill-ring]').click();
    const pos = area(page).locator('sw-sheet[data-device-sheet] sw-vslider[data-vslider="position"]');
    await expect(pos).toBeVisible();
    await expect(area(page).locator('sw-sheet[data-device-sheet] sw-vslider[data-vslider="tilt-position"]')).toBeVisible();
    const n = st.actions.length;
    await pos.focus();
    await page.keyboard.press('PageUp');
    await expect(area(page).locator('sw-sheet[data-device-sheet] [data-control="position-confirm"]')).toBeVisible();
    expect(st.actions.length).toBe(n);
    await page.keyboard.press('Escape');
    // the surfaceless look: a pill's background is transparent, its ring keeps the hue
    await open(page, '/devices/areas/living', '&skin=bubble&scheme=light&look=surface:none');
    const pill = area(page).locator('sw-pill[data-entity="light.living_main"]');
    await expect(pill).toHaveAttribute('data-surface', 'none');
    expect(await pill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    // the widgets follow too
    await open(page, '/devices/building', '&skin=bubble&scheme=light&look=surface:none');
    await expect(widgets(page)).toHaveAttribute('data-surface', 'none');
    expect(await widgets(page).locator('[data-home-widget="agenda"]').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  });

  test('the classic skin draws the agenda and the launcher as cards, the clock and weather as cards whatever the style says', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await installBv1Mock(page);
    await open(page, '/devices/building', '&skin=classic&scheme=light');
    await expect(widgets(page).locator('[data-home-widget="agenda"] [data-home-event]').first()).toBeVisible();
    await expect(widgets(page).locator('[data-home-widget="launcher"] [data-home-launch="route:live"]')).toBeVisible();
    await expect(widgets(page).locator('[data-home-widget="weather"]')).not.toHaveClass(/tile/);
    await expect(widgets(page).locator('[data-home-widget="weather"] .wx-t')).toBeVisible();
    expect(await widgets(page).locator('sw-pill').count()).toBe(0);
  });
});
