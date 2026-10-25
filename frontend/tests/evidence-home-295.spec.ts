import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HOME-295 (2.22.0): the new home screen of the approved mockup round 2 (private/review/HOME_MOCKUP_R2_2026-10-25.html) with the owner's
// answers - BOTH views (cards, tiles), three screens (desktop 1366x768 = the no-scroll reference, landscape tablet 1180x820 first, phone
// 390x844), light and dark, and the states normal / alarm / no connection / empty / more than four floors, plus the phone's floor tree
// and area sheet. Demo mode (no backend): the states come from `?hs_state=`, the display options from `?hs_<key>=`.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-home-295.spec.ts --project=desktop
// Screenshots: docs/design/evidence/HOME-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/HOME-295');
const VP = { d: { width: 1366, height: 768 }, t: { width: 1180, height: 820 }, m: { width: 390, height: 844 } } as const;
type Vp = keyof typeof VP;
type Mode = 'cards' | 'tiles';

async function open(page: Page, o: { mode: Mode; vp: Vp; state?: string; dark?: boolean; q?: string }) {
  await page.setViewportSize(VP[o.vp]);
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  await page.addInitScript((mode) => {
    try {
      localStorage.setItem('sw.devices.layout', mode);
    } catch {
      /* storage unavailable */
    }
  }, o.mode);
  if (o.dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('about:blank');
  await page.goto(`/?design=a${o.dark ? '&scheme=dark' : ''}${o.state ? `&hs_state=${o.state}` : ''}${o.q ?? ''}#/devices/building`);
  await page.waitForSelector('sw-app devices-building');
  if (o.state !== 'empty') await page.locator('sw-app devices-building sw-kpi').first().waitFor();
  if (o.dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(350); // the fit steps settle
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

/** How far the home screen's scrolling page area (or the document) overflows vertically. */
const overflowY = (page: Page) =>
  page.evaluate(() => {
    let node: Node | null = document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-building') ?? null;
    if (!node) return -1;
    while (node) {
      const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
      if (parent instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent.scrollHeight - parent.clientHeight;
      node = parent;
    }
    return document.documentElement.scrollHeight - document.documentElement.clientHeight;
  });
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const B = (page: Page) => page.locator('sw-app devices-building');

for (const mode of ['cards', 'tiles'] as const) {
  for (const vp of ['t', 'd', 'm'] as const) {
    test(`${mode} · ${vp}: normal, light and dark - quick actions, summary, no scroll on a control screen`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
      await open(page, { mode, vp, state: 'site' });
      const b = B(page);
      // the summary tiles: every kind the site has by default (sensors and cameras included)
      await expect(b.locator('[data-kpis]')).toHaveAttribute('data-summary', /lights.*sensors.*cameras/);
      // the quick actions: the living room has lights, climate and blinds by default
      const q = b.locator('[data-quick="living"]');
      await expect(q).toHaveAttribute('data-quick-kinds', mode === 'cards' ? 'lights climate' : vp === 'm' ? 'lights climate' : 'lights climate covers');
      await expect(q.locator('[data-quick-kind="climate"]')).toHaveText(/22°/);
      await shot(page, `${mode}-normal-light-${vp}`);
      await open(page, { mode, vp, state: 'site', dark: true });
      await shot(page, `${mode}-normal-dark-${vp}`);
      if (vp !== 'm') expect(await overflowY(page)).toBeLessThanOrEqual(1);
      else {
        await expect(b.locator('[data-phone-floors]')).toBeVisible(); // one floor at a time + the tree button
        await expect(b.locator(mode === 'cards' ? 'section.fcard[data-floor-card]' : 'section.floor[data-floor]')).toHaveCount(1);
      }
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    });

    test(`${mode} · ${vp}: alarm - one row per alert, the tile coloured`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
      await open(page, { mode, vp, state: 'alarm' });
      const b = B(page);
      await expect(b.locator('[data-home-alerts]')).toBeVisible();
      await expect(b.locator('[data-home-alert="area:garden"]')).toBeVisible();
      await shot(page, `${mode}-alarm-light-${vp}`);
      if (vp !== 'm') {
        await expect(b.locator(mode === 'cards' ? '[data-area-quick-row="garden"][data-bad]' : 'a.tile[data-area="garden"][data-bad]')).toBeVisible();
        expect(await overflowY(page)).toBeLessThanOrEqual(1);
      }
      await b.locator('[data-home-alert="area:garden"] [data-alert-ack]').click();
      await expect(b.locator('[data-home-alerts]')).toHaveCount(0);
      await open(page, { mode, vp, state: 'alarm', dark: true });
      await shot(page, `${mode}-alarm-dark-${vp}`);
    });

    test(`${mode} · ${vp}: no connection - the last values grey with their time, actions disabled`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
      await open(page, { mode, vp, state: 'offline' });
      const b = B(page);
      await expect(b.locator('[data-home-offline]')).toBeVisible();
      await expect(b).toHaveAttribute('data-offline', '');
      await expect(b.locator('[data-quick] button').first()).toBeDisabled();
      await expect(b.locator('sw-kpi[data-tile-kind="lights"]')).toHaveAttribute('value', '–');
      await shot(page, `${mode}-offline-light-${vp}`);
      if (vp !== 'm') expect(await overflowY(page)).toBeLessThanOrEqual(1);
      await open(page, { mode, vp, state: 'offline', dark: true });
      await shot(page, `${mode}-offline-dark-${vp}`);
    });

    test(`${mode} · ${vp}: empty`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
      await open(page, { mode, vp, state: 'empty' });
      await expect(B(page).locator('[data-devices-state="empty"]')).toBeVisible();
      await shot(page, `${mode}-empty-light-${vp}`);
      if (vp !== 'm') expect(await overflowY(page)).toBeLessThanOrEqual(1);
      await open(page, { mode, vp, state: 'empty', dark: true });
      await shot(page, `${mode}-empty-dark-${vp}`);
    });
  }
}

test.describe('the owner answers are settings', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports'));

  test('more than four floors (cards): four cards, the rest behind "more floors" in the tree; the scrolling tree option lists them all', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'd', state: 'many' });
    const b = B(page);
    await expect(b.locator('.fcards')).toHaveAttribute('data-cols', '4');
    await expect(b.locator('section.fcard[data-floor-card]')).toHaveCount(4);
    await expect(b.locator('[data-tree-more="2"]')).toBeVisible();
    await shot(page, 'cards-many-more-d');
    expect(await overflowY(page)).toBeLessThanOrEqual(1);
    await b.locator('[data-tree-more]').click();
    await expect(b.locator('[data-tree-select="m2"]')).toBeVisible();
    await open(page, { mode: 'cards', vp: 'd', state: 'many', q: '&hs_many_floors=tree_scroll' });
    await expect(b.locator('nav.tree[data-tree-scroll]')).toBeVisible();
    await expect(b.locator('[data-tree-more]')).toHaveCount(0);
    expect(await overflowY(page)).toBeLessThanOrEqual(1);
    await shot(page, 'cards-many-tree-scroll-d');
    await open(page, { mode: 'cards', vp: 't', state: 'many' });
    await expect(b.locator('.fcards')).toHaveAttribute('data-cols', '3');
    await shot(page, 'cards-many-more-t');
  });

  test('the cards row: indicators instead of quick actions; the blinds as two buttons; target-only climate; area quick actions per area', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'd', state: 'site', q: '&hs_row_actions=indicators' });
    const b = B(page);
    await expect(b.locator('[data-area-quick-row]')).toHaveCount(0);
    await expect(b.locator('.arow [data-area-indicators]').first()).toBeVisible();
    await open(page, { mode: 'tiles', vp: 'd', state: 'site', q: '&hs_tile_blinds=buttons&hs_tile_climate=target&hs_quick=living:covers,lights;kitchen:' });
    await expect(b.locator('[data-quick="living"]')).toHaveAttribute('data-quick-kinds', 'covers lights');
    await expect(b.locator('[data-quick="living"] [data-quick-kind="covers_open"]')).toBeVisible();
    await expect(b.locator('[data-quick="kitchen"]')).toHaveCount(0);
    await expect(b.locator('a.tile[data-area="lobby"] [data-area-temp]')).toHaveCount(0); // target only: the room temperature leaves the head
    await shot(page, 'tiles-options-d');
    // the blinds as a count: a tap offers open / stop / close
    await open(page, { mode: 'tiles', vp: 'd', state: 'site' });
    await b.locator('[data-quick="living"] [data-quick-kind="covers"]').click();
    await expect(b.locator('[data-cover-menu="living"] [data-cover]')).toHaveCount(3);
  });

  test('the summary tiles follow the administrator\'s choice and order', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'd', state: 'site', q: '&hs_tiles=locks,lights,climate' });
    await expect(B(page).locator('[data-kpis]')).toHaveAttribute('data-summary', 'locks lights climate');
    await expect(B(page).locator('[data-kpis] sw-kpi')).toHaveCount(3);
  });

  test('the info row: cards in the cards view, the thin bar in tiles (auto); the building-off card drops on a landscape tablet', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'd', state: 'site' });
    const b = B(page);
    await expect(b.locator('home-ambient-bar')).toHaveCount(0);
    await expect(b.locator('home-widgets [data-home-widget="clock"]')).toBeVisible();
    await open(page, { mode: 'tiles', vp: 'd', state: 'site' });
    await expect(b.locator('home-ambient-bar')).toHaveCount(1);
    await open(page, { mode: 'cards', vp: 't', state: 'site' });
    await expect(b.locator('home-widgets [data-home-widget="quick"]')).toHaveCount(0);
    await open(page, { mode: 'cards', vp: 't', state: 'site', q: '&hs_building_off_tablet=keep&home_info=cards' });
    await shot(page, 'cards-tablet-keep-building-off-t');
  });

  test('phone: the floor tree in a sheet; an area as a sheet or full screen', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'm', state: 'site' });
    const b = B(page);
    await b.locator('[data-phone-floor="f1"]').click();
    await expect(b.locator('section.fcard[data-floor-card="f1"]')).toBeVisible();
    await b.locator('[data-phone-tree]').click();
    await expect(b.locator('[data-tree-sheet] nav.tree')).toBeVisible();
    await shot(page, 'cards-tree-sheet-light-m');
    await b.locator('[data-tree-sheet] [data-tree-select="yd"]').click();
    await expect(b.locator('[data-tree-sheet]')).toHaveCount(0);
    await expect(b.locator('section.fcard[data-floor-card="yd"]')).toBeVisible();
    await b.locator('a.arow[data-area-row="garden"]').click();
    await expect(b.locator('[data-area-sheet="garden"][data-area-sheet-mode="sheet"]')).toBeVisible();
    await shot(page, 'cards-area-sheet-light-m');
    await open(page, { mode: 'tiles', vp: 'm', state: 'site', q: '&hs_phone_area=full' });
    await b.locator('a.tile[data-area="lobby"] .name').click();
    // full screen = the area's own screen (its route), as before 2.22.0
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/lobby');
    await shot(page, 'tiles-area-full-light-m');
  });

  test('the floor card: two direct buttons instead of the menu are a setting (shown to a bulk holder; the demo has none)', async ({ page }) => {
    await open(page, { mode: 'cards', vp: 'd', state: 'site', q: '&hs_floor_off=buttons' });
    // demo mode holds no devices.control_bulk: neither control is drawn - the option itself is covered by the unit specs
    await expect(B(page).locator('[data-floor-menu], [data-floor-off]')).toHaveCount(0);
  });
});
