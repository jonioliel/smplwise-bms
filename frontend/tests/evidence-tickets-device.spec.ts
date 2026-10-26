import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DH_NOW } from './devhist-mocks';
import { AREA_PERMS } from './bubble-mocks';
import { installTicketsDeviceMock } from './tickets-device-mocks';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// CR-038 slice 3 (section 12.1, owner decision D17) against the mocked backend (tests/tickets-device-mocks.ts over devhist-mocks.ts):
//   1. the matrix row by row on the area screen: module off = today; mode "sheet" (default): a tracked device opens its window with the
//      "{tickets}" tab LAST (open count on the tab), an untracked one opens the window with that tab only; mode "menu": the opaque menu
//      (open a ticket, the device's tickets with the count, history only for a tracked device); right click gains "open a ticket" in both
//      modes; keyboard (arrows, Escape); items without permission are absent.
//   2. device-originated create: the sheet over the window shows the device, its open tickets first and the history line; the request
//      carries entity_id; the tab refreshes.
//   3. both modes in the five skins: the long press works and the menu is OPAQUE (solid background, no blur).
//   4. layout guard: no horizontal overflow of the window and the menu inside the viewport from 320 to 1440 px.
//   5. evidence -> docs/design/evidence/tickets-s3/: desktop 1440 + phone 390, light / dark, classic / domus.
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s3');
// a second copy under test-results: the runner restores the tracked docs/ after a job, the test results stay until the next run
const EVIDENCE_COPY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/evidence-tickets-s3');
const LONG = 650;

async function open(page: Page, query = '&skin=classic') {
  await page.clock.setFixedTime(new Date(DH_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#/devices/areas/living`);
  await page.waitForSelector('sw-app devices-area [data-entity]');
  await page.waitForTimeout(700);
  await page.evaluate(() => document.fonts.ready);
}

const area = (page: Page) => page.locator('sw-app devices-area');
const dev = (page: Page, id: string) => area(page).locator(`[data-entity="${id}"][data-activity]`).first();
const opened = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity][open]');
const menu = (page: Page) => page.locator('sw-app device-activity [data-activity-menu]');
const tabs = (page: Page) => page.locator('sw-app device-activity [role="tab"]');

async function hold(page: Page, loc: Locator, ms = LONG) {
  // the middle of the viewport: on a phone the edge of the scroller sits under the bottom dock, which would take the press
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(150);
  const b = (await loc.boundingBox())!;
  const x = b.x + b.width - 34;
  const y = b.y + 14;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const t0 = Date.now();
  // TESTDEBT3-295: the press completes on a page timer (LONG_PRESS_MS = 500). On a loaded runner the page can run that timer AFTER the
  // release is already queued (input is served before timers), and the release cancels the press: the menu / window never opens (the
  // 2.9.3 and 2.10.0 flakies "domus light" and "toBeVisible"). So the button stays down until the outcome shows - the menu or the
  // window - and only then is it released; a press that has no outcome (the negative cases) still ends after `ms` plus the bounded wait.
  await menu(page).or(opened(page)).first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
  const rest = ms - (Date.now() - t0);
  if (rest > 0) await page.waitForTimeout(rest);
  await page.mouse.up();
}

async function menuIds(page: Page): Promise<string[]> {
  return menu(page).locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => [...e.attributes].map((a) => a.name).find((n) => n.startsWith('data-activity-menu-')) ?? ''));
}

async function closeAll(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
}

test.describe('tickets on a device (CR-038 slice 3)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        for (const k of ['sw.ui.look', 'sw.devices.treeCollapsed', 'sw.devices.layout', 'sw.activity.view']) localStorage.removeItem(k);
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('module off: as today - the tracked device opens on activity with two tabs, an untracked one has no gesture', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installTicketsDeviceMock(page, { enabled: false });
    await open(page);
    expect(await area(page).locator('[data-entity="media_player.living_tv"][data-activity]').count()).toBe(0);
    await hold(page, dev(page, 'light.living_main'));
    await expect(opened(page)).toHaveCount(1);
    await expect(tabs(page)).toHaveCount(2);
    await closeAll(page);
    await dev(page, 'light.living_main').click({ button: 'right', position: { x: 20, y: 14 } });
    expect(await menuIds(page)).toEqual(['data-activity-menu-activity', 'data-activity-menu-schedules']);
  });

  test('no tickets.view: the setting is ignored (as today)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installTicketsDeviceMock(page, { mode: 'menu', perms: [...AREA_PERMS, 'tickets.create'] });
    await open(page);
    expect(await area(page).locator('[data-entity="media_player.living_tv"][data-activity]').count()).toBe(0);
    await hold(page, dev(page, 'light.living_main'));
    await expect(opened(page)).toHaveCount(1);
    await expect(tabs(page)).toHaveCount(2);
  });

  test('mode sheet (default): tracked -> window with the tickets tab LAST; untracked -> the tickets tab only', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installTicketsDeviceMock(page, { mode: 'sheet' });
    await open(page);
    await hold(page, dev(page, 'light.living_main'));
    await expect(opened(page)).toHaveCount(1);
    await expect(tabs(page)).toHaveCount(3);
    expect(await tabs(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))).toEqual(['activity', 'schedules', 'tickets']);
    await expect(page.locator('sw-app device-activity [data-tab="activity"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app device-activity [data-tickets-count]')).toHaveText('1');
    // keyboard: End jumps to the last tab (the tickets tab)
    await page.locator('sw-app device-activity [data-tab="activity"]').focus();
    await page.keyboard.press('End');
    await expect(page.locator('sw-app device-activity [data-tab="tickets"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app device-activity [data-device-ticket]')).toHaveCount(2);
    await expect(page.locator('sw-app device-activity [data-tickets-new]')).toBeVisible();
    await closeAll(page);
    await hold(page, dev(page, 'media_player.living_tv'));
    await expect(opened(page)).toHaveCount(1);
    await expect(tabs(page)).toHaveCount(0);
    await expect(page.locator('sw-app device-activity [data-panel="tickets"] device-tickets-tab')).toHaveCount(1);
    await expect(page.locator('sw-app device-activity [data-tickets-state="empty"]')).toBeVisible();
    expect(st.calls.filter((c) => c.path.startsWith('tickets/by-entity/')).map((c) => c.path)).toEqual(['tickets/by-entity/light.living_main', 'tickets/by-entity/media_player.living_tv']);
    expect(st.devhist.feedCalls.map((c) => c.entity)).not.toContain('media_player.living_tv'); // an untracked device never asks for an activity feed
    // the right click gains "open a ticket" in this mode too
    await closeAll(page);
    await dev(page, 'light.living_main').click({ button: 'right', position: { x: 20, y: 14 } });
    expect(await menuIds(page)).toEqual(['data-activity-menu-activity', 'data-activity-menu-schedules', 'data-activity-menu-ticket-new']);
  });

  test('mode menu: the opaque menu on a long press and a right click; history only for a tracked device; keyboard and Escape', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installTicketsDeviceMock(page, { mode: 'menu' });
    await open(page);
    await hold(page, dev(page, 'light.living_main'));
    await expect(menu(page)).toBeVisible();
    await expect(opened(page)).toHaveCount(0);
    expect(await menuIds(page)).toEqual(['data-activity-menu-activity', 'data-activity-menu-schedules', 'data-activity-menu-ticket-new', 'data-activity-menu-tickets']);
    await expect(menu(page).locator('[data-menu-count]')).toHaveText('1');
    await expect(menu(page)).toHaveAttribute('data-menu-source', 'press');
    // keyboard: the first item has focus, the arrows move, Escape closes
    await expect(menu(page).locator('[role="menuitem"]').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu(page).locator('[data-activity-menu-schedules]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    // the same menu from a right click
    await dev(page, 'light.living_main').click({ button: 'right', position: { x: 20, y: 14 } });
    expect(await menuIds(page)).toEqual(['data-activity-menu-activity', 'data-activity-menu-schedules', 'data-activity-menu-ticket-new', 'data-activity-menu-tickets']);
    await menu(page).locator('[data-activity-menu-tickets]').click();
    await expect(opened(page)).toHaveCount(1);
    await expect(page.locator('sw-app device-activity [data-tab="tickets"]')).toHaveAttribute('aria-selected', 'true');
    await closeAll(page);
    // an untracked device: no history item
    await hold(page, dev(page, 'media_player.living_tv'));
    expect(await menuIds(page)).toEqual(['data-activity-menu-ticket-new', 'data-activity-menu-tickets']);
    await page.mouse.click(5, 5); // an outside tap closes it
    await expect(menu(page)).toHaveCount(0);
  });

  test('mode menu without tickets.create: "open a ticket" is absent', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    await installTicketsDeviceMock(page, { mode: 'menu', perms: [...AREA_PERMS, 'tickets.view'] });
    await open(page);
    await hold(page, dev(page, 'light.living_main'));
    expect(await menuIds(page)).toEqual(['data-activity-menu-activity', 'data-activity-menu-schedules', 'data-activity-menu-tickets']);
  });

  test('open a ticket from the device: the device block, its open tickets first, the history line, entity_id sent, the tab refreshed', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    const st = await installTicketsDeviceMock(page, { mode: 'menu' });
    await open(page);
    await hold(page, dev(page, 'light.living_main'));
    await menu(page).locator('[data-activity-menu-ticket-new]').click();
    const sheet = page.locator('sw-app device-activity ticket-create');
    await expect(sheet.locator('[data-create-device="light.living_main"]')).toBeVisible();
    await expect(sheet.locator('[data-device-open-item]')).toHaveCount(1); // the closed one is not a duplicate candidate
    await expect(sheet.locator('[data-create-history]')).toContainText('24');
    await expect(sheet.locator('[data-create-category]')).toHaveValue('cat-elec'); // preselected from the device's domain
    await sheet.locator('[data-create-title]').fill('הנורה כבתה');
    await sheet.locator('[data-create-submit]').click();
    await expect.poll(() => st.created.length).toBe(1);
    expect(st.created[0]).toMatchObject({ entity_id: 'light.living_main', title: 'הנורה כבתה', department_id: 'dept-maintenance', category_id: 'cat-elec' });
    await expect(opened(page)).toHaveCount(1);
    await expect(page.locator('sw-app device-activity [data-tab="tickets"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app device-activity [data-device-ticket]')).toHaveCount(3);
  });

  test('both modes in the five skins: the long press works and the menu is opaque', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the behaviour runs once');
    test.setTimeout(6 * 60_000);
    for (const skin of SKIN_IDS) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const mode of ['sheet', 'menu'] as const) {
          await installTicketsDeviceMock(page, { mode });
          await open(page, `&skin=${skin}&scheme=${scheme}`);
          await hold(page, dev(page, 'light.living_main'));
          if (mode === 'sheet') {
            await expect(opened(page), `${skin} ${scheme}`).toHaveCount(1);
            await expect(page.locator('sw-app device-activity [data-tab="tickets"]'), `${skin} ${scheme}`).toBeVisible();
          } else {
            await expect(menu(page), `${skin} ${scheme}`).toBeVisible();
            const look = await menu(page).evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, blur: s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter || 'none' }; });
            const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(look.bg)?.[1];
            expect(alpha === undefined || Number(alpha) === 1, `${skin} ${scheme}: ${look.bg}`).toBe(true);
            expect(look.blur === 'none' || look.blur === '', `${skin} ${scheme}: ${look.blur}`).toBe(true);
          }
          await closeAll(page);
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      }
    }
  });

  test('layout guard: the window and the menu stay inside the viewport from 320 to 1440 px', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the sweep sets its own widths');
    test.setTimeout(4 * 60_000);
    for (const w of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 820 });
      for (const mode of ['sheet', 'menu'] as const) {
        await installTicketsDeviceMock(page, { mode });
        await open(page);
        await hold(page, dev(page, 'light.living_main'));
        if (mode === 'sheet') {
          await expect(opened(page)).toHaveCount(1);
          await page.locator('sw-app device-activity [data-tab="tickets"]').click();
          await expect(page.locator('sw-app device-activity [data-device-ticket]').first()).toBeVisible();
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(over, `${w}px window`).toBeLessThanOrEqual(0);
          for (const r of await page.locator('sw-app device-activity [data-device-ticket]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
            expect(r.left, `${w}px row`).toBeGreaterThanOrEqual(-1);
            expect(r.right, `${w}px row`).toBeLessThanOrEqual(w + 1);
          }
        } else {
          await expect(menu(page)).toBeVisible();
          const r = await menu(page).evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect);
          expect(r.left, `${w}px menu`).toBeGreaterThanOrEqual(0);
          expect(r.right, `${w}px menu`).toBeLessThanOrEqual(w);
          expect(r.bottom, `${w}px menu`).toBeLessThanOrEqual(820);
        }
        await closeAll(page);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    }
  });

  test('evidence: the tickets tab, the menu and the create sheet - light / dark, classic / domus', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    test.setTimeout(8 * 60_000);
    const tag = info.project.name === 'mobile' ? '390' : '1440';
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.mkdirSync(EVIDENCE_COPY, { recursive: true });
    const shot = async (name: string) => {
      const buf = await page.screenshot({ path: path.join(EVIDENCE, `${name}-${tag}.png`) });
      fs.writeFileSync(path.join(EVIDENCE_COPY, `${name}-${tag}.png`), buf);
    };
    for (const skin of ['classic', 'domus'] as const) {
      for (const scheme of ['light', 'dark'] as const) {
        const q = `&skin=${skin}&scheme=${scheme}`;
        await installTicketsDeviceMock(page, { mode: 'sheet' });
        await open(page, q);
        await hold(page, dev(page, 'light.living_main'));
        await page.locator('sw-app device-activity [data-tab="tickets"]').click();
        await expect(page.locator('sw-app device-activity [data-device-ticket]').first()).toBeVisible();
        await page.waitForTimeout(400);
        await shot(`tab-${skin}-${scheme}`);
        await page.locator('sw-app device-activity [data-tickets-new]').click();
        await expect(page.locator('sw-app device-activity ticket-create [data-create-device]')).toBeVisible();
        await page.waitForTimeout(500);
        await shot(`create-${skin}-${scheme}`);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await installTicketsDeviceMock(page, { mode: 'menu' });
        await open(page, q);
        await hold(page, dev(page, 'light.living_main'));
        await expect(menu(page)).toBeVisible();
        await page.waitForTimeout(300);
        await shot(`menu-${skin}-${scheme}`);
        await closeAll(page);
        await hold(page, dev(page, 'media_player.living_tv'));
        await expect(menu(page)).toBeVisible();
        await menu(page).locator('[data-activity-menu-tickets]').click();
        await expect(opened(page)).toHaveCount(1);
        await page.waitForTimeout(400);
        await shot(`untracked-${skin}-${scheme}`);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        // the frozen history on the ticket's full screen (internal content, no person name)
        await installTicketsDeviceMock(page, { mode: 'sheet' });
        await page.goto('about:blank'); // a fresh page: the device window of the step before must not cover the shot
        await page.goto(`/?design=a${q}#/tickets/0000000000000b01`);
        // TKUI1: the device history is the Overview's fold ("היסטוריית ההתקן"), closed until asked for
        const fold = page.locator('sw-app ticket-detail details[data-ov="device"] > summary').first();
        await fold.waitFor({ timeout: 15_000 });
        await fold.click();
        const hist = page.locator('sw-app [data-sect="device-history"]').first();
        await expect(hist).toBeVisible({ timeout: 15_000 });
        await expect(hist.locator('[data-history-line]')).toHaveCount(3);
        await hist.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
        await shot(`history-${skin}-${scheme}`);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    }
  });
});
