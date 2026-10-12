import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installAccessMock, NOW, SKINS, url, type MockOptions } from './access-control-mocks';

// CR-036 S10: the layout guard (tests/layout-guard.ts) over the Settings page "בקרת כניסה" - the status page, a station's health card, the
// intercom's action log, the groups and fields, and the states (empty, busy, not connected, forbidden, a station-scoped administrator's
// narrower page) - in every skin the product has, light and dark, across widths 320..1440, against the mocked backend
// (tests/access-control-mocks.ts). FAILS on escape / overflow / floating / clipped / target.
// Needs the Vite DEV server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ LAYOUT_QUICK=1 npx playwright test tests/layout-access-status.spec.ts --project=desktop --workers=1
// LAYOUT_QUICK=1 sweeps four widths and two skins (classic, bubble) in light; without it ten widths and every skin in both schemes.
// One test per skin x scheme, so the gate's workers share the sweep.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKIN_SET = QUICK ? SKINS.filter((s) => s === 'classic' || s === 'bubble') : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const PAGE = 'system-access-control';
// the skeleton and the icons carry no text of their own
const SKIP = '.sk, sw-icon, svg';
// the boxes of this page nothing may leave, beyond the shared set
const BUBBLE = '.row, .tile, .note, .ch, .sect, .strip, .day, .empty, .foot-note';
const ROOTS = [PAGE];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

interface Shot {
  name: string;
  hash?: string;
  opts?: MockOptions;
  wait: string;
  then?: (page: Page) => Promise<void>;
}

const P = `sw-app ${PAGE}`;
const SHOTS: Shot[] = [
  { name: 'status', wait: `${P} system-access-status [data-access-status="ready"]` },
  {
    name: 'station',
    wait: `${P} [data-access-station="entry-c"]`,
    then: async (p) => {
      await p.locator(`${P} [data-access-station="entry-c"]`).click();
      await p.waitForSelector(`${P} sw-drawer[open] system-access-health [data-health-strip]`, { timeout: 20_000 });
    },
  },
  {
    name: 'alerts-muted',
    wait: `${P} [data-access-alerts-muted]`,
    then: async (p) => {
      await p.locator(`${P} [data-access-alerts-muted]`).click();
      await p.waitForSelector(`${P} [data-access-alert][data-tone="muted"]`, { timeout: 20_000 });
    },
  },
  { name: 'audit', hash: '/system/access-control/audit', wait: `${P} system-access-audit [data-access-audit-table]` },
  { name: 'groups', hash: '/system/access-control/groups', wait: `${P} system-access-groups [data-access-versions]` },
  { name: 'policy', hash: '/system/access-control/policy', wait: `${P} system-access-policy [data-access-policy]` },
  { name: 'scoped', opts: { persona: 'scopedAdmin' }, wait: `${P} system-access-status [data-access-status="ready"]` },
  { name: 'empty', opts: { status: 'empty' }, wait: `${P} [data-access-card="health"] .empty` },
  { name: 'busy', opts: { status: 'rate' }, wait: `${P} [data-access-state="rate"]` },
  { name: 'not-connected', opts: { status: 'not_configured' }, wait: `${P} [data-access-state="not_configured"]` },
  { name: 'forbidden', opts: { persona: 'viewer' }, wait: `${P} sw-state-panel[data-access-state="no_permission"]` },
];

test.describe('access-control Settings page layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKIN_SET) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: status, a station's card, the log, the groups and the states across widths`, async ({ page, context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        let runs = 0;
        for (const shot of SHOTS) {
          const p = await context.newPage(); // a page of its own per screen: the mock's routes and sockets belong to it
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          await installAccessMock(p, shot.opts ?? {});
          await p.clock.setFixedTime(NOW);
          await p.setViewportSize({ width: 1440, height: 900 });
          await p.goto(url(shot.hash ?? '/system/access-control', skin, theme));
          await p.waitForSelector(shot.wait, { timeout: 30_000 });
          if (shot.then) await shot.then(p);
          await p.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await p.setViewportSize({ width: w, height: height(w) });
            await p.waitForTimeout(150);
            await settle(p);
            runs++;
            const found = await p.evaluate(inPageCheck, { ctx: `${shot.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
            // a modal drawer is top-layer by design and covers the inert page behind it; the touch dial and the floating rule belong to the
            // bubble foundation (the other skins keep their own sizes) - this page's own controls are 44 px on touch widths in every skin
            // (asserted by the evidence spec), the shared components' own sizes are theirs
            results.push(...found.filter((f) => !(f.cls === 'floating' && /^dialog.panel/.test(f.el)) && (skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating'))));
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-access-status ${skin} ${theme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        void page;
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
      });
    }
  }
});
