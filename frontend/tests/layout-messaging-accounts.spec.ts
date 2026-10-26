import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installMessagingMock, waUrl, type WaMockOptions } from './messaging-mocks';

// CR-038 slice 5a: the layout guard (tests/layout-guard.ts) over Settings › ערוץ ההודעות against the MOCKED backend - the full screen with the
// department rows and the pacing open, the manual dialog, the queued-move confirm, the read-only and the empty states - in every skin x
// light / dark x widths 320-1440. FAILS on escape / overflow / clipped findings and on page errors; the 44 px target rule is reported.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-messaging-accounts.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, option';
const BUBBLE = '.acc, .tag, .usegroup, .pace, .form';
const S = 'sw-app system-messaging-accounts';

interface Screen {
  name: string;
  mock?: WaMockOptions;
  prep?: (p: Page) => Promise<void>;
}
const SCREENS: Screen[] = [
  { name: 'full', prep: async (p) => { await p.locator(`${S} [data-pacing-toggle]`).click(); } },
  { name: 'manual-dialog', prep: async (p) => { await p.locator(`${S} [data-manual-add]`).click(); await p.locator(`${S} [data-manual-new-value]`).fill('01JFAKEOFFICE'); await p.locator(`${S} [data-manual-ok]`).click(); } },
  { name: 'confirm', mock: { queued: 3 }, prep: async (p) => { await p.locator(`${S} [data-use-pick="tickets.messages"]`).selectOption('entry:01JFAKEINTERC'); await p.locator(`${S} [data-save]`).click(); await p.locator(`${S} [data-confirm-count]`).waitFor(); } },
  { name: 'readonly', mock: { persona: 'configure' } },
  { name: 'empty', mock: { empty: true, wsDown: true } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('messaging accounts layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`every state, width and theme [${skin}]`, async ({ page }, info) => {
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
          await installMessagingMock(page, s.mock ?? {});
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(waUrl('/system/messaging-accounts', skin, theme));
          await page.waitForSelector(`${S} [data-messaging-accounts][data-state="ready"]`, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'system-messaging-accounts' });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`messaging layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
