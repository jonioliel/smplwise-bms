import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installAccessMock, NOW, SKINS, url, type MockOptions } from './access-control-mocks';
import { installParityMock, type ParityMock } from './access-parity-mocks';

// CR-036 S12: the layout guard (tests/layout-guard.ts) over what this slice added - Settings › כללי › מתגי מסכי כניסה with the stations-screen
// display card and the parity report (idle, a report, another user's report, refused), and the intercom action log with its period and person
// filters - in every skin, light and dark, across widths 320..1440, against the mocked backend. FAILS on escape / overflow / floating / clipped /
// target. Needs the Vite DEV server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ LAYOUT_QUICK=1 npx playwright test tests/layout-access-s12.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKIN_SET = QUICK ? SKINS.filter((s) => s === 'classic' || s === 'bubble') : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

// the skeleton and the icons carry no text of their own
const SKIP = '.sk, sw-icon, svg';
const BUBBLE = '.row, .ch, .chk, .chk-head, .empty, .foot-note, .note, .foot';
const ROOTS = ['system-access-display', 'system-access-parity', 'system-access-audit'];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const SETTINGS = '/system/diagnostics?tab=access-control';
const D = 'sw-app system-diagnostics';
interface Shot {
  name: string;
  hash?: string;
  opts?: MockOptions;
  parity?: ParityMock['mode'];
  wait: string;
  then?: (page: Page) => Promise<void>;
}

const run = async (p: Page) => {
  await p.locator(`${D} system-access-parity sw-button[data-parity-run]`).click();
  await p.waitForSelector(`${D} system-access-parity sw-card[data-parity-state="ready"], ${D} system-access-parity sw-state-panel`, { timeout: 20_000 });
};

const SHOTS: Shot[] = [
  { name: 'switches-idle', wait: `${D} system-access-parity [data-parity-idle]` },
  { name: 'parity-report', wait: `${D} system-access-parity [data-parity-idle]`, then: run },
  {
    name: 'parity-other-user',
    wait: `${D} system-access-parity sw-dropdown[data-parity-subject]`,
    then: async (p) => {
      const dd = p.locator(`${D} system-access-parity sw-dropdown[data-parity-subject]`);
      await dd.locator('[data-dropdown-chip]').click();
      await dd.locator('[role="option"][data-id="u-operator-a"]').click();
      await run(p);
    },
  },
  { name: 'parity-refused', opts: { persona: 'siteAdmin' }, parity: 'forbidden', wait: `${D} system-access-parity [data-parity-idle]`, then: run },
  {
    name: 'audit-filtered',
    hash: '/system/access-control/audit',
    wait: 'sw-app system-access-audit [data-access-audit-person="u1"]',
    then: async (p) => {
      await p.locator('sw-app system-access-audit [data-access-audit-person="u1"]').click();
      await p.waitForSelector('sw-app system-access-audit [data-access-audit-person-chip]', { timeout: 20_000 });
    },
  },
];

test.describe('S12 layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKIN_SET) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: the display card, the parity report and the filtered action log across widths`, async ({ page, context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        let runs = 0;
        for (const shot of SHOTS) {
          const p = await context.newPage();
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          const mock = await installAccessMock(p, shot.opts ?? {});
          await installParityMock(p, mock, shot.parity ?? 'ready');
          await p.clock.setFixedTime(NOW);
          await p.setViewportSize({ width: 1440, height: 900 });
          await p.goto(url(shot.hash ?? SETTINGS, skin, theme));
          await p.waitForSelector(shot.wait, { timeout: 30_000 });
          if (shot.then) await shot.then(p);
          await p.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await p.setViewportSize({ width: w, height: height(w) });
            await p.waitForTimeout(150);
            await settle(p);
            runs++;
            const found = await p.evaluate(inPageCheck, { ctx: `${shot.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
            // the touch dial and the floating rule belong to the bubble foundation (the other skins keep the shared components' own sizes);
            // this slice's own targets are 44 px in every skin (asserted by evidence-access-s12.spec.ts)
            results.push(...found.filter((f) => !(f.cls === 'floating' && /^dialog.panel/.test(f.el)) && (skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating'))));
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-access-s12 ${skin} ${theme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        void page;
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
      });
    }
  }
});
