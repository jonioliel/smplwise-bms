import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installBubbleMock } from './bubble-mocks';

// MD1 material dials (owner 2026-10-03): the layout guard (tests/layout-guard.ts) over the real home and area and the components'
// demo page under every material preset x depth / tint strong x scheme x width x performance tier, and under every ready palette
// for frosted and neon. The material is paint only (background layers and shadows; the list stripe is inside the pill), so the
// guard must find nothing the plain bubble sweep (layout-bubble-screens.spec.ts) does not: escape / overflow / floating / clipped /
// target. The neon bloom is a shadow, not a box: the guard measures boxes, which is why "nothing floats" still holds.
// Needs the Vite DEV server (the dials go through /src/design/look.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5215      then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/layout-material.spec.ts --project=desktop --workers=1
//   LAYOUT_QUICK=1 sweeps four widths; LAYOUT_PERF=lite|full runs one tier.
const LOOK_URL = '/src/design/look.ts';
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const PRESETS = ['none', 'frosted', 'paper', 'neon'] as const;
const THEMES = ['light', 'dark'] as const;
const PERFS = (process.env.LAYOUT_PERF ? [process.env.LAYOUT_PERF] : ['full', 'lite']) as ('full' | 'lite')[];
const PALETTES = ['calm-blue', 'purple-rose', 'teal-green', 'amber-sand', 'graphite', 'deep-ocean', 'forest', 'sunset', 'rose-quartz', 'high-contrast'];
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const SKIP = '.vh, .gbox, .bg, .veil, .edit-slot, .skl, .lay-rz, .wx-ic, .wx-fc svg, .fc';
const BUBBLE = '.arow, a.tile, .wg, .pcard, .hero, sw-kpi, .bsep, .rc, .scard, .msens, .sec-strip, .sec-chip, .bbtn, .target, .bmore, .floorbtn, .search, .qsb, .qbtn, .mchip, .k, .vb, .rb, .pk, .pw, .rbtn, .cov';

async function setLook(page: Page, look: Record<string, string | number>) {
  await page.evaluate(
    async ([url, l]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnLook(l);
      const want = (l as Record<string, unknown>).material;
      if (want && document.documentElement.getAttribute('data-bubble-material') !== want) throw new Error('data-bubble-material is ' + document.documentElement.getAttribute('data-bubble-material') + ', wanted ' + want);
    },
    [LOOK_URL, look] as const,
  );
}
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page: Page, hash: string, theme: string, outer: string, inner: string, extra = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble&scheme=${theme}${extra}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(([o, i]) => !!document.querySelector('sw-app')?.shadowRoot?.querySelector(o)?.shadowRoot?.querySelector(i), [outer, inner] as const, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** The material combos of one width: every preset at depth 2 / tint 2 on the fill and the glass surface (the glass one carries the wash), plus the list density. */
function combos(perf: 'full' | 'lite'): Record<string, string | number>[] {
  const out: Record<string, string | number>[] = [];
  for (const material of PRESETS) {
    out.push({ material, depth: 2, tint: 2, surface: 'glass', density: 'regular', performance: perf });
    if (!QUICK || material === 'neon') out.push({ material, depth: 2, tint: 2, surface: 'fill', density: 'regular', performance: perf });
    if (material === 'neon' || material === 'frosted') out.push({ material, depth: 2, tint: 2, surface: 'glass', density: 'row', performance: perf });
  }
  return out;
}

async function check(page: Page, results: Finding[], ctx: string, roots: string[]) {
  await settle(page);
  results.push(...(await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, roots })));
}

async function scrollMain(page: Page, to: 'top' | 'bottom') {
  await page.evaluate((t) => {
    const m = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    if (m) m.scrollTop = t === 'top' ? 0 : m.scrollHeight;
  }, to);
  await page.waitForTimeout(120);
}

function report(name: string, runs: number, results: Finding[], errors: string[]) {
  const { byCls, lines } = summarize(results);
  console.log(`${name}: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

test.describe('material layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo / mocked spec');
  test.describe.configure({ timeout: 40 * 60_000 });
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.devices.treeCollapsed');
        localStorage.removeItem('sw.devices.layout');
      } catch {
        /* storage unavailable */
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const perf of PERFS) test(`home, area and the demo page under every preset at depth / tint strong [${perf}]`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await installBubbleMock(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const [hash, outer, inner] of [['/devices/building', 'devices-building', 'section.fcard'], ['/devices/areas/living', 'devices-area', '[data-bubble-grid] sw-pill'], ['/styleguide/bubble', 'bubble-demo', '[data-demo-grid] sw-pill']] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, hash, theme, outer, inner);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          for (const c of combos(perf)) {
            await setLook(page, c);
            await scrollMain(page, 'top');
            runs++;
            await check(page, results, `${outer} ${theme} ${w} ${JSON.stringify(c)}`, [outer]);
            await scrollMain(page, 'bottom');
            await check(page, results, `${outer} ${theme} ${w} ${JSON.stringify(c)} bottom`, [outer]);
          }
        }
      }
    }
    report(`layout-material (home + area + demo) [${perf}]`, runs, results, errors);
  });

  test('the home under every ready palette, frosted and neon, light and dark, phone and desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await installBubbleMock(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const pal of PALETTES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, '/devices/building', theme, 'devices-building', 'section.fcard', `&look=palette:${pal}`);
        await expect(page.locator('html')).toHaveAttribute('data-bubble-palette', pal);
        for (const w of [390, 1440]) {
          await page.setViewportSize({ width: w, height: height(w) });
          for (const material of ['frosted', 'neon'] as const) {
            const c = { material, depth: 2, tint: 2, surface: 'glass', performance: 'full' };
            await setLook(page, c);
            await scrollMain(page, 'top');
            runs++;
            await check(page, results, `home ${pal} ${theme} ${w} ${JSON.stringify(c)}`, ['devices-building']);
            await scrollMain(page, 'bottom');
            await check(page, results, `home ${pal} ${theme} ${w} ${JSON.stringify(c)} bottom`, ['devices-building']);
          }
        }
      }
    }
    report('layout-material (palettes)', runs, results, errors);
  });
});
