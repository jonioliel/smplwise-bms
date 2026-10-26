import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installBoardMock, type BoardMockOptions } from './tickets-board-mocks';

// CR-038 slice 6: the layout guard (tests/layout-guard.ts) over the manager board against the MOCKED backend - grouped with the side tree,
// chips, chips + the filter panel, a filtered flat list, the closed section open, the drawer over the board, the forbidden state and the
// display card of Settings - in every skin x light / dark x widths 320-1440. FAILS on escape / overflow / clipped findings and page errors.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-board.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.tcard, .chip, .blk, .sentence, .rc, .seg, .ph, .banner, .statebox, .tag, .tree .row, .cwarn, .av, .today, .frow, .hgroup, .closedrows';

interface Screen { name: string; hash: string; wait: string; mock?: BoardMockOptions; within: string; prep?: (p: Page) => Promise<void> }
const SCREENS: Screen[] = [
  { name: 'board-tree', hash: '/tickets/board', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board' },
  { name: 'board-chips', hash: '/tickets/board', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board', mock: { board: { board_floors: 'chips', closed_strip: 'week' } } },
  { name: 'board-filter-tree', hash: '/tickets/board', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board', mock: { board: { board_floors: 'chips_tree' } },
    prep: async (p) => { await p.locator('sw-app tickets-board [data-filter-btn]').click().catch(() => undefined); } },
  { name: 'board-stuck', hash: '/tickets/board?state=stuck', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board' },
  { name: 'board-closed-open', hash: '/tickets/board', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board',
    prep: async (p) => { await p.locator('sw-app tickets-board [data-closed-toggle]').click(); } },
  { name: 'board-filter-row', hash: '/tickets/board', wait: 'sw-app tickets-board ticket-card', within: 'tickets-board',
    prep: async (p) => { await p.locator('sw-app tickets-board [data-filter-toggle]').click(); await p.locator('sw-app tickets-board [data-filter-row]').waitFor(); } },
  { name: 'board-drawer', hash: '/tickets/board?t=0000000000000a01', wait: 'sw-app tickets-board ticket-detail [data-ticket-detail]', within: 'tickets-board' },
  { name: 'board-forbidden', hash: '/tickets/board', wait: 'sw-app tickets-board [data-tickets-state="forbidden"]', within: 'tickets-board', mock: { persona: 'operator' } },
  { name: 'settings-display', hash: '/system/tickets?tab=display', wait: 'sw-app system-tickets ticket-board-settings [data-ui-board]', within: 'system-tickets', mock: { persona: 'admin' } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('tickets board layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`every board screen, width and theme [${skin}]`, async ({ page }, info) => {
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
          await installBoardMock(page, s.mock ?? {});
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(s.hash, skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: s.within });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`tickets board layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
