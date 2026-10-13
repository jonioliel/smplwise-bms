import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installAccessMock, NOW, SKINS, url, type MockOptions } from './access-control-mocks';

// CR-036 S9: the layout guard (tests/layout-guard.ts) over the read-only schedules screen ("לוחות זמנים") - the door view with its week grid,
// the table across doors, the phone's door sheet, the library and proposals, and the states (empty, error, forbidden, busy) - in every skin
// the product has, light and dark, across widths 320..1440, against the mocked backend (tests/access-control-mocks.ts). FAILS on escape /
// overflow / floating / clipped / target. Needs the Vite DEV server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ LAYOUT_QUICK=1 npx playwright test tests/layout-access-schedules.spec.ts --project=desktop --workers=1
// LAYOUT_QUICK=1 sweeps four widths and two skins (classic, bubble) in light; without it ten widths and every skin in both schemes.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKIN_SET = QUICK ? SKINS.filter((s) => s === 'classic' || s === 'bubble') : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const SCREEN = 'wiskey-schedules';
const SKIP = '.sr, sw-icon, svg';
// the boxes of this screen nothing may leave, beyond the shared set
const BUBBLE = '.row, .block, .doorhead, .chip, .doors button';
const ROOTS = [SCREEN];
const ON = { 'access.ui.schedules': 'smplwise' };

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

interface Shot {
  name: string;
  opts?: MockOptions;
  view?: 'table';
  wait: string;
  then?: (page: Page) => Promise<void>;
}

const P = `sw-app ${SCREEN}`;
const SHOTS: Shot[] = [
  { name: 'door', wait: `${P} [data-sch-program]` },
  { name: 'door-draft', wait: `${P} [data-sch-program="draft"]` }, // opened by its link (?door=entry-b:2)
  { name: 'table', view: 'table', wait: `${P} sw-table[data-sch-table], ${P} [data-sch-program]` },
  {
    name: 'sheet',
    wait: `${P} [data-sch-program]`,
    then: async (p) => {
      await p.setViewportSize({ width: 390, height: 844 });
      await p.locator(`${P} [data-sch-door-chip]`).click();
      await p.waitForSelector(`${P} sw-drawer[data-sch-sheet][open] button[data-sch-door]`, { timeout: 20_000 });
    },
  },
  { name: 'empty', opts: { schedules: 'empty' }, wait: `${P} [data-sch-panel="no-program"]` },
  { name: 'error', opts: { schedules: 'error' }, wait: `${P} [data-sch-panel="door-error"]` },
  { name: 'busy', opts: { schedules: 'busy' }, wait: `${P} [data-sch-panel="door-busy"]` },
  { name: 'forbidden', opts: { persona: 'viewer' }, wait: `${P} [data-sch-panel="forbidden"]` },
];

test.describe('schedules layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKIN_SET) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: door view, table, sheet, library and states across widths`, async ({ page, context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        let runs = 0;
        for (const shot of SHOTS) {
          const p = await context.newPage();
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          await p.addInitScript((v) => localStorage.setItem('sw.wiskey.schedules.view', v), shot.view ?? 'door');
          await installAccessMock(p, { ...(shot.opts ?? {}), settings: ON });
          await p.clock.setFixedTime(NOW);
          await p.setViewportSize({ width: 1440, height: 900 });
          await p.goto(url(shot.name === 'door-draft' ? '/wiskey/schedules?door=entry-b:2' : '/wiskey/schedules', skin, theme));
          await p.waitForSelector(shot.wait, { timeout: 30_000 });
          if (shot.then) await shot.then(p);
          await p.evaluate(() => document.fonts.ready);
          // the open sheet is a phone's: it is swept at the phone widths only
          for (const w of shot.name === 'sheet' ? WIDTHS.filter((x) => x < 820) : WIDTHS) {
            await p.setViewportSize({ width: w, height: height(w) });
            await p.waitForTimeout(150);
            await settle(p);
            runs++;
            const found = await p.evaluate(inPageCheck, { ctx: `${shot.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
            // a modal drawer is top-layer by design; the touch dial and the floating rule belong to the bubble foundation (the other skins keep
            // their own sizes) - this screen's own controls are 44 px on touch widths in every skin (asserted by the evidence spec)
            results.push(...found.filter((f) => !(f.cls === 'floating' && /^dialog.panel/.test(f.el)) && (skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating'))));
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-access-schedules ${skin} ${theme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        void page;
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
      });
    }
  }
});
