import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installAccessMock, NOW, SKINS, url, type MockOptions } from './access-control-mocks';

// CR-036 S8: the layout guard (tests/layout-guard.ts) over the entry log ("פעילות") - the list, the table, the drawer with the picture, the export
// dialog, the custom-period dialog and the states (empty, error, forbidden, stale) - in every skin the product has, light and dark, across widths
// 320..1440, against the mocked backend (tests/access-control-mocks.ts). FAILS on escape / overflow / floating / clipped / target.
// Needs the Vite DEV server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ LAYOUT_QUICK=1 npx playwright test tests/layout-access-events.spec.ts --project=desktop --workers=1
// LAYOUT_QUICK=1 sweeps four widths and two skins (classic, bubble) in light; without it ten widths and every skin in both schemes.
// One test per skin x scheme, so the gate's workers share the sweep.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKIN_SET = QUICK ? SKINS.filter((s) => s === 'classic' || s === 'bubble') : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const SCREEN = 'wiskey-events';
// the visually hidden words of the phone's icon buttons, the skeleton, the icons
const SKIP = '.lbl, .sr, .sk, sw-icon, svg';
// the boxes of this screen nothing may leave, beyond the shared set
const BUBBLE = '.row, .search, .note, .frame, .sect, .grp';
const ROOTS = [SCREEN];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

interface Shot {
  name: string;
  opts?: MockOptions;
  /** the localStorage view choice ("table" falls back to the list on a phone width by itself) */
  view?: 'table';
  wait: string;
  then?: (page: Page) => Promise<void>;
}

const P = `sw-app ${SCREEN}`;
const SHOTS: Shot[] = [
  { name: 'list', wait: `${P} button.row[data-row-id]` },
  { name: 'table', view: 'table', wait: `${P} button.row[data-row-id], ${P} sw-table[data-wiskey-events-table]` },
  {
    name: 'drawer',
    wait: `${P} button.row[data-row-id="ev-0001"]`,
    then: async (p) => {
      await p.locator(`${P} button.row[data-row-id="ev-0001"]`).click();
      await p.waitForSelector(`${P} sw-drawer[open] wiskey-event-drawer [data-ev-portrait="ready"]`, { timeout: 20_000 });
    },
  },
  {
    name: 'export',
    wait: `${P} [data-wiskey-export]`,
    then: async (p) => {
      await p.locator(`${P} [data-wiskey-export]`).click();
      await p.waitForSelector(`${P} wiskey-events-export sw-dialog[open] [data-ev-export-go]`, { timeout: 20_000 });
    },
  },
  {
    name: 'custom-period',
    wait: `${P} sw-dropdown[data-wiskey-filter="range"]`,
    then: async (p) => {
      const dd = p.locator(`${P} sw-dropdown[data-wiskey-filter="range"]`);
      await dd.locator('[data-dropdown-chip]').click();
      await dd.locator('[role="option"][data-id="custom"]').click();
      await p.waitForSelector(`${P} sw-dialog[data-wiskey-custom-range][open] [data-wiskey-filter-start]`, { timeout: 20_000 });
    },
  },
  { name: 'empty', opts: { events: 'empty' }, wait: `${P} sw-state-panel[data-wiskey-events-empty]` },
  { name: 'error', opts: { events: 'error' }, wait: `${P} sw-state-panel[data-wiskey-state="load_error"]` },
  { name: 'forbidden', opts: { persona: 'viewer' }, wait: `${P} sw-state-panel[data-wiskey-state="no_permission"]` },
  { name: 'not-installed', opts: { events: 'not_installed' }, wait: `${P} sw-state-panel[data-wiskey-state="not_installed"]` },
];

test.describe('entry log layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKIN_SET) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: list, table, drawer, dialogs and states across widths`, async ({ page, context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        let runs = 0;
        for (const shot of SHOTS) {
          const p = await context.newPage(); // a page of its own per screen: the mock's routes and sockets belong to it
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          // the view choice is kept in localStorage, which the pages of one context share: every screen says which it wants
          await p.addInitScript((v) => localStorage.setItem('sw.wiskey.events.view', v), shot.view ?? 'list');
          await installAccessMock(p, shot.opts ?? {});
          await p.clock.setFixedTime(NOW);
          await p.setViewportSize({ width: 1440, height: 900 });
          await p.goto(url('/wiskey/events', skin, theme));
          await p.waitForSelector(shot.wait, { timeout: 30_000 });
          if (shot.then) await shot.then(p);
          await p.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await p.setViewportSize({ width: w, height: height(w) });
            await p.waitForTimeout(150);
            await settle(p);
            runs++;
            const found = await p.evaluate(inPageCheck, { ctx: `${shot.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
            // a modal drawer / dialog is top-layer by design and covers the inert page behind it; the touch dial and the floating rule belong to
            // the bubble foundation (the other skins keep their own sizes) - this screen's own controls are 44 px on touch widths in every skin
            // (asserted by the evidence spec), the shared components' own sizes are theirs
            results.push(...found.filter((f) => !(f.cls === 'floating' && /^dialog.panel/.test(f.el)) && (skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating'))));
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-access-events ${skin} ${theme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        void page;
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
      });
    }
  }
});
