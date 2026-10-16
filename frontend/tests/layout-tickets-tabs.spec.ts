import { test, expect, type Page } from '@playwright/test';
import { SKIN_IDS } from '../src/design/skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installConvMock, VID } from './tickets-conv-mocks';
import { CID, installCostsTabMock, type Scenario } from './tickets-costs-tab-mocks';
import { drawerScrollers } from './tickets-scrollers';

// TKUI7: the layout guard (tests/layout-guard.ts) over the request drawer's Conversation, History and Costs tabs against the MOCKED backend -
// every skin x light / dark x widths 320-1440 (the drawer on a desktop, the full sheet below 768 px). FAILS on escape / overflow / clipped
// findings, on page errors, and when the tab has any scroll container besides the drawer body (IA §4.1: ONE scroll per tab); the 44 px rule
// is reported. The per-tab one-scroller assertions live in layout-tickets-drawer / layout-tickets-conversation; this adds the width sweep.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-tabs.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.chip, .rc, .seg, .banner, .statebox, .blk, .sentence, .msg, .bubble, .card, .qc, .stepper, .step, .doc';
const L = 'sw-app tickets-list ticket-detail';
const T = `${L} ticket-costs-tab`;
const COSTS_READY = `${T} [data-costs-tab]:not([data-costs-state="loading"])`;

interface Screen {
  name: string;
  /** Installs the mock and returns the hash to open. */
  open: (p: Page) => Promise<string>;
  wait: string;
  prep?: (p: Page) => Promise<void>;
}
const conv = async (p: Page, tab: 'conv' | 'history') => { await installConvMock(p); return `/tickets/all?t=${VID}&tab=${tab}`; };
const costs = (scenario: Scenario) => async (p: Page) => { await installCostsTabMock(p, scenario); return `/tickets/all?t=${CID}&tab=costs`; };
const SCREENS: Screen[] = [
  { name: 'conv-vendor', open: (p) => conv(p, 'conv'), wait: `${L} [data-tab-panel="conv"]` },
  { name: 'conv-vendor-expanded', open: (p) => conv(p, 'conv'), wait: `${L} [data-tab-panel="conv"]`, prep: async (p) => p.locator(`${L} [data-conv-older]`).click() },
  { name: 'conv-team', open: (p) => conv(p, 'conv'), wait: `${L} [data-tab-panel="conv"]`, prep: async (p) => p.locator(`${L} [data-conv-sub="team"]`).click() },
  { name: 'history', open: (p) => conv(p, 'history'), wait: `${L} [data-history-filters]` },
  { name: 'costs-quote', open: costs('quote'), wait: COSTS_READY },
  { name: 'costs-quote-partial', open: costs('quote'), wait: COSTS_READY, prep: async (p) => p.locator(`${T} [data-quote-partial]`).click() },
  { name: 'costs-demand', open: costs('demand'), wait: COSTS_READY },
  { name: 'costs-staff', open: costs('staff'), wait: COSTS_READY },
  { name: 'costs-empty', open: costs('empty'), wait: COSTS_READY },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('tickets drawer tabs layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`conversation, history and costs at every width and theme [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      const targets: Finding[] = [];
      const scrollFindings: string[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          const hash = await s.open(page);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(hash, skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const sc = await drawerScrollers(page);
            if (sc.length !== 1 || sc[0] !== 'div.body') scrollFindings.push(`${s.name} ${skin} ${theme} ${w}: scroll containers [${sc.join(', ')}]`);
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'tickets-list' });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`tickets tabs layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), scroll findings ${scrollFindings.length}, page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(scrollFindings, 'ONE scroll per tab').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
