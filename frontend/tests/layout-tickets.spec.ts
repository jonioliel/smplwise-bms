import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installTicketsMock, url, type TicketsMockOptions } from './tickets-mocks';

// CR-038 slice 1: the layout guard (tests/layout-guard.ts) over the tickets screens against the MOCKED backend - the list, the drawer, the full
// screen, the create sheet and dialog, the empty and off states and the three settings tabs - in every skin x light / dark x widths 320-1440.
// FAILS on escape / overflow / clipped findings and on page errors (nothing leaves its card or chip, no text is cut without an ellipsis, the
// page never scrolls sideways). The 44 px target rule is reported for the touch widths and asserted for the screens' own controls in the bubble
// skin (the skins whose rules size the shared buttons keep their own sizes, as layout-wxunblk.spec.ts says).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.tcard, .chip, .blk, .sentence, .rc, .seg, .ph, .banner, .statebox, .similar, .pick label, .person, .tag, .cwarn, .av, .frow';

interface Screen {
  name: string;
  hash: string;
  wait: string;
  mock?: TicketsMockOptions;
  within: string;
  prep?: (p: Page) => Promise<void>;
}
const SCREENS: Screen[] = [
  { name: 'list', hash: '/tickets/mine', wait: 'sw-app tickets-list ticket-card', within: 'tickets-list' },
  { name: 'list-filter-row', hash: '/tickets/mine', wait: 'sw-app tickets-list ticket-card', within: 'tickets-list',
    prep: async (p) => { await p.locator('sw-app tickets-list [data-filter-toggle]').click(); await p.locator('sw-app tickets-list [data-filter-row]').waitFor(); } },
  { name: 'drawer', hash: '/tickets/mine?t=0000000000000a01', wait: 'sw-app tickets-list ticket-detail [data-ticket-detail]', within: 'tickets-list' },
  { name: 'drawer-returned', hash: '/tickets/mine?t=0000000000000a04', wait: 'sw-app tickets-list ticket-detail [data-ticket-detail]', within: 'tickets-list', mock: { persona: 'operator' } },
  { name: 'full', hash: '/tickets/0000000000000a01', wait: 'sw-app tickets-detail ticket-detail [data-ticket-page]', within: 'tickets-detail' },
  { name: 'create-sheet', hash: '/tickets/mine?new=1', wait: 'sw-app tickets-list ticket-create [data-create-form]', within: 'tickets-list' },
  { name: 'create-dialog', hash: '/tickets/mine?new=1', wait: 'sw-app tickets-list ticket-create [data-create-form]', within: 'tickets-list', mock: { ui: { new_ticket: 'dialog' } } },
  { name: 'empty', hash: '/tickets/mine', wait: 'sw-app tickets-list [data-tickets-state="empty"]', within: 'tickets-list', mock: { empty: true } },
  { name: 'off', hash: '/tickets/mine', wait: 'sw-app tickets-list [data-tickets-state="off"]', within: 'tickets-list', mock: { enabled: false } },
  { name: 'settings-general', hash: '/system/tickets', wait: 'sw-app system-tickets [data-name-editor]', within: 'system-tickets', mock: { persona: 'admin' } },
  { name: 'settings-departments', hash: '/system/tickets?tab=departments', wait: 'sw-app system-tickets [data-dept]', within: 'system-tickets', mock: { persona: 'admin' } },
  { name: 'settings-permissions', hash: '/system/tickets?tab=permissions', wait: 'sw-app system-tickets [data-holder]', within: 'system-tickets', mock: { persona: 'admin' } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('tickets layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`every screen, width and theme [${skin}]`, async ({ page }, info) => {
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
          await installTicketsMock(page, s.mock ?? {});
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
      console.log(`tickets layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
