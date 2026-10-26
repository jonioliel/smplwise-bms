import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
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
const overview = (scenario: Scenario) => async (p: Page) => { await installCostsTabMock(p, scenario); return `/tickets/all?t=${CID}&tab=overview`; };
const OWNER = `${L} [data-ov="people"] [data-person="owner"]`;
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
  // TKUI3B: a quote on the vendor's behalf (the entry on the empty stage, the card's menu, the dialog, the viewer's own entry) and the internal owner
  { name: 'costs-own', open: costs('own'), wait: COSTS_READY },
  { name: 'costs-onbehalf-menu', open: costs('quote'), wait: COSTS_READY, prep: async (p) => p.locator(`${T} [data-quote-more]`).click() },
  { name: 'costs-onbehalf-dialog', open: costs('empty'), wait: COSTS_READY, prep: async (p) => { await p.locator(`${T} [data-ob-entry]`).click(); await p.locator(`${T} ticket-quote-form [data-ob-notice]`).waitFor(); } },
  { name: 'overview-owner', open: overview('quote'), wait: OWNER },
  { name: 'overview-owner-none', open: overview('empty'), wait: `${L} [data-owner="none"]` },
  { name: 'overview-owner-dialog', open: overview('quote'), wait: OWNER, prep: async (p) => { await p.locator(`${L} [data-ov-owner-change]`).click(); await p.locator(`${L} sw-dialog[data-dialog="owner"] [data-owner-choice]`).first().waitFor(); } },
];

/** The box of every open sw-dialog inside the tickets list (through shadow roots), measured against the viewport. */
async function dialogBoxes(page: Page): Promise<{ l: number; t: number; r: number; b: number; vw: number; vh: number }[]> {
  return page.evaluate(() => {
    const found: Element[] = [];
    const walk = (root: ParentNode) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.tagName === 'SW-DIALOG' && el.hasAttribute('open')) found.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    const list = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-list');
    if (list) walk(list.shadowRoot ?? list);
    return found.flatMap((d) => {
      const box = d.shadowRoot?.querySelector('.box');
      if (!box) return [];
      const r = box.getBoundingClientRect();
      return [{ l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }];
    });
  });
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('tickets drawer tabs layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`conversation, history, costs and the overview owner at every width and theme [${skin}]`, async ({ page }, info) => {
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
            // TKGATEFIX4: the on-behalf quote dialog (sw-dialog, TKUI3B) is rendered by the costs tab, so its modal overlay (`div.backdrop`,
            // position: fixed, inset 0) lives inside the tab panel's DOM (`div.panel.stack`). The guard's escape rule skips content UNDER a
            // fixed layer but has no exemption for a fixed element that is itself the descendant, so the viewport-wide overlay reads as
            // "outside the panel" - the same case and the same treatment as layout-tickets-map.spec.ts (the map picker). Everything inside
            // the dialog box is still checked by the guard, and the box itself must sit inside the viewport (checked below).
            for (const f of found) {
              if (f.cls === 'escape' && f.el.startsWith('div.backdrop')) continue;
              (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
            }
            for (const box of await dialogBoxes(page)) {
              if (box.l < -1 || box.t < -1 || box.r > box.vw + 1 || box.b > box.vh + 1) results.push({ cls: 'escape', el: 'sw-dialog .box', detail: `the dialog leaves the viewport (${JSON.stringify(box)})`, ctx: `${s.name} ${skin} ${theme} ${w}` });
            }
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
