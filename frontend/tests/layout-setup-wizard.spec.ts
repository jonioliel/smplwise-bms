import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { url } from './tickets-mocks';
import { installWizardMock, type WizardMockOptions } from './secrets-setup-mocks';

// TKSPECS (TKWIZHINT): the layout guard (tests/layout-guard.ts) over the setup wizard (Settings > Setup wizard) and the shell's "השלם את ההתקנה"
// hint row against the MOCKED backend - required steps open (optional labels), only optional open (ready summary), a dismissed hint with its
// "הצג שוב" button, the hint row itself - in every skin x light / dark x widths 320-1440. FAILS on escape / overflow / clipped findings and on
// page errors; the 44 px target rule is reported (the desktop touch dial is 32 px).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-setup-wizard.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.step, .summary, .problem, .pill, .setuphint, .go, .rail li';

interface Screen {
  name: string;
  hash: string;
  mock: WizardMockOptions;
  wait: string;
  /** the guard looks at this host only (default: the whole shell) */
  within?: string;
}
const REQUIRED_OPEN = { nvr: 'failed', ha: 'todo', floor: 'todo', camera: 'todo' } as const;
const ONLY_OPTIONAL = { floor: 'todo', camera: 'todo' } as const;
const WIZ = 'sw-app system-wizard';
const SCREENS: Screen[] = [
  { name: 'wizard-required-open', hash: '/system/wizard', mock: { steps: REQUIRED_OPEN }, wait: `${WIZ} [data-wizard-progress]`, within: 'system-wizard' },
  { name: 'wizard-older-backend', hash: '/system/wizard', mock: { steps: REQUIRED_OPEN, noOptionalField: true }, wait: `${WIZ} [data-wizard-progress]`, within: 'system-wizard' },
  { name: 'wizard-optional-open', hash: '/system/wizard', mock: { steps: ONLY_OPTIONAL }, wait: `${WIZ} [data-wizard-ready]`, within: 'system-wizard' },
  { name: 'wizard-dismissed', hash: '/system/wizard', mock: { steps: REQUIRED_OPEN, dismissal: { dismissed: true, failed: ['nvr'] } }, wait: `${WIZ} [data-setup-hint-restore]`, within: 'system-wizard' },
  { name: 'shell-hint', hash: '/explore/sites', mock: { steps: REQUIRED_OPEN }, wait: 'sw-app [data-setup-hint]' },
  { name: 'shell-no-hint-optional-only', hash: '/explore/sites', mock: { steps: ONLY_OPTIONAL }, wait: 'sw-app [data-sites], sw-app sw-page' },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('setup wizard layout guard', () => {
  // Bounded on purpose (TKGATEFIX2): every wait targets the INNER [data-...] element, never the host; a failure must not burn the gate.
  test.describe.configure({ timeout: 4 * 60_000 });
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });
  for (const skin of SKIN_IDS) {
    test(`every wizard screen, width and theme [${skin}]`, async ({ page }, info) => {
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
          await installWizardMock(page, s.mock);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(s.hash, skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          if (s.name === 'shell-no-hint-optional-only') await expect(page.locator('sw-app [data-setup-hint]')).toHaveCount(0);
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], ...(s.within ? { within: s.within } : {}) });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`setup wizard layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
