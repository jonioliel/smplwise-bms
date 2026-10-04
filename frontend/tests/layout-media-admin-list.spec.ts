import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { setLook } from './bubble-chrome-screens';

// 0.1.161: the layout guard (tests/layout-guard.ts) over the settings lists of screens and speakers / players (הגדרות › מולטימדיה): the compact
// table, the grouped list, an open form and the open connections - in demo mode (every /api/v1 call is aborted: the demo devices answer).
// The bubble skin runs all five classes across widths x light / dark; classic, domus and tesla run the four geometry classes (plus 44 px
// targets at the phone width). The pre-existing forms (.dev, .ep, .seg), the "approve all" sw-button (26 px in the classic skins before this change) and the shared sw-dropdown / sw-toggle keep their own contracts.
// Needs the Vite DEV server:
//   SW_BASE_URL=http://127.0.0.1:5251/ npx playwright test tests/layout-media-admin-list.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const BUBBLE_WIDTHS = QUICK ? [390, 1440] : [320, 390, 768, 1024, 1440];
const OTHER_WIDTHS = QUICK ? [390, 1440] : [390, 820, 1440];
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = ".tog, .tgl, [role='switch'], input[type='checkbox'], input[type='radio'], .sr-only, .vh, sw-dropdown, sw-toggle, sw-button, .dev, .ep, .seg, [data-drawer-close]";
const BUBBLE = '.thead, .ghead, .tr';

interface Case { id: string; prep?: (p: Page) => Promise<void> }
const sys = (p: Page) => p.locator('sw-app system-multimedia');
const CASES: Case[] = [
  { id: 'table' },
  { id: 'grouped', prep: async (p) => { await sys(p).locator('[data-mm-group] button').first().click(); await p.getByRole('option', { name: 'לפי אינטגרציה' }).click(); await p.waitForTimeout(300); } },
  { id: 'form', prep: async (p) => { await sys(p).locator('[data-mm-edit]').first().click(); await p.waitForTimeout(300); } },
  { id: 'connections', prep: async (p) => { await sys(p).locator('[data-mm-toggle-endpoints]').first().click(); await p.waitForTimeout(300); } },
];

async function openCase(page: Page, skin: string, theme: string) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('sw.ui.look'); for (const k of Object.keys(localStorage)) if (k.startsWith('sw.media-admin.view.')) localStorage.removeItem(k); } catch { /* storage unavailable */ }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/system/multimedia`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('system-multimedia')?.shadowRoot?.querySelector('[data-mm-admin-device]'), null, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function run(page: Page, skin: string, widths: number[], classesFor: (w: number) => Finding['cls'][]) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const results: Finding[] = [];
  let runs = 0;
  for (const theme of ['light', 'dark']) {
    for (const c of CASES) {
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: height(w) });
        await openCase(page, skin, theme);
        if (skin === 'bubble') await setLook(page, { density: 'regular', surface: 'fill', radius: 'pill', touch: 44, performance: 'full' });
        if (c.prep) await c.prep(page);
        await settle(page);
        runs++;
        const found = await page.evaluate(inPageCheck, { ctx: `${c.id} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ['system-multimedia'], within: 'system-multimedia' });
        results.push(...found.filter((f) => classesFor(w).includes(f.cls)));
      }
    }
  }
  const { byCls, lines } = summarize(results);
  console.log(`layout-media-admin-list (${skin}): ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

test.describe('layout guard: the settings lists of screens and speakers', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });
  test('bubble skin: every state, every class, light and dark', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    await run(page, 'bubble', BUBBLE_WIDTHS, () => ['escape', 'overflow', 'floating', 'clipped', 'target']);
  });
  for (const skin of ['classic', 'domus', 'tesla']) test(`${skin} skin: the geometry classes (44 px targets at the phone width)`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    await run(page, skin, OTHER_WIDTHS, (w) => (w <= 480 ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'floating', 'clipped']));
  });
});
