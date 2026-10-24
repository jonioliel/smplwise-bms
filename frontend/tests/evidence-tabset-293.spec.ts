import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// TABSET-293 (owner 2026-10-20): "I cannot order the tabs of תשתיות and מולטימדיה from the tabs settings, while אבטחה and WisKey work".
// Root cause: the multimedia, infrastructure and tickets rows were never in the tab registry (shell/nav.ts TAB_SECTIONS / sectionIdOf), so
// הגדרות › כללי › לשוניות had no card for them and the shell never applied `ui.tabs` to their rows. This spec walks the owner's path with a
// mocked backend (page.route on api/v1, a stateful `ui.tabs`): reorder in the editor -> save -> reload -> the section shows the new order.
//   1. infrastructure: the area row (גנרטור before מוני חשמל) and the generator's page row (גרפים first); the area opens on the first page;
//   2. multimedia: the area row (נגנים ורמקולים, קבוצות, מסכים) after a reload;
//   3. the editor lists the new cards, with the same controls as אבטחה / WisKey.
// Desktop 1440 and phone 390 (projects desktop / mobile), RTL, light. Screenshots in docs/design/evidence/tabset-293/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tabset-293.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tabset-293');
const PERMS_ALL = [...PERMS.manage, 'energy.view', 'energy.manage', 'energy.bills', 'devices.read', 'media.read', 'system.configure'];

interface Srv {
  uiTabs: Record<string, unknown>;
  patches: Record<string, unknown>[];
}

async function install(page: Page, srv: Srv) {
  await installGeneratorMock(page, { perms: PERMS_ALL, level: 'full' });
  // registered after the generator mock, so these answer first
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/settings', (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(body);
      if ('ui.tabs' in body) srv.uiTabs = body['ui.tabs'] as Record<string, unknown>;
    }
    return json(route, { settings: { 'ui.design': 'a', 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {}, 'multimedia.enabled': 'true', 'ui.tabs': srv.uiTabs }, can_edit: true });
  });
  await page.route('**/api/v1/multimedia/status', (route) => json(route, { enabled: true, counts: { screens: 1, players: 2, groups: 1 } }));
  await page.route('**/api/v1/infra/elevators', (route) => json(route, { elevators: [] }));
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('sw.tabs.mode');
      localStorage.removeItem('sw.dd.place');
    } catch {
      /* storage unavailable */
    }
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('sw-app[data-shell-ready]', { timeout: 20_000 });
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/** The hrefs of a tab row, in the order drawn (the query - a generator's device - left out). */
const hrefs = (page: Page, sel: string) => page.locator(`${sel} a`).evaluateAll((els) => els.map((e) => (e.getAttribute('href') ?? '').split('?')[0]));
const AREA_ROW = 'sw-app sw-tabs[data-area-tabs]';
const PAGE_ROW = 'sw-app [data-infra-pages]';
const shot = async (page: Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};
const phone = (info: { project: { name: string } }) => info.project.name === 'mobile';

test.describe('TABSET-293: every section is ordered from the tabs settings', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('infrastructure: reorder in settings -> after a reload the area row and the generator pages follow, the area opens on the first page', async ({ page }, info) => {
    const srv: Srv = { uiTabs: {}, patches: [] };
    const dev = phone(info) ? 'phone' : 'desktop';
    await install(page, srv);

    // before: the built-in order (an installation that never touched the editor looks exactly as before)
    await open(page, '/infra/generator/live');
    await expect.poll(() => hrefs(page, AREA_ROW), { timeout: 15_000 }).toEqual(['#/infra/electricity/meters', '#/infra/generator/live']);
    await expect.poll(() => hrefs(page, PAGE_ROW)).toEqual(['#/infra/generator/live', '#/infra/generator/alerts', '#/infra/generator/charts', '#/infra/generator/history']);
    await shot(page, `infra-before-${dev}`);

    // the editor: the infrastructure cards are there, with the same controls as the security / WisKey ones
    await open(page, '/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed.locator('[data-tabs-section="infra"]')).toBeVisible();
    await expect(ed.locator('[data-tabs-section="infra.electricity"]')).toHaveCount(1);
    await expect(ed.locator('[data-tabs-section="infra.generator"]')).toHaveCount(1);
    await expect(ed.locator('[data-tabs-offered="infra"]')).toHaveCount(1);
    const up = (sec: string, tab: string) => ed.locator(`li[data-sec="${sec}"][data-tab="${tab}"] .mv[data-move="up"]`);
    await up('infra', 'generator').scrollIntoViewIfNeeded();
    // CR-WATER78 put the water page directly after the electricity meters, so the generator is the third tab now: two steps up to be first
    await up('infra', 'generator').click();
    await up('infra', 'generator').click();
    await up('infra.generator', 'charts').scrollIntoViewIfNeeded();
    await up('infra.generator', 'charts').click();
    await up('infra.generator', 'charts').click();
    expect(await ed.locator('li[data-sec="infra.generator"] .name').allTextContents()).toEqual(['גרפים', 'מצב חי', 'התראות פעילות', 'היסטוריה', 'יומן הפעלות']); // GENLOG092-295: the run log is listed in the editor too
    await ed.locator('[data-tabs-section="infra"]').scrollIntoViewIfNeeded();
    await shot(page, `infra-editor-${dev}`);
    await ed.locator('[data-tabs-save]').click();
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({
      'ui.tabs': {
        infra: { order: ['generator', 'electricity', 'water', 'elevators', 'temperature'], hidden: [] },
        'infra.generator': { order: ['charts', 'live', 'alerts', 'history', 'log'], hidden: [] }, // GENLOG092-295: the run log is saved in the order too
      },
    });

    // after a reload: the stored order is what the shell draws
    await open(page, '/infra/generator/live');
    await expect.poll(() => hrefs(page, AREA_ROW), { timeout: 15_000 }).toEqual(['#/infra/generator/charts', '#/infra/electricity/meters']);
    await expect.poll(() => hrefs(page, PAGE_ROW)).toEqual(['#/infra/generator/charts', '#/infra/generator/live', '#/infra/generator/alerts', '#/infra/generator/history']);
    await expect(page.locator(`${AREA_ROW} a[aria-current="page"]`)).toHaveAttribute('href', '#/infra/generator/charts'); // the generator tab is the active one
    await shot(page, `infra-after-${dev}`);
    if (!phone(info)) {
      // the rail opens the area on its first tab's first page
      const rail = page.locator('sw-app nav.rail a[data-nav="infra"]');
      await expect(rail).toHaveAttribute('href', '#/infra/generator/charts');
      await open(page, '/devices/building');
      await rail.click();
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/infra\/generator\/charts/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('multimedia: reorder in settings -> after a reload the area row follows', async ({ page }, info) => {
    const srv: Srv = { uiTabs: {}, patches: [] };
    const dev = phone(info) ? 'phone' : 'desktop';
    await install(page, srv);

    await open(page, '/multimedia/screens');
    await expect.poll(() => hrefs(page, AREA_ROW), { timeout: 15_000 }).toEqual(['#/multimedia/screens', '#/multimedia/players', '#/multimedia/groups']);
    await shot(page, `multimedia-before-${dev}`);

    await open(page, '/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed.locator('[data-tabs-section="multimedia"]')).toBeVisible();
    // the screens tab to the end: twice down
    const down = ed.locator('li[data-sec="multimedia"][data-tab="screens"] .mv[data-move="down"]');
    await down.scrollIntoViewIfNeeded();
    await down.click();
    await ed.locator('li[data-sec="multimedia"][data-tab="screens"] .mv[data-move="down"]').click();
    expect(await ed.locator('li[data-sec="multimedia"] .name').allTextContents()).toEqual(['נגנים ורמקולים', 'קבוצות', 'מסכים']);
    await ed.locator('[data-tabs-section="multimedia"]').scrollIntoViewIfNeeded();
    await shot(page, `multimedia-editor-${dev}`);
    await ed.locator('[data-tabs-save]').click();
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.tabs': { multimedia: { order: ['players', 'groups', 'screens'], hidden: [] } } });

    await open(page, '/multimedia/screens');
    await expect.poll(() => hrefs(page, AREA_ROW), { timeout: 15_000 }).toEqual(['#/multimedia/players', '#/multimedia/groups', '#/multimedia/screens']);
    await shot(page, `multimedia-after-${dev}`);
    if (!phone(info)) await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveAttribute('href', '#/multimedia/players'); // the area now opens on its first tab
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('hiding: a hidden infrastructure page leaves the row and the area opens on the next one', async ({ page }) => {
    const srv: Srv = { uiTabs: { 'infra.generator': { order: [], hidden: ['live'] } }, patches: [] };
    await install(page, srv);
    await open(page, '/infra/generator/alerts');
    await expect.poll(() => hrefs(page, PAGE_ROW), { timeout: 15_000 }).toEqual(['#/infra/generator/alerts', '#/infra/generator/charts', '#/infra/generator/history']);
    await expect.poll(() => hrefs(page, AREA_ROW)).toEqual(['#/infra/electricity/meters', '#/infra/generator/alerts']);
  });
});
