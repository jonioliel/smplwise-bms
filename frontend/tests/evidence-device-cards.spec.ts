import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDevhistMock, DH_NOW } from './devhist-mocks';

// CARD1 (2026-10-07): the three equipment cards of the device activity window - water heater (switch.boiler, named as a boiler), tap
// (switch.irrigation, a relay-wired tap; valve.garden, a valve entity) and robot vacuum (vacuum.robo) - against the mocked backend
// (tests/devhist-mocks.ts).
//   1. shots -> docs/design/evidence/device-cards/: each card at 1440 / 1024 / 390, light and dark (classic skin), the bubble skin once,
//      plus the boost chip state, the hold in progress and the read-only card.
//   2. behaviour (desktop): the heater's on / off and the time-boxed run (turn on + a one-off `single` schedule through POST /schedules,
//      shown as "כיבוי אוטומטי · HH:MM" and cancelled through the schedule's delete); the tap's hold-to-confirm (a short press sends
//      nothing, a 1.1 s hold sends; a valve entity gets open_valve WITH the grant, close_valve without); the vacuum's start / pause /
//      dock, battery and last cleaning; no controls without can_control; no platform name anywhere.
// Needs the Vite DEV server (the dials go through /src/design/look.ts).
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/device-cards');

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
const card = (page: Page) => page.locator('sw-app device-activity [data-device-card]');

/** Hold the mouse on the title area of a tile (away from its toggle). */
async function hold(page: Page, loc: Locator, ms: number) {
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width - 34, b.y + 14);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Press the hold-to-confirm button for `ms`. */
async function pressHold(page: Page, ms: number) {
  const b = (await card(page).locator('[data-card-hold]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const LONG = 650;

async function openCard(page: Page, id: string, skin: 'classic' | 'bubble' = 'classic') {
  const target = skin === 'bubble' ? area(page).locator(`sw-pill[data-entity="${id}"]`) : tile(page, id);
  await hold(page, target, LONG);
  await expect(opened(page)).toHaveCount(1);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[data-card-loading]')).toHaveCount(0);
  await expect(page.locator('sw-app device-activity #da-panel .ev').first()).toBeVisible();
}

async function closeCard(page: Page) {
  await page.keyboard.press('Escape');
  await expect(opened(page)).toHaveCount(0);
  await page.waitForTimeout(450);
}

test.describe('device cards: water heater, tap, robot vacuum', () => {
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

  test('evidence shots: the three cards, light and dark, classic and bubble', async ({ page }, info) => {
    test.setTimeout(8 * 60_000);
    const w = info.project.name === 'mobile' ? 390 : info.project.name === 'tablet' ? 1024 : 1440;
    const tag = String(w);
    for (const scheme of ['light', 'dark'] as const) {
      const st = await installDevhistMock(page, { rows: { 'switch.irrigation': { state: 'on', active: true } } });
      await open(page, `&skin=classic&scheme=${scheme}`);
      await openCard(page, 'switch.boiler');
      await shot(page, `heater-${tag}-${scheme}`);
      await closeCard(page);
      await openCard(page, 'switch.irrigation');
      await shot(page, `tap-open-${tag}-${scheme}`);
      await closeCard(page);
      await openCard(page, 'valve.garden');
      await shot(page, `valve-closed-${tag}-${scheme}`);
      if (scheme === 'light') {
        // the hold in progress
        const b = (await card(page).locator('[data-card-hold]').boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await shot(page, `valve-holding-${tag}-${scheme}`);
        await page.mouse.up();
      }
      await closeCard(page);
      await openCard(page, 'vacuum.robo');
      await shot(page, `vacuum-${tag}-${scheme}`);
      await closeCard(page);
      if (scheme === 'light') {
        // the heater with its auto-off pending
        await openCard(page, 'switch.boiler');
        await card(page).locator('[data-card-off]').click();
        await expect.poll(() => st.actions.length).toBe(1);
        await expect(card(page).locator('[data-card-timer="60"]')).toBeVisible();
        await card(page).locator('[data-card-timer="60"]').click();
        await expect(card(page).locator('[data-card-auto-off]')).toBeVisible();
        await shot(page, `heater-auto-off-${tag}-${scheme}`);
        await closeCard(page);
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
    // read-only: no controls, state only
    await installDevhistMock(page, { rows: { 'vacuum.robo': { can_control: false, state: 'cleaning', active: true } } });
    await open(page, '&skin=classic&scheme=light');
    await openCard(page, 'vacuum.robo');
    await expect(card(page).locator('[data-card-actions]')).toHaveCount(0);
    await shot(page, `vacuum-readonly-${tag}-light`);
    await closeCard(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    if (info.project.name === 'desktop') {
      await installDevhistMock(page);
      await open(page, '&skin=bubble&scheme=light');
      await openCard(page, 'switch.boiler', 'bubble');
      await shot(page, `heater-bubble-${tag}-light`);
      await closeCard(page);
      await openCard(page, 'vacuum.robo', 'bubble');
      await shot(page, `vacuum-bubble-${tag}-light`);
      await closeCard(page);
    }
  });

  test('the water heater: state, on / off through the switch services, the time-boxed run creates a one-off schedule and can be cancelled', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    await openCard(page, 'switch.boiler');
    const c = card(page);
    await expect(c).toHaveAttribute('data-device-card', 'water_heater');
    await expect(c.locator('[data-card-big]')).toHaveText('דלוק');
    await expect(c.locator('[data-card-since]')).toContainText('מאז');
    // on: "כיבוי", and the chips set an auto-off only (nothing is turned on again); off sends switch.turn_off
    await expect(c.locator('[data-card-on]')).toHaveCount(0);
    await expect(c.locator('[data-card-timers]')).toHaveAttribute('data-card-timers-mode', 'off-only');
    await expect(c.locator('[data-card-timers] .cl')).toHaveText('כיבוי אוטומטי');
    await c.locator('[data-card-off]').click();
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'switch.boiler', action_id: 'switch.turn_off', confirmed: false });
    await expect(c.locator('[data-card-big]')).toHaveText('כבוי');
    await expect(c.locator('[data-cmd-status]')).toBeVisible();
    // off: "הדלקה" plus the three boost chips (turn on + auto-off)
    await expect(c.locator('[data-card-on]')).toBeVisible();
    await expect(c.locator('[data-card-timers]')).toHaveAttribute('data-card-timers-mode', 'boost');
    await expect(c.locator('[data-card-timer]')).toHaveCount(3);
    await c.locator('[data-card-timer="30"]').click();
    // the schedule is created FIRST (never an unbounded run by accident), then the switch is turned on
    await expect.poll(() => st.created.length).toBe(1);
    const draft = st.created[0].draft as { repeat: string; weekdays: string[]; name: string; slots: { start: string; stop: null; actions: { service: string; entity_id: string }[] }[] };
    expect(draft.repeat).toBe('single');
    expect(draft.weekdays).toEqual(['daily']);
    expect(draft.name).toContain('דוד שמש');
    expect(draft.slots).toHaveLength(1);
    expect(draft.slots[0].actions).toEqual([{ service: 'switch.turn_off', entity_id: 'switch.boiler', data: {} }]);
    expect(draft.slots[0].start).toBe('16:30:00'); // 13:00Z = 16:00 in Jerusalem + 30 minutes
    await expect.poll(() => st.actions.length).toBe(2);
    expect(st.actions[1]).toMatchObject({ entity_id: 'switch.boiler', action_id: 'switch.turn_on' });
    await expect(c.locator('[data-card-auto-off]')).toContainText('כיבוי אוטומטי');
    await expect(c.locator('[data-card-auto-off]')).toContainText('16:30');
    await expect(c.locator('[data-card-timers]')).toHaveCount(0);
    // the schedules tab lists it too (the device's own schedules, from the existing filter)
    await expect(page.locator('sw-app device-activity [data-tab="schedules"] .cnt')).toHaveText('4');
    // cancel = the schedule's own delete
    await c.locator('[data-card-auto-off-cancel]').click();
    await expect.poll(() => st.deleted.length).toBe(1);
    expect(st.deleted[0]).toBe('auto1');
    await expect(c.locator('[data-card-auto-off]')).toHaveCount(0);
    await expect(page.locator('sw-app device-activity [data-tab="schedules"] .cnt')).toHaveText('3');
    expect(await popup(page).evaluate((el) => (el.textContent ?? '') + (el.innerHTML ?? ''))).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });

  test('the tap: a short press sends nothing, a held press opens; close is one tap; a valve entity gets open_valve with the grant', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    await openCard(page, 'switch.irrigation');
    const c = card(page);
    await expect(c).toHaveAttribute('data-device-card', 'valve');
    await expect(c.locator('[data-card-big]')).toHaveText('סגור');
    await expect(c.locator('[data-card-hold]')).toBeVisible();
    await expect(c.locator('[data-card-on]')).toHaveCount(0);
    await pressHold(page, 300);
    await page.waitForTimeout(300);
    expect(st.actions.length).toBe(0);
    await pressHold(page, 1400);
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'switch.irrigation', action_id: 'switch.turn_on' });
    await expect(c.locator('[data-card-big]')).toHaveText('פתוח');
    // open: close is one tap, and the auto-close chips exist (a relay-wired tap is schedulable); closed: none - opening stays behind the hold
    await expect(c.locator('[data-card-hold]')).toHaveCount(0);
    await expect(c.locator('[data-card-off]')).toBeVisible();
    await expect(c.locator('[data-card-timers] .cl')).toHaveText('סגירה אוטומטית');
    await expect(c.locator('[data-card-timer]')).toHaveCount(3);
    await c.locator('[data-card-off]').click();
    await expect.poll(() => st.actions.length).toBe(2);
    expect(st.actions[1]).toMatchObject({ entity_id: 'switch.irrigation', action_id: 'switch.turn_off', confirmed: false });
    await expect(c.locator('[data-card-timers]')).toHaveCount(0); // closed: no auto-close to offer
    // keyboard alternative: Enter arms ("לאשר?"), a second Enter sends
    await c.locator('[data-card-hold]').focus();
    await page.keyboard.press('Enter');
    await expect(c.locator('[data-card-hold]')).toContainText('לאשר?');
    await page.keyboard.press('Enter');
    await expect.poll(() => st.actions.length).toBe(3);
    expect(st.actions[2].action_id).toBe('switch.turn_on');
    await closeCard(page);
    // a valve.* entity: open_valve carries the confirmation grant, close_valve does not; no auto-close (the scheduler cannot carry it)
    await openCard(page, 'valve.garden');
    await expect(c.locator('[data-card-big]')).toHaveText('סגור');
    await pressHold(page, 1400);
    await expect.poll(() => st.actions.length).toBe(4);
    expect(st.actions[3]).toMatchObject({ entity_id: 'valve.garden', action_id: 'valve.open_valve', confirmed: true });
    await expect(c.locator('[data-card-big]')).toHaveText('פתוח');
    await expect(c.locator('[data-card-timers]')).toHaveCount(0);
    await c.locator('[data-card-off]').click();
    await expect.poll(() => st.actions.length).toBe(5);
    expect(st.actions[4]).toMatchObject({ entity_id: 'valve.garden', action_id: 'valve.close_valve', confirmed: false });
  });

  test('the robot vacuum: battery, suction and the last cleaning from the feed; start / pause / dock', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page);
    await open(page, '&skin=classic');
    await openCard(page, 'vacuum.robo');
    const c = card(page);
    await expect(c).toHaveAttribute('data-device-card', 'vacuum');
    await expect(c.locator('[data-card-big]')).toHaveText('בעגינה');
    await expect(c.locator('[data-card-battery]')).toContainText('81%');
    await expect(c.locator('[data-card-meta]')).toContainText('שאיבה שקטה');
    await expect(c.locator('[data-card-last-clean]')).toContainText('ניקוי אחרון');
    await expect(c.locator('[data-card-last-clean]')).toContainText('13:40'); // the newest "to cleaning" event, 140 minutes before 16:00
    // docked: start only
    await expect(c.locator('[data-card-vac-start]')).toBeVisible();
    await expect(c.locator('[data-card-vac-dock]')).toHaveCount(0);
    await c.locator('[data-card-vac-start]').click();
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'vacuum.robo', action_id: 'vacuum.start', confirmed: false });
    await expect(c.locator('[data-card-big]')).toHaveText('מנקה');
    // cleaning: pause and dock
    await c.locator('[data-card-vac-pause]').click();
    await expect.poll(() => st.actions.length).toBe(2);
    expect(st.actions[1].action_id).toBe('vacuum.pause');
    await expect(c.locator('[data-card-big]')).toHaveText('מושהה');
    await c.locator('[data-card-vac-dock]').click();
    await expect.poll(() => st.actions.length).toBe(3);
    expect(st.actions[2].action_id).toBe('vacuum.return_to_base');
    await expect(c.locator('[data-card-big]')).toHaveText('חוזר לעגינה');
    // the feed under the card keeps the vacuum wording
    await expect(page.locator('sw-app device-activity #da-panel .ev').first()).toContainText('חזרה לעגינה');
    expect(await popup(page).evaluate((el) => (el.textContent ?? '') + (el.innerHTML ?? ''))).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });

  test('the area tiles of the equipment are read-only (no toggle): the window holds the controls', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installDevhistMock(page);
    await open(page, '&skin=classic');
    for (const id of ['vacuum.robo', 'valve.garden']) {
      const tl = tile(page, id);
      await expect(tl).toBeVisible();
      await expect(tl.locator('sw-toggle')).toHaveCount(0);
      await expect(tl).not.toHaveAttribute('data-can-control', '');
    }
    await expect(tile(page, 'vacuum.robo').locator('.s')).toHaveText('בעגינה');
    await expect(tile(page, 'valve.garden').locator('.s')).toHaveText('סגור');
    await expect(tile(page, 'switch.boiler').locator('sw-toggle')).toHaveCount(1); // a relay-wired boiler keeps its tile toggle
  });
});
