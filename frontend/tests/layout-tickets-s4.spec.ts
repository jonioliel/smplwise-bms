import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, serveBuiltApp, type S4MockOptions } from './tickets-s4-mocks';

// CR-038 slice 4: the layout guard (tests/layout-guard.ts) over the outside-contact screens against the MOCKED backend - the directory
// with a card open, the handler page card on the general tab (proxies unfolded), the assign dialog sending outside with the preview
// shown, and a ticket's link panel - in every skin x light / dark x widths 320-1440. FAILS on escape / overflow / clipped findings
// and on page errors, like layout-tickets.spec.ts (slice 1's screens).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-s4.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.tcard, .chip, .blk, .sentence, .rc, .seg, .ph, .banner, .statebox, .pick label, .tag, .lkp';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };

interface Screen {
  name: string;
  hash: string;
  wait: string;
  mock?: S4MockOptions;
  within: string;
  prep?: (p: Page) => Promise<void>;
}
const D = 'sw-app tickets-list ticket-detail';
const SCREENS: Screen[] = [
  // owner 2026-10-14: the directory moved to the area's "מטפלים וספקים" page (one segment per kind); the handlers segment carries the
  // department members card and the employees without an account
  {
    name: 'handlers-contacts', hash: '/tickets/handlers?seg=contacts', wait: 'sw-app tickets-handlers tickets-contacts [data-contacts-list]', within: 'tickets-handlers',
    prep: async (p) => {
      await p.locator('sw-app tickets-handlers tickets-contacts [data-contact-item="c000000000000p01"]').click();
      await p.waitForSelector('sw-app tickets-handlers tickets-contacts [data-card="contact-editor"]');
    },
  },
  {
    name: 'handlers-members', hash: '/tickets/handlers', wait: 'sw-app tickets-handlers tickets-handlers-members [data-member]', within: 'tickets-handlers',
    mock: { readiness: { master_switch: false }, publicReady: false },
    prep: async (p) => {
      await p.waitForSelector('sw-app tickets-handlers tickets-contacts[kind="employee"] [data-contacts-list]');
      await p.locator('sw-app tickets-handlers tickets-contacts[kind="employee"] [data-contact-new]').click();
      await p.waitForSelector('sw-app tickets-handlers tickets-contacts[kind="employee"] [data-card="contact-editor"]');
    },
  },
  {
    name: 'assign-nobody', hash: '/tickets/mine?t=0000000000000a02', wait: 'sw-app tickets-list ticket-detail [data-ticket-detail]', within: 'tickets-list',
    mock: { empty: true, publicReady: false },
    prep: async (p) => {
      await p.locator('sw-app tickets-list ticket-detail [data-assign]').click();
      await p.waitForSelector('sw-app tickets-list ticket-detail [data-eligible-none] [data-blocked]');
    },
  },
  {
    // owner 2026-10-14: the new-department form (a name only), the delete confirm and the deleted departments
    name: 'settings-departments', hash: '/system/tickets?tab=departments', wait: 'sw-app system-tickets [data-dept-item="dept-cleaning"]', within: 'system-tickets',
    prep: async (p) => {
      await p.locator('sw-app system-tickets [data-dept-item="dept-cleaning"]').click();
      await p.locator('sw-app system-tickets tickets-dept-editor [data-dept-delete]').click();
      await p.locator('sw-app system-tickets tickets-dept-editor [data-dept-delete-ok]').click();
      await p.locator('sw-app system-tickets [data-dept-deleted] summary').click();
      await p.locator('sw-app system-tickets [data-dept-item="dept-maintenance"]').click();
      await p.locator('sw-app system-tickets tickets-dept-editor [data-dept-delete]').click();
      await p.waitForSelector('sw-app system-tickets tickets-dept-editor [data-dept-delete-blocked]');
    },
  },
  {
    name: 'settings-public', hash: '/system/tickets', wait: 'sw-app system-tickets tickets-public-card [data-public-state]', within: 'system-tickets',
    prep: async (p) => {
      await p.locator('sw-app system-tickets tickets-public-card [data-public-advanced]').click();
      await p.waitForSelector('sw-app system-tickets tickets-public-card [data-public-cidrs]');
    },
  },
  {
    name: 'assign-outside', hash: '/tickets/mine?t=0000000000000a02', wait: `${D} [data-ticket-detail]`, within: 'tickets-list',
    prep: async (p) => {
      await p.locator(`${D} [data-assign]`).click();
      await p.locator(`${D} [data-assign-kind="person"]`).click(); // vendors and contacts are one group (owner 2026-10-14)
      await p.locator(`${D} [data-contact="c000000000000v01"] input`).check();
      await p.waitForSelector(`${D} [data-assign-preview]`);
      await p.locator(`${D} [data-preview-toggle]`).click();
    },
  },
  { name: 'link-panel', hash: '/tickets/mine?t=0000000000000a01', wait: `${D} [data-link-panel]`, within: 'tickets-list', mock: { sentTicket: true } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('outside contacts layout guard (slice 4)', () => {
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
          const base = info.project.use.baseURL;
          if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin);
          await installTicketsMock(page, { persona: 'admin', name: NAME });
          await installS4Mock(page, s.mock ?? {});
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
      console.log(`outside contacts layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
