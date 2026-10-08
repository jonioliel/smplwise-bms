import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDevhistMock, DH_NOW, DH_WATER_HEATER } from './devhist-mocks';

// VER1 (2026-10-08): closes the CARD1 gaps that evidence-device-cards.spec.ts leaves, against the same mocked backend:
//   - a NATIVE water_heater.* entity (the existing spec only has a relay-wired boiler): water_heater.turn_on / turn_off, no auto-off chips;
//   - the answer of a bridge that predates CARD1 (service_not_allowed) and of a refused user: each card rolls back with the honest note,
//     nothing stays "pending", no platform name leaks;
//   - RTL and phone width on every project: the page and the card are right-to-left, nothing overflows horizontally, the buttons are
//     inside the viewport and tall enough to press.
// Shots -> docs/design/evidence/device-cards-verify/. Needs the Vite DEV server; run through run_smart spec.
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/device-cards-verify');

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
const opened = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity][open]');
const popup = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity]');
const card = (page: Page) => page.locator('sw-app device-activity [data-device-card]');

async function hold(page: Page, loc: Locator, ms: number) {
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width - 34, b.y + 14);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function pressHold(page: Page, ms: number) {
  const b = (await card(page).locator('[data-card-hold]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function openCard(page: Page, id: string) {
  await hold(page, tile(page, id), 650);
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

/** The add-on's answer when the bridge refuses (or HA denies) the call: the record the UI settles on. */
async function answerActions(page: Page, status: 'failed' | 'denied', error: string) {
  await page.route('**/api/v1/ha/entities/*/actions', (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'x1', entity_id: 'x', action_id: 'x', status, confirmation: 'state', error, requested_at: '2026-10-05T13:00:00Z', confirmed_at: null }),
    }),
  );
}

test.describe('device cards verification (VER1)', () => {
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

  test('a native water_heater entity: on / off send water_heater.turn_on / turn_off, no auto-off chips', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page, { extra: [DH_WATER_HEATER] });
    await open(page, '&skin=classic');
    await openCard(page, 'water_heater.tank');
    const c = card(page);
    await expect(c).toHaveAttribute('data-device-card', 'water_heater');
    await expect(c.locator('[data-card-big]')).toHaveText('דלוק'); // "eco" is an operation mode: on
    await expect(c.locator('[data-card-timers]')).toHaveCount(0); // the scheduler cannot carry a water_heater service
    await c.locator('[data-card-off]').click();
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'water_heater.tank', action_id: 'water_heater.turn_off', args: {}, confirmed: false });
    await expect(c.locator('[data-card-big]')).toHaveText('כבוי');
    await c.locator('[data-card-on]').click();
    await expect.poll(() => st.actions.length).toBe(2);
    expect(st.actions[1]).toMatchObject({ entity_id: 'water_heater.tank', action_id: 'water_heater.turn_on', args: {}, confirmed: false });
    expect(st.created).toHaveLength(0);
    expect(await popup(page).evaluate((el) => (el.textContent ?? '') + (el.innerHTML ?? ''))).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });

  test('an old bridge (service_not_allowed) rolls every card back with the honest note', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page, { extra: [DH_WATER_HEATER] });
    await answerActions(page, 'failed', 'service_not_allowed');
    await open(page, '&skin=classic');
    const note = () => card(page).locator('[data-cmd-status="rolled_back"]');

    await openCard(page, 'valve.garden'); // closed: the hold opens it, with the grant
    await pressHold(page, 1400);
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'valve.garden', action_id: 'valve.open_valve', confirmed: true });
    await expect(note()).toContainText('הגשר סירב');
    await expect(card(page).locator('[data-card-big]')).toHaveText('סגור'); // never shown as open
    await shot(page, `valve-old-bridge-${info.project.name}`);
    await closeCard(page);

    await openCard(page, 'vacuum.robo'); // docked -> start; the pause is covered by the cleaning state below
    await card(page).locator('[data-card-vac-start]').click();
    await expect.poll(() => st.actions.length).toBe(2);
    await expect(note()).toContainText('הגשר סירב');
    await expect(card(page).locator('[data-card-big]')).toHaveText('בעגינה');
    await closeCard(page);

    await openCard(page, 'water_heater.tank');
    await card(page).locator('[data-card-off]').click();
    await expect.poll(() => st.actions.length).toBe(3);
    expect(st.actions[2]).toMatchObject({ entity_id: 'water_heater.tank', action_id: 'water_heater.turn_off' });
    await expect(note()).toContainText('הגשר סירב');
    await expect(card(page).locator('[data-card-big]')).toHaveText('דלוק'); // the old state stays
    await expect(card(page).locator('[data-cmd-status="pending"]')).toHaveCount(0);
    expect(await popup(page).evaluate((el) => (el.textContent ?? '') + (el.innerHTML ?? ''))).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });

  test('a cleaning vacuum: pause rolls back on an old bridge; a refused user is told so', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installDevhistMock(page, { rows: { 'vacuum.robo': { state: 'cleaning', active: true } } });
    await answerActions(page, 'failed', 'service_not_allowed');
    await open(page, '&skin=classic');
    await openCard(page, 'vacuum.robo');
    await card(page).locator('[data-card-vac-pause]').click();
    await expect.poll(() => st.actions.length).toBe(1);
    expect(st.actions[0]).toMatchObject({ entity_id: 'vacuum.robo', action_id: 'vacuum.pause', confirmed: false });
    await expect(card(page).locator('[data-cmd-status="rolled_back"]')).toContainText('הגשר סירב');
    await expect(card(page).locator('[data-card-big]')).toHaveText('מנקה');
    await closeCard(page);
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await answerActions(page, 'denied', 'ha_unauthorized');
    await openCard(page, 'vacuum.robo');
    await card(page).locator('[data-card-vac-pause]').click();
    await expect.poll(() => st.actions.length).toBe(2);
    await expect(card(page).locator('[data-cmd-status="rolled_back"]')).toBeVisible();
    await expect(card(page).locator('[data-cmd-status="rolled_back"]')).not.toContainText('הגשר סירב');
    await expect(card(page).locator('[data-card-big]')).toHaveText('מנקה');
  });

  test('RTL and phone width: right-to-left, no horizontal overflow, controls inside the viewport and pressable', async ({ page }, info) => {
    test.setTimeout(8 * 60_000);
    const vw = page.viewportSize()!.width;
    await installDevhistMock(page, { extra: [DH_WATER_HEATER], rows: { 'switch.irrigation': { state: 'on', active: true } } });
    await open(page, '&skin=classic&scheme=light');
    expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
    const cases: { id: string; kind: string; controls: string[] }[] = [
      { id: 'switch.boiler', kind: 'water_heater', controls: ['[data-card-off]', '[data-card-timer]'] },
      { id: 'water_heater.tank', kind: 'water_heater', controls: ['[data-card-off]'] },
      { id: 'valve.garden', kind: 'valve', controls: ['[data-card-hold]'] },
      { id: 'switch.irrigation', kind: 'valve', controls: ['[data-card-off]'] },
      { id: 'vacuum.robo', kind: 'vacuum', controls: ['[data-card-vac-start]'] },
    ];
    for (const k of cases) {
      await openCard(page, k.id);
      const c = card(page);
      await expect(c).toHaveAttribute('data-device-card', k.kind);
      expect(await c.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
      const sheet = (await popup(page).boundingBox())!;
      expect(sheet.x).toBeGreaterThanOrEqual(-1);
      expect(sheet.x + sheet.width).toBeLessThanOrEqual(vw + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const cb = (await c.boundingBox())!;
      expect(cb.x).toBeGreaterThanOrEqual(sheet.x - 1);
      expect(cb.x + cb.width).toBeLessThanOrEqual(sheet.x + sheet.width + 1);
      for (const sel of k.controls) {
        const first = c.locator(sel).first();
        await expect(first).toBeVisible();
        const b = (await first.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(vw + 1);
        expect(b.height).toBeGreaterThanOrEqual(32);
        expect(b.width).toBeGreaterThanOrEqual(32);
      }
      // the controls start on the right edge of the card (RTL): the first control is not hugging the left edge
      const firstBox = (await c.locator(k.controls[0]).first().boundingBox())!;
      expect(firstBox.x + firstBox.width / 2).toBeGreaterThan(cb.x + cb.width / 2 - 1);
      await shot(page, `${k.id.replace('.', '-')}-${info.project.name}`);
      await closeCard(page);
    }
  });
});
