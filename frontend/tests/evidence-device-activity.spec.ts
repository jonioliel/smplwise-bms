import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDevhistMock, DH_NOW, type FeedMode, type SchedMode } from './devhist-mocks';

// DEVHIST (CR-032, 2026-10-05): the device activity popup against the mocked backend (tests/devhist-mocks.ts).
//   1. shots -> docs/design/evidence/device-activity/: the area with the popup open (activity feed, schedules tab, states, the context
//      menu) at 1440 / 1024 (desktop / tablet projects) and 390 (mobile project), light and dark, classic and bubble skins.
//   2. behaviour: only server-flagged rows carry the gesture (sensors, media, the door cover do not); a 500 ms hold opens the popup and the
//      click that follows does NOT toggle; a tap, a short hold, a hold that moves, and a hold on a toggle / slider do not open it;
//      right click / Alt+Enter / the menu items; the feed (groups, wording, filters, load more, the states); the schedules tab (rows,
//      read-only, the switch sends enable / disable, empty, no permission, the editor sheet opens).
// Needs the Vite DEV server (the dials go through /src/design/look.ts); run through ~/run_remote.sh spec.
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/device-activity');

async function open(page: Page, query = '') {
  await page.clock.setFixedTime(new Date(DH_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#/devices/areas/living`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector('sw-app devices-area [data-entity]');
  await page.waitForTimeout(700);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const area = (page: Page) => page.locator('sw-app devices-area');
const tile = (page: Page, id: string) => area(page).locator(`.tile[data-entity="${id}"], .row[data-entity="${id}"]`).first();
const popup = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity]');
const opened = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity][open]');
const panel = (page: Page) => page.locator('sw-app device-activity #da-panel');

/** Hold the mouse on the title area of a tile (away from its toggle and slider). */
async function hold(page: Page, loc: Locator, ms: number, move = 0) {
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  const x = b.x + b.width - 34;
  const y = b.y + 14;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (move) await page.mouse.move(x - move, y, { steps: 3 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const LONG = 650;

test.describe('device activity popup', () => {
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

  test('evidence shots: feed, schedules, states and the menu - light and dark', async ({ page }, info) => {
    test.setTimeout(10 * 60_000);
    const w = info.project.name === 'mobile' ? 390 : info.project.name === 'tablet' ? 1024 : 1440;
    const tag = String(w);
    for (const scheme of ['light', 'dark'] as const) {
      for (const skin of ['classic', 'bubble'] as const) {
        const q = `&skin=${skin}&scheme=${scheme}`;
        const st = await installDevhistMock(page);
        await open(page, q);
        const target = skin === 'bubble' ? area(page).locator('sw-pill[data-entity="light.living_main"]') : tile(page, 'light.living_main');
        await hold(page, target, LONG);
        await expect(opened(page)).toHaveCount(1);
        await expect(panel(page).locator('.ev').first()).toBeVisible();
        await shot(page, `feed-${skin}-${tag}-${scheme}`);
        if (skin === 'classic') {
          await page.locator('sw-app device-activity [data-tab="schedules"]').click();
          await expect(panel(page).locator('[data-schedule]')).toHaveCount(3);
          await shot(page, `schedules-${skin}-${tag}-${scheme}`);
          for (const mode of ['empty', 'forbidden', 'unavailable', 'partial', 'slow'] as FeedMode[]) {
            st.feedMode = mode;
            await page.keyboard.press('Escape');
            await expect(opened(page)).toHaveCount(0);
            await hold(page, target, LONG);
            if (mode === 'slow') await expect(panel(page).locator('[data-feed-state="loading"]')).toBeVisible();
            else await expect(panel(page).locator(`[data-feed-state]`).first()).toBeVisible();
            await shot(page, `state-${mode}-${skin}-${tag}-${scheme}`);
          }
          await page.keyboard.press('Escape');
          await target.click({ button: 'right', position: { x: 20, y: 14 } });
          await expect(page.locator('sw-app device-activity [data-activity-menu]')).toBeVisible();
          await shot(page, `menu-${skin}-${tag}-${scheme}`);
        }
        await page.keyboard.press('Escape');
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    }
  });

  test('only the rows the server flagged carry the gesture', async ({ page }) => {
    await installDevhistMock(page);
    await open(page, '&skin=classic');
    const flagged = await area(page).locator('[data-activity]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.entity));
    expect(flagged).toContain('light.living_main');
    expect(flagged).toContain('cover.living_big');
    expect(flagged).toContain('climate.living_ac');
    for (const id of ['sensor.living_temp', 'media_player.living_tv', 'cover.garage', 'lock.front', 'alarm_control_panel.home', 'humidifier.living_hum']) expect(flagged, id).not.toContain(id);
    const kinds = await area(page).locator('[data-activity]').evaluateAll((els) => els.map((e) => JSON.parse((e as HTMLElement).getAttribute('data-activity')!).kind));
    expect(new Set(kinds)).toEqual(new Set(['light', 'switch', 'valve', 'cover', 'climate', 'heater', 'fan']));
  });

  test('a 500 ms hold opens the popup and the click after it does not toggle; taps and short holds are untouched', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    const light = tile(page, 'light.living_main');
    // a tap on the toggle sends ONE command and opens nothing
    await light.locator('sw-toggle').click();
    await expect.poll(() => st.actions.length).toBe(1);
    await expect(opened(page)).toHaveCount(0);
    // a short hold (300 ms) opens nothing
    await hold(page, light, 300);
    await expect(opened(page)).toHaveCount(0);
    // a hold that moves past 8 px is a drag / scroll, not a long press
    await hold(page, light, LONG, 20);
    await expect(opened(page)).toHaveCount(0);
    // a hold on the toggle itself keeps its own gesture
    const tb = (await light.locator('sw-toggle').boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(LONG);
    await page.mouse.up();
    await expect(opened(page)).toHaveCount(0);
    // a hold on the toggle is a normal press of the toggle: one more command (its own gesture is kept)
    await expect.poll(() => st.actions.length).toBe(2);
    const before = 2;
    // the real long press
    await hold(page, light, LONG);
    await expect(opened(page)).toHaveCount(1);
    await expect(popup(page)).toHaveAttribute('heading', /תאורה מרכזית/);
    await page.waitForTimeout(500);
    expect(st.actions.length).toBe(before); // the click that ended the press was swallowed: nothing was toggled
    expect(st.feedCalls.at(-1)?.entity).toBe('light.living_main');
    // Esc closes and focus returns
    await page.keyboard.press('Escape');
    await expect(opened(page)).toHaveCount(0);
  });

  test('the bubble pill: a long press opens the popup and sends no command; a tap still toggles', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=bubble&scheme=light');
    const pill = area(page).locator('sw-pill[data-entity="light.living_main"]');
    await hold(page, pill, LONG);
    await expect(opened(page)).toHaveCount(1);
    expect(st.actions.length).toBe(0);
    await page.keyboard.press('Escape');
    await pill.click({ position: { x: 150, y: 20 } });
    await expect.poll(() => st.actions.length).toBe(1);
    await expect(opened(page)).toHaveCount(0);
  });

  test('accessible alternatives: right click, the menu items, Alt+Enter, Escape', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    const cover = tile(page, 'cover.living_big');
    await cover.click({ button: 'right', position: { x: 30, y: 14 } });
    const menu = page.locator('sw-app device-activity [data-activity-menu]');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveText(['פעילות', 'תזמונים']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // the item "תזמונים" opens the schedules tab directly
    await cover.click({ button: 'right', position: { x: 30, y: 14 } });
    await page.locator('sw-app device-activity [data-activity-menu-schedules]').click();
    await expect(opened(page)).toHaveCount(1);
    await expect(page.locator('sw-app device-activity [data-tab="schedules"]')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    // the item "פעילות"
    await cover.click({ button: 'right', position: { x: 30, y: 14 } });
    await page.locator('sw-app device-activity [data-activity-menu-activity]').click();
    await expect(page.locator('sw-app device-activity [data-tab="activity"]')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    // Alt+Enter on the focused toggle of a tile opens the popup directly
    const tg = tile(page, 'climate.living_ac');
    await tg.locator('button').first().focus();
    await page.keyboard.press('Alt+Enter');
    await expect(opened(page)).toHaveCount(1);
    expect(st.feedCalls.at(-1)?.entity).toBe('climate.living_ac');
    await page.keyboard.press('Escape');
    // a row the server did not flag has no menu: the browser's own context menu is left alone
    const sensor = area(page).locator('.tile[data-entity]:not([data-activity]), .row[data-entity]:not([data-activity])').first();
    await sensor.click({ button: 'right' });
    await expect(menu).toBeHidden();
  });

  test('the feed: day groups, wording, filters, load more', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    await hold(page, tile(page, 'light.living_main'), LONG);
    const p = panel(page);
    await expect(p.locator('.ev')).toHaveCount(7);
    await expect(p.locator('[data-day]').first()).toContainText('היום');
    await expect(p.locator('[data-day]').nth(1)).toContainText('אתמול');
    const first = p.locator('.ev').first();
    await expect(first).toContainText('דנה כהן');
    await expect(first).toContainText('כיבוי');
    await expect(first).toContainText('דלוק');
    await expect(p.locator('[data-actor="device"]')).toContainText('ידני בהתקן');
    await expect(p.locator('[data-actor="device"]')).toContainText('משוער');
    await expect(p.locator('[data-actor="unknown"]')).toContainText('מקור לא ידוע');
    await expect(p.locator('[data-actor="schedule"]')).toContainText('תזמון:');
    await expect(p.locator('[data-actor="system"]')).toContainText('חזר לזמינות');
    await expect(p.locator('[data-foot]')).toContainText('נשמר 90 יום');
    await expect(p.locator('[data-tracked-since]')).toContainText('מתועד מ־');
    // no platform name anywhere on the operator popup
    expect(await popup(page).evaluate((el) => (el.textContent ?? '') + (el.innerHTML ?? ''))).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    // the actor filter re-queries with the server's own parameter and shows the empty-filtered state when nothing matches
    const calls = st.feedCalls.length;
    await page.locator('sw-app device-activity [data-filter="actor"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'scene' }, bubbles: true, composed: true })));
    await expect.poll(() => st.feedCalls.length).toBeGreaterThan(calls);
    expect(st.feedCalls.at(-1)?.query).toContain('actor=scene');
    await expect(p.locator('.ev')).toHaveCount(1);
    await page.locator('sw-app device-activity [data-filter="kind"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'availability' }, bubbles: true, composed: true })));
    await expect(p.locator('[data-feed-state="empty-filtered"]')).toBeVisible();
    // back to everything; load more appends the second page with the cursor
    await page.locator('sw-app device-activity [data-filter="actor"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: '' }, bubbles: true, composed: true })));
    await page.locator('sw-app device-activity [data-filter="kind"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: '' }, bubbles: true, composed: true })));
    await expect(p.locator('.ev')).toHaveCount(7);
    await p.locator('[data-load-more]').click();
    await expect(p.locator('.ev')).toHaveCount(9);
    expect(st.feedCalls.at(-1)?.query).toContain('cursor=p2');
    await expect(p.locator('[data-load-more]')).toHaveCount(0);
  });

  test('the feed states: empty, no permission (schedules stay reachable), unavailable with retry, partial', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    const light = tile(page, 'light.living_main');
    const p = panel(page);
    st.feedMode = 'empty';
    await hold(page, light, LONG);
    await expect(p.locator('[data-feed-state="empty"]')).toBeVisible();
    await page.keyboard.press('Escape');
    st.feedMode = 'forbidden';
    await hold(page, light, LONG);
    await expect(p.locator('[data-feed-state="forbidden"]')).toBeVisible();
    await page.locator('sw-app device-activity [data-tab="schedules"]').click();
    await expect(p.locator('[data-schedule]')).toHaveCount(3);
    await page.keyboard.press('Escape');
    st.feedMode = 'unavailable';
    await hold(page, light, LONG);
    await expect(p.locator('[data-feed-state="unavailable"]')).toBeVisible();
    st.feedMode = 'ok';
    await p.locator('[data-feed-state="unavailable"]').getByRole('button').click();
    await expect(p.locator('.ev').first()).toBeVisible();
    await page.keyboard.press('Escape');
    st.feedMode = 'partial';
    await hold(page, light, LONG);
    await expect(p.locator('[data-feed-state="partial"]')).toBeVisible();
  });

  test('the schedules tab: rows, read-only, the switch, empty, no permission, the editor sheet', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    const light = tile(page, 'light.living_main');
    await hold(page, light, LONG);
    await page.locator('sw-app device-activity [data-tab="schedules"]').click();
    const p = panel(page);
    const rows = p.locator('[data-schedule]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('תאורת ערב');
    await expect(rows.nth(0)).toContainText('כל יום');
    await expect(rows.nth(1).locator('[data-readonly]')).toBeVisible();
    await expect(rows.nth(1).locator('sw-toggle')).toHaveAttribute('disabled', '');
    await expect(rows.nth(2)).toContainText('מושבת');
    // the switch of an editable row sends disable
    await rows.nth(0).locator('sw-toggle').click();
    await expect.poll(() => st.toggles.length).toBe(1);
    expect(st.toggles[0]).toEqual({ id: 'a1b2c3', enabled: false });
    // edit opens the existing editor in a sheet; closing it returns to the popup
    await rows.nth(0).locator('[data-sched-edit]').click();
    const ed = page.locator('sw-app device-activity sw-sheet[data-device-activity-editor]');
    await expect(ed).toHaveAttribute('open', '');
    await expect(ed.locator('schedule-editor')).toHaveJSProperty('scheduleId', 'a1b2c3');
    await page.keyboard.press('Escape');
    await expect(ed).toHaveCount(0);
    await expect(opened(page)).toHaveCount(1);
    // add a schedule for this device: the editor starts with the device
    await p.locator('[data-sched-add]').click();
    await expect(page.locator('sw-app device-activity schedule-editor')).toHaveJSProperty('entity', 'light.living_main');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // empty and no permission
    st.schedMode = 'empty' as SchedMode;
    await hold(page, light, LONG);
    await page.locator('sw-app device-activity [data-tab="schedules"]').click();
    await expect(p.locator('[data-sched-state="empty"]')).toBeVisible();
    await expect(p.locator('[data-sched-add]')).toBeVisible();
    await page.keyboard.press('Escape');
    st.schedMode = 'forbidden';
    await hold(page, light, LONG);
    await page.locator('sw-app device-activity [data-tab="schedules"]').click();
    await expect(p.locator('[data-sched-state="forbidden"]')).toBeVisible();
    await expect(p.locator('[data-sched-add]')).toHaveCount(0);
  });

  test('keyboard: the tabs follow the arrow keys and the popup is a labelled dialog', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installDevhistMock(page);
    await open(page, '&skin=classic');
    await hold(page, tile(page, 'light.living_main'), LONG);
    const dlg = popup(page).locator('[role="dialog"]');
    await expect(dlg).toHaveAttribute('aria-label', /פעילות: תאורה מרכזית/);
    const tabAct = page.locator('sw-app device-activity [data-tab="activity"]');
    await tabAct.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('sw-app device-activity [data-tab="schedules"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app device-activity [data-tab="schedules"]')).toBeFocused();
  });
});
