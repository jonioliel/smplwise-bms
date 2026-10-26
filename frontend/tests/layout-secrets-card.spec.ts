import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installSecretsMock, type SecretsMockOptions } from './secrets-setup-mocks';

// TKSPECS: the layout guard (tests/layout-guard.ts) over the secrets card (Settings > Connections > Secrets) against the MOCKED backend - the
// list with all four states, a row being edited, the two-step clear, the connection-test answers, the restart note, the forbidden / error /
// remote-blocked states - in every skin x light / dark x widths 320-1440. FAILS on escape / overflow / clipped findings and on page errors;
// the 44 px target rule is reported (the desktop touch dial is 32 px).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-secrets-card.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.row, .hint, .err, .acts, .lbl';
const C = 'sw-app system-setup sw-secrets-card';
const ROWS = `${C} [data-secret-row]`;
const LONG = 'a-very-long-fake-secret-value-without-any-break-0123456789-abcdefghijklmnopqrstuvwxyz';

interface Screen {
  name: string;
  mock?: SecretsMockOptions;
  wait: string;
  prep?: (p: Page) => Promise<void>;
}
const rowOf = (p: Page, n: string) => p.locator(`${C} [data-secret-row="${n}"]`);
const SCREENS: Screen[] = [
  { name: 'list', wait: ROWS },
  { name: 'editing', wait: ROWS, prep: async (p) => { const r = rowOf(p, 'go2rtc_api_password'); await r.locator('[data-secret-replace]').click(); await r.locator('[data-secret-input]').fill(LONG); } },
  { name: 'typing-new', wait: ROWS, prep: async (p) => rowOf(p, 'wiskey_background_token').locator('[data-secret-input]').fill(LONG) },
  { name: 'confirm-clear', wait: ROWS, prep: async (p) => rowOf(p, 'go2rtc_api_password').locator('[data-secret-clear]').click() },
  {
    name: 'test-answers', wait: ROWS, mock: { testCode: { go2rtc_api_password: 'username_missing', wiskey_password: 'station_failed' } },
    prep: async (p) => {
      for (const n of ['go2rtc_api_password', 'wiskey_password']) {
        await rowOf(p, n).locator('[data-secret-test-stored]').click();
        await rowOf(p, n).locator('[data-secret-test-result]').waitFor({ timeout: 20_000 });
      }
    },
  },
  {
    name: 'restart-note', wait: ROWS,
    prep: async (p) => { const r = rowOf(p, 'wiskey_background_token'); await r.locator('[data-secret-input]').fill(LONG); await r.locator('[data-secret-save]').click(); await p.waitForSelector(`${C} [data-secrets-restart]`, { timeout: 20_000 }); },
  },
  {
    name: 'write-forbidden', wait: ROWS, mock: { writeForbidden: true },
    prep: async (p) => { const r = rowOf(p, 'wiskey_background_token'); await r.locator('[data-secret-input]').fill('x'); await r.locator('[data-secret-save]').click(); await p.waitForSelector(`${C} [data-secrets-error]`, { timeout: 20_000 }); },
  },
  { name: 'list-forbidden', wait: `${C} [data-secrets-error]`, mock: { list: 'forbidden' } },
  { name: 'list-error', wait: `${C} [data-secrets-error]`, mock: { list: 'error' } },
  { name: 'remote-blocked', wait: `${C} [data-secrets-local-only]`, mock: { remote: true } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('secrets card layout guard', () => {
  // Bounded on purpose (TKGATEFIX2): every wait targets the INNER [data-...] element, never the host; a failure must not burn the gate.
  test.describe.configure({ timeout: 4 * 60_000 });
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });
  for (const skin of SKIN_IDS) {
    test(`every secrets screen, width and theme [${skin}]`, async ({ page }, info) => {
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
          await installSecretsMock(page, s.mock ?? {});
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url('/system/setup', skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'sw-secrets-card' });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`secrets card layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
