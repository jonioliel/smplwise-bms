import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installDeleteMock } from './tickets-delete-mocks';

// Owner 14.10: the layout guard (tests/layout-guard.ts) over the deletion UI against the MOCKED backend - the drawer with its danger
// action, the one-ticket dialog filled in, and the table's bulk bar with "מחיקה" and its dialog - in every skin x light / dark x widths
// 320-1440. FAILS on escape / overflow / clipped findings and on page errors; the 44 px target rule and floating layers are reported.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-delete.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.chip, .rc, .seg, .banner, .statebox, .bulk, .cl a.ci, .pop, .warn';
const T = 'sw-app tickets-list tickets-table';
const D = 'sw-app tickets-list ticket-detail';
const A02 = '0000000000000a02';

interface Screen {
  name: string;
  hash: string;
  wait: string;
  prep?: (p: Page) => Promise<void>;
  /** the bulk bar lives in the table (>= 768 px); the dialog is a modal layer at every width */
  minWidth?: number;
}
const SCREENS: Screen[] = [
  { name: 'drawer', hash: `/tickets/mine?t=${A02}`, wait: `${D} [data-more]` },
  { name: 'dialog', hash: `/tickets/mine?t=${A02}`, wait: `${D} [data-more]`, prep: async (p) => {
    await p.locator(`${D} [data-more]`).click(); // TKUI1: the deletion is in the "⋯" menu
    await p.locator(`${D} [data-delete-ticket]`).click();
    await p.locator(`${D} tickets-delete-dialog [data-delete-confirm]`).fill('1043');
    await p.locator(`${D} tickets-delete-dialog [data-delete-reason]`).fill('נפתחה פעמיים בטעות, אותה תקלה בדיוק כמו בבקשה הקודמת של אותו חדר');
  } },
  { name: 'bulk-bar', hash: '/tickets/mine', wait: `${T} tbody tr`, minWidth: 768, prep: async (p) => {
    await p.locator(`${T} tbody [data-select]`).nth(0).click();
    await p.locator(`${T} tbody [data-select]`).nth(2).click({ modifiers: ['Shift'] });
    await p.locator(`${T} tickets-table-bulk [data-bulk="delete"]`).waitFor();
  } },
  { name: 'bulk-dialog', hash: '/tickets/mine', wait: `${T} tbody tr`, minWidth: 768, prep: async (p) => {
    await p.locator(`${T} tbody [data-select]`).nth(0).click();
    await p.locator(`${T} tbody [data-select]`).nth(2).click({ modifiers: ['Shift'] });
    await p.locator(`${T} tickets-table-bulk [data-bulk="delete"]`).click();
    await p.locator(`${T} tickets-delete-dialog [data-delete-confirm]`).fill('3');
  } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('tickets deletion layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`the deletion UI at every width and theme [${skin}]`, async ({ page }, info) => {
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
          await installDeleteMock(page);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(s.hash, skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            if (s.minWidth && w < s.minWidth) continue;
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
      console.log(`tickets deletion layout [${skin}]: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
