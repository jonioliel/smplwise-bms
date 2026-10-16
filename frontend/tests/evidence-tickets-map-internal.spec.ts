import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installTicketsDeviceMock } from './tickets-device-mocks';
import { DH_NOW } from './devhist-mocks';
import { drawerScrollers } from './tickets-scrollers';
import { installMapMock, ATTACHED, GONE, TEXT_ONLY, T_MAP, F0, F1, F2, AC, CAMERA, LOBBY, DOTS } from './tickets-map-mocks';

// TKMAPSPEC (TKMAP1, owner 16.10) against the MOCKED backend (tests/tickets-map-mocks.ts over tests/tickets-mocks.ts / tickets-device-mocks.ts):
//   1. the request drawer's map chip (Overview tab): empty, attached, "the element is no longer on the map", text-only (no picture), the
//      vendor preview "מה הספק רואה" (the very picture the vendor page shows), add / replace / remove, a read-only caller, no right at all.
//   2. the picker: floor first, then a click on the plan (the dot is hit by the same rule as the app), the keyboard chip path, the floor
//      without a plan, the floor change that drops the choice, cancel writes nothing.
//   3. the entry points: "פתח בקשת שירות" on the live map's card of a device and of a camera, on the camera page and in the device window -
//      the create flow carries the element (the line "רכיב מהמפה", the attach call right after the request exists, entity_id for a device).
// Shots go to test-results/evidence-tickets-map-internal (never committed).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-map-internal.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/evidence-tickets-map-internal');
const D = 'sw-app tickets-list ticket-detail';
const CHIP = `${D} ticket-map-element`;

test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });
test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

async function shot(page: Page, name: string, scheme = 'light') {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`) });
}

/** opens the request drawer at the Overview tab as the manager persona and waits for the chip to have loaded its answer */
async function openDrawer(page: Page, state: Parameters<typeof installMapMock>[1] = {}, persona: 'admin' | 'viewer' = 'admin') {
  await installTicketsMock(page, { persona });
  const mm = await installMapMock(page, state);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/all?t=${T_MAP}`));
  await page.waitForSelector(`${D} [data-tab-panel="overview"]`, { timeout: 20_000 });
  return mm;
}
const chip = (page: Page) => page.locator(CHIP);
const state = (page: Page, s: 'none' | 'present' | 'gone') => page.locator(`${CHIP} [data-map-element="${s}"]`);
const picker = (page: Page) => page.locator(`${CHIP} ticket-map-picker [data-map-picker]`);
const pickerOf = (page: Page, sel: string) => page.locator(`${CHIP} ticket-map-picker ${sel}`);

/** clicks the plan at an element's own place (the stage listens to the click and picks the nearest dot) */
async function clickOnPlan(page: Page, x: number, y: number) {
  const stage = pickerOf(page, '[data-map-stage]');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await page.mouse.click(b.x + x * b.width, b.y + y * b.height);
}
const dot = (id: string) => DOTS[id];

test.describe('TKMAP1 internal: the map chip in the request drawer', () => {
  test('empty: only "הוסף רכיב מהמפה"; nothing to show, preview or remove', async ({ page }) => {
    await openDrawer(page);
    await expect(state(page, 'none')).toBeVisible();
    await expect(chip(page).locator('[data-map-pick]')).toHaveText(/הוסף רכיב מהמפה/);
    for (const sel of ['[data-map-line]', '[data-map-show]', '[data-map-preview]', '[data-map-remove]', '[data-map-gone]']) await expect(chip(page).locator(sel)).toHaveCount(0);
    expect(await drawerScrollers(page)).toEqual(['div.body']);
    await shot(page, 'chip-empty');
  });

  test('attached: the line, "הצג במפה" to the live map with the element focused, replace and remove', async ({ page }) => {
    await openDrawer(page, { state: { [T_MAP]: ATTACHED } });
    await expect(state(page, 'present')).toBeVisible();
    const line = chip(page).locator('[data-map-line]');
    await expect(line).toContainText('מזגן משרד');
    await expect(line).toContainText('קומה 2');
    await expect(line).toContainText('משרד 12');
    await expect(chip(page).locator('[data-map-show]')).toHaveAttribute('href', `#/explore/floors/${F2}?entity=${AC.entity}`);
    await expect(chip(page).locator('[data-map-pick]')).toHaveText(/החלף רכיב/);
    await expect(chip(page).locator('[data-map-remove]')).toBeVisible();
    await expect(chip(page).locator('[data-map-gone]')).toHaveCount(0);
    expect(await drawerScrollers(page)).toEqual(['div.body']);
    await shot(page, 'chip-attached');
  });

  test('"מה הספק רואה": the very picture the vendor page shows, toggled on and off', async ({ page }) => {
    const mm = await openDrawer(page, { state: { [T_MAP]: ATTACHED } });
    const btn = chip(page).locator('[data-map-preview]');
    await expect(btn).toHaveText(/מה הספק רואה/);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page).locator('[data-map-preview-image]')).toHaveCount(0);
    expect(mm.previews).toHaveLength(0); // nothing is fetched before it is asked for
    await btn.click();
    const img = chip(page).locator('[data-map-preview-image] img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', new RegExp(`tickets/${T_MAP}/map-element/vendor\\.svg$`));
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveText(/הסתר תמונה/);
    expect(mm.previews).toEqual([T_MAP]);
    expect(await drawerScrollers(page)).toEqual(['div.body']);
    await shot(page, 'chip-vendor-preview');
    await btn.click();
    await expect(chip(page).locator('[data-map-preview-image]')).toHaveCount(0);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('"no longer on the map": the stored text and the reason, no link and no preview', async ({ page }) => {
    await openDrawer(page, { state: { [T_MAP]: GONE } });
    await expect(state(page, 'gone')).toBeVisible();
    await expect(chip(page).locator('[data-map-line]')).toContainText('מזגן משרד');
    await expect(chip(page).locator('[data-map-gone]')).toContainText('כבר לא במפה');
    await expect(chip(page).locator('[data-map-show]')).toHaveCount(0);
    await expect(chip(page).locator('[data-map-preview]')).toHaveCount(0);
    await expect(chip(page).locator('[data-map-vendor-text]')).toHaveCount(0); // the "gone" reason replaces the vendor note
    await expect(chip(page).locator('[data-map-pick]')).toHaveText(/החלף רכיב/);
    await expect(chip(page).locator('[data-map-remove]')).toBeVisible();
    await shot(page, 'chip-gone');
  });

  test('on the map but no picture (no published plan): the vendor sees the text only', async ({ page }) => {
    await openDrawer(page, { state: { [T_MAP]: TEXT_ONLY } });
    await expect(state(page, 'present')).toBeVisible();
    await expect(chip(page).locator('[data-map-vendor-text]')).toContainText('התיאור בלבד');
    await expect(chip(page).locator('[data-map-preview]')).toHaveCount(0);
    await expect(chip(page).locator('[data-map-show]')).toBeVisible();
    await shot(page, 'chip-text-only');
  });

  test('remove: DELETE, the chip goes back to empty, the confirmation is short', async ({ page }) => {
    const mm = await openDrawer(page, { state: { [T_MAP]: ATTACHED } });
    await chip(page).locator('[data-map-remove]').click();
    await expect(state(page, 'none')).toBeVisible();
    await expect(chip(page).locator('[data-map-note]')).toHaveText('הרכיב הוסר מהבקשה');
    expect(mm.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE tickets/${T_MAP}/map-element`]);
    await expect(chip(page).locator('[data-map-remove]')).toHaveCount(0);
    await expect(chip(page).locator('[data-map-pick]')).toHaveText(/הוסף רכיב מהמפה/);
  });

  test('read-only caller: the line stays, add / replace / remove are absent; no element and no right: no chip at all', async ({ page }) => {
    await openDrawer(page, { state: { [T_MAP]: ATTACHED }, can: { attach: false, detach: false } });
    await expect(state(page, 'present')).toBeVisible();
    await expect(chip(page).locator('[data-map-show]')).toBeVisible();
    await expect(chip(page).locator('[data-map-pick], [data-map-remove]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await openDrawer(page, { can: { attach: false, detach: false } });
    await expect(chip(page).locator('section')).toHaveCount(0);
    await expect(page.locator(`${D} [data-tab-panel="overview"]`)).toBeVisible();
  });
});

test.describe('TKMAP1 internal: the picker', () => {
  test('floor first, then a click on the plan: choose, switch floors (the choice is dropped), a floor without a plan, then attach', async ({ page }) => {
    const mm = await openDrawer(page);
    await chip(page).locator('[data-map-pick]').click();
    await expect(picker(page)).toBeVisible();
    // the floors: highest first, the one with a plan is the start
    const sel = pickerOf(page, '[data-map-floor]');
    await expect(sel.locator('option')).toHaveText(['קומה 2', 'קומה 1', 'גג']);
    await expect(sel).toHaveValue(F2);
    await expect(pickerOf(page, '[data-pick-dot]')).toHaveCount(2);
    await expect(pickerOf(page, '[data-map-save]')).toBeDisabled();
    await expect(pickerOf(page, '[data-map-chosen]')).toHaveCount(0);
    // a click on empty plan chooses nothing; a click on the element chooses it
    await clickOnPlan(page, 0.9, 0.1);
    await expect(pickerOf(page, '[data-map-chosen]')).toHaveCount(0);
    await clickOnPlan(page, dot(AC.anchor).x, dot(AC.anchor).y);
    await expect(pickerOf(page, '[data-map-chosen]')).toContainText('מזגן משרד');
    await expect(pickerOf(page, `[data-pick-item="anchor:${AC.anchor}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(pickerOf(page, '[data-map-save]')).toBeEnabled();
    await shot(page, 'picker-chosen');
    // another floor: the choice goes, that floor's dots come
    await sel.selectOption(F1);
    await expect(pickerOf(page, '[data-map-chosen]')).toHaveCount(0);
    await expect(pickerOf(page, '[data-pick-dot]')).toHaveCount(1);
    await expect(pickerOf(page, '[data-map-save]')).toBeDisabled();
    // a floor without a published plan says so and offers nothing
    await sel.selectOption(F0);
    await expect(pickerOf(page, '[data-map-noplan]')).toBeVisible();
    await expect(pickerOf(page, '[data-map-stage]')).toHaveCount(0);
    await shot(page, 'picker-noplan');
    // back on floor 1: pick the lobby light and attach it
    await sel.selectOption(F1);
    await clickOnPlan(page, dot(LOBBY.anchor).x, dot(LOBBY.anchor).y);
    await expect(pickerOf(page, '[data-map-chosen]')).toContainText('תאורת לובי');
    await pickerOf(page, '[data-map-save]').click();
    await expect(picker(page)).toHaveCount(0);
    await expect(state(page, 'present')).toBeVisible();
    await expect(chip(page).locator('[data-map-line]')).toContainText('תאורת לובי');
    await expect(chip(page).locator('[data-map-line]')).toContainText('קומה 1');
    await expect(chip(page).locator('[data-map-note]')).toHaveText('הרכיב צורף לבקשה');
    expect(mm.writes).toEqual([{ method: 'PUT', path: `tickets/${T_MAP}/map-element`, body: { element: { floor_id: F1, kind: 'anchor', id: LOBBY.anchor } } }]);
  });

  test('keyboard: the element chips are buttons - Tab to one, Enter chooses it, the save button attaches', async ({ page }) => {
    const mm = await openDrawer(page);
    await chip(page).locator('[data-map-pick]').click();
    await expect(picker(page)).toBeVisible();
    await expect(pickerOf(page, '[data-pick-item]')).toHaveCount(2);
    const items = pickerOf(page, '[data-pick-item]');
    await items.first().focus();
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Tab');
    const second = items.nth(1);
    await expect(second).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(pickerOf(page, '[data-map-chosen]')).toBeVisible();
    await expect(pickerOf(page, '[data-map-save]')).toBeEnabled();
    // a second chip is exclusive: choosing the first one releases the second
    await items.first().focus();
    await page.keyboard.press('Space');
    await expect(items.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    await pickerOf(page, '[data-map-save]').focus();
    await page.keyboard.press('Enter');
    await expect(picker(page)).toHaveCount(0);
    await expect(state(page, 'present')).toBeVisible();
    expect(mm.writes).toHaveLength(1);
    expect(mm.writes[0].method).toBe('PUT');
    expect((mm.writes[0].body as { element: { floor_id: string; kind: string } }).element).toMatchObject({ floor_id: F2, kind: 'anchor' });
  });

  test('replace and cancel: the chip says "החלף רכיב"; cancel closes the picker and writes nothing', async ({ page }) => {
    const mm = await openDrawer(page, { state: { [T_MAP]: ATTACHED } });
    await chip(page).locator('[data-map-pick]').click();
    await expect(picker(page)).toBeVisible();
    await expect(pickerOf(page, '[data-map-save]')).toBeDisabled();
    await pickerOf(page, '.sheetfoot .btn:not(.primary)').click();
    await expect(picker(page)).toHaveCount(0);
    expect(mm.writes).toHaveLength(0);
    await expect(chip(page).locator('[data-map-line]')).toContainText('מזגן משרד');
    // the replace itself
    await chip(page).locator('[data-map-pick]').click();
    await clickOnPlan(page, dot(CAMERA.anchor).x, dot(CAMERA.anchor).y);
    await pickerOf(page, '[data-map-save]').click();
    await expect(chip(page).locator('[data-map-line]')).toContainText('מצלמת לובי');
    expect(mm.writes.map((w) => w.method)).toEqual(['PUT']);
    expect((mm.writes[0].body as { element: { id: string } }).element.id).toBe(CAMERA.anchor);
    // the preview toggle starts closed again
    await expect(chip(page).locator('[data-map-preview]')).toHaveAttribute('aria-pressed', 'false');
  });
});

/** the create flow from a map element: the line "רכיב מהמפה", the title, submit */
async function createFrom(page: Page, line: RegExp | string, title: string) {
  const form = page.locator('[data-create-form]').first();
  await expect(form).toBeVisible();
  await expect(page.locator('[data-create-map-element]')).toContainText(line);
  await page.locator('[data-create-title]').fill(title);
  await page.locator('[data-create-submit]').click();
}
const posts = (calls: { method: string; path: string; body: unknown }[]) => calls.filter((c) => c.method === 'POST' && c.path === 'tickets');

test.describe('TKMAP1 internal: "פתח בקשת שירות" from the map', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the entry points run once, on the desktop layout'));

  test('live map, a device card: the create form gets the element (and the device), the attach follows, the new request opens with the chip', async ({ page }) => {
    const tm = await installTicketsMock(page, { persona: 'admin' });
    const mm = await installMapMock(page);
    await page.goto(url(`/explore/floors/${F2}?entity=${AC.entity}`));
    const btn = page.locator('explore-floor-map [data-map-ticket]');
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await expect(btn).toHaveText(/פתח בקשת שירות/);
    await btn.click();
    await createFrom(page, /מזגן משרד/, 'המזגן מטפטף');
    await expect(page.locator('[data-create-map-element]')).toHaveCount(0);
    await expect.poll(() => mm.writes.length).toBe(1);
    expect(posts(tm.calls)).toHaveLength(1);
    expect(posts(tm.calls)[0].body).toMatchObject({ title: 'המזגן מטפטף', entity_id: AC.entity }); // a device on the map: the request is for that device too
    expect(mm.writes[0].method).toBe('PUT');
    expect(mm.writes[0].body).toEqual({ element: { floor_id: F2, kind: 'anchor', id: AC.anchor } });
    // the new request opens and carries the element
    await expect(page.locator(`${D} [data-map-element="present"]`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${CHIP} [data-map-line]`)).toContainText('מזגן משרד');
    await shot(page, 'create-from-live-map-device');
  });

  test('live map, a camera card: the element is the camera anchor, no device is attached to the request', async ({ page }) => {
    const tm = await installTicketsMock(page, { persona: 'admin' });
    const mm = await installMapMock(page);
    await page.goto(url(`/explore/floors/${F2}?camera=${CAMERA.camera}`));
    await page.locator('explore-floor-map [data-map-ticket]').click();
    await createFrom(page, /מצלמת לובי/, 'התמונה מטושטשת');
    await expect.poll(() => mm.writes.length).toBe(1);
    expect(mm.writes[0].body).toEqual({ element: { floor_id: F2, kind: 'anchor', id: CAMERA.anchor } });
    expect(posts(tm.calls)[0].body).not.toHaveProperty('entity_id');
  });

  test('live map without tickets.create: no button on the card', async ({ page }) => {
    await installTicketsMock(page, { persona: 'viewer' });
    await installMapMock(page);
    await page.goto(url(`/explore/floors/${F2}?entity=${AC.entity}`));
    await expect(page.locator('explore-floor-map sw-plan-canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await expect(page.locator('explore-floor-map [data-map-ticket]')).toHaveCount(0);
  });

  test('the camera page: "פתח בקשת שירות" attaches the camera through its current place on the map', async ({ page }) => {
    const tm = await installTicketsMock(page, { persona: 'admin' });
    const mm = await installMapMock(page);
    await page.goto(url(`/live/cameras/${CAMERA.camera}`));
    const btn = page.locator('[data-camera-ticket]');
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    await createFrom(page, /מצלמת לובי/, 'התמונה קפואה');
    await expect.poll(() => mm.writes.length).toBe(1);
    expect(mm.writes[0].body).toEqual({ resource: { type: 'camera', id: CAMERA.camera } });
    expect(posts(tm.calls)).toHaveLength(1);
    await shot(page, 'create-from-camera-page');
  });

  test('the device window: the request is for the device and the device\'s place on the map is attached', async ({ page }) => {
    await page.clock.setFixedTime(new Date(DH_NOW));
    const st = await installTicketsDeviceMock(page, { mode: 'menu' });
    const mm = await installMapMock(page);
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/areas/living');
    await page.waitForSelector('sw-app devices-area [data-entity]');
    await page.waitForTimeout(700);
    const dev = page.locator('sw-app devices-area [data-entity="light.living_main"][data-activity]').first();
    await dev.click({ button: 'right', position: { x: 20, y: 14 } });
    await page.locator('sw-app device-activity [data-activity-menu-ticket-new]').click();
    const sheet = page.locator('sw-app device-activity ticket-create');
    await expect(sheet.locator('[data-create-device="light.living_main"]')).toBeVisible();
    await expect(sheet.locator('[data-create-map-element]')).toHaveCount(0); // the device block already says what it is for
    await sheet.locator('[data-create-title]').fill('הנורה כבתה');
    await sheet.locator('[data-create-submit]').click();
    await expect.poll(() => st.created.length).toBe(1);
    expect(st.created[0]).toMatchObject({ entity_id: 'light.living_main', title: 'הנורה כבתה' });
    await expect.poll(() => mm.writes.length).toBe(1);
    expect(mm.writes[0].method).toBe('PUT');
    expect(mm.writes[0].body).toEqual({ resource: { type: 'ha_entity', id: 'light.living_main' } });
  });

  test('a failed attach does not lose the request: it is created, the chip is offered in its drawer', async ({ page }) => {
    const tm = await installTicketsMock(page, { persona: 'admin' });
    await installMapMock(page);
    await page.route(/\/api\/v1\/tickets\/[\w-]+\/map-element$/, (route) =>
      route.request().method() === 'PUT' ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'm', details: {} }) }) : route.fallback());
    await page.goto(url(`/explore/floors/${F2}?entity=${AC.entity}`));
    await page.locator('explore-floor-map [data-map-ticket]').click();
    await createFrom(page, /מזגן משרד/, 'בלי רכיב');
    await expect.poll(() => posts(tm.calls).length).toBe(1);
    await expect(page.locator(`${D} [data-tab-panel="overview"]`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${CHIP} [data-map-element="none"]`)).toBeVisible();
    await expect(page.locator(`${CHIP} [data-map-pick]`)).toHaveText(/הוסף רכיב מהמפה/);
  });
});
