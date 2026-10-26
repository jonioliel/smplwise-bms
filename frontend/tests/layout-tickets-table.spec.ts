import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installTableMock, type TableMockOptions } from './tickets-table-mocks';

// CR-038 slice 6b: the layout guard (tests/layout-guard.ts) over the board TABLE against the MOCKED backend - the table, the bulk bar with
// a selection, the open column chooser / saved filters / filters popovers, an open inline status menu, the compact density, the empty
// and error states - in every skin x light / dark x widths 320-1440 (below 768 px the table is the compact list). FAILS on escape /
// overflow / clipped findings and on page errors; the 44 px target rule and floating layers are reported (the table's own scroll
// container lays its cells out on its own: text inside it is not judged by the page's boxes).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-table.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.chip, .rc, .seg, .banner, .statebox, .bulk, .cl a.ci, .pop';
const T = 'sw-app tickets-list tickets-table';
const TABLE: TableMockOptions = { board: { view: 'table' } };

interface Screen {
  name: string;
  mock?: TableMockOptions;
  wait: string;
  prep?: (p: Page) => Promise<void>;
}
const SCREENS: Screen[] = [
  { name: 'table', wait: `${T} tbody tr` },
  { name: 'selected', wait: `${T} tbody tr`, prep: async (p) => {
    await p.locator(`${T} tbody [data-select]`).nth(0).click();
    await p.locator(`${T} tbody [data-select]`).nth(2).click({ modifiers: ['Shift'] });
    await p.locator(`${T} tickets-table-bulk [data-bulk-bar]`).waitFor();
  } },
  { name: 'columns', wait: `${T} tbody tr`, prep: async (p) => p.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click() },
  { name: 'views', wait: `${T} tbody tr`, mock: { ...TABLE, views: [{ id: 'v1', name: 'דחופות שלי במחלקת האחזקה ובקומות העליונות', view: { view: 'table', filters: {}, sort: 'sla:asc', columns: [], density: 'comfortable' } }] },
    prep: async (p) => p.locator(`${T} tickets-table-toolbar [data-open="views"]`).click() },
  { name: 'filters', wait: `${T} tbody tr`, prep: async (p) => p.locator(`${T} tickets-table-toolbar [data-open="filters"]`).click() },
  { name: 'status-menu', wait: `${T} tbody tr`, prep: async (p) => p.locator(`${T} tbody tr[data-row="0000000000000a03"] [data-menu-for^="status:"]`).click() },
  { name: 'assignee-menu', wait: `${T} tbody tr`, mock: { ...TABLE, assignees: 12 }, prep: async (p) => p.locator(`${T} tbody tr[data-row="0000000000000a03"] [data-menu-for^="assignee:"]`).click() },
  // 2.5.5: one row and a menu taller than the table (and than a short window): the overlay is placed and limited by the viewport, the table keeps its own height
  { name: 'one-row-long-menu', wait: `${T} tbody tr`, mock: { ...TABLE, many: 1, assignees: 40 }, prep: async (p) => p.locator(`${T} tbody tr [data-menu-for^="assignee:"]`).click() },
  { name: 'dense', wait: `${T} tbody tr`, mock: { board: { view: 'table', density: 'compact', columns: ['number', 'title', 'department', 'priority', 'status', 'assignee', 'place', 'device', 'created', 'activity', 'stuck', 'sla'] } } },
  { name: 'empty', wait: `${T} [data-table-state="empty"]`, mock: { ...TABLE, empty: true } },
  { name: 'error', wait: `${T} [data-table-state="error"]`, mock: { ...TABLE, failTable: true } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('tickets table layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`every table screen, width and theme [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      const targets: Finding[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await installTableMock(page, s.mock ?? TABLE);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url('/tickets/mine', skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'tickets-list' });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`tickets table layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
