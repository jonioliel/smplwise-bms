import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installElectricityMock, PERMS, SKINS, url } from './electricity-mocks';

// CR-023 electricity UI: the layout guard (tests/layout-guard.ts) over the meters screens - the meters overview (table, cards, the phone list, the areas tree),
// the meter card drawer, the add-a-meter dialog, the retention settings and the permission rows - in the four skins, light and dark, across widths. FAILS on
// escape / overflow / floating / clipped / target. Needs the Vite DEV server (mock layer: tests/electricity-mocks.ts):
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-electricity-meters.spec.ts --project=desktop --workers=1
// LAYOUT_QUICK=1 sweeps four widths and two skins; without it ten widths and all four skins.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKIN_SET = QUICK ? (['classic', 'bubble'] as const) : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const SKIP = '.sk, sw-icon, svg';
const BUBBLE = '.tile, .card, .li, .chip, .seg, .inp, .tree button';
const ROOTS = ['infra-electricity', 'system-infra'];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function check(page: Page, results: Finding[], ctx: string, skin: string) {
  await settle(page);
  const found = await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
  // the touch dial and the floating rule belong to the bubble foundation (the other skins keep their own sizes); a modal drawer or dialog is top-layer by design and covers the inert page behind it
  results.push(...found.filter((f) => !(f.cls === "floating" && /^dialog.panel/.test(f.el)) && (skin === "bubble" || (f.cls !== "target" && f.cls !== "floating"))));
}

interface Shot {
  name: string;
  hash: string;
  wait: string;
  perms?: string[];
  /** extra steps after the screen is ready (open the add dialog, ...) */
  then?: (page: Page) => Promise<void>;
}

const P = 'sw-app elec-meters-page';
const SHOTS: Shot[] = [
  { name: 'meters-table', hash: '/infra/electricity/meters', wait: `${P} [data-state="ready"]` },
  { name: 'meters-cards', hash: '/infra/electricity/meters', wait: `${P} [data-state="ready"]`, then: async (p) => void (await p.locator(`${P} [data-view="cards"]`).evaluate((el) => (el as HTMLElement).click()).catch(() => undefined)) },
  { name: 'meters-viewonly', hash: '/infra/electricity/meters', wait: `${P} [data-state="ready"]`, perms: PERMS.view },
  { name: 'meter-card', hash: '/infra/electricity/meters?meter=m2', wait: `${P} elec-meter-card [data-meter-card="m2"]` },
  { name: 'meter-add', hash: '/infra/electricity/meters?add=1', wait: `${P} [data-add-dialog] [data-picker-list]` },
  { name: 'retention', hash: '/system/infra/retention', wait: 'sw-app system-infra elec-settings-retention [data-state="ready"]', perms: PERMS.admin },
];

test.describe('electricity layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('meters overview, card, add dialog and retention: skins x themes x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const skin of SKIN_SET) {
      for (const theme of THEMES) {
        for (const shot of SHOTS) {
          // a fresh mock per permission set: the route handler of the last install wins
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await installElectricityMock(page, { perms: shot.perms ?? PERMS.bills });
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(shot.hash, skin, theme));
          await page.waitForSelector(shot.wait, { timeout: 20_000 });
          if (shot.then) await shot.then(page);
          await page.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await page.waitForTimeout(150);
            runs++;
            await check(page, results, `${shot.name} ${skin} ${theme} ${w}`, skin);
          }
        }
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-electricity-meters: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
