import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installBv1Mock, bv1Config, BV1_NOW, BV1_PERMS } from './bv1-mocks';

// BV1 (2026-10-05): the layout guard (tests/layout-guard.ts) over the home screen with the new widgets - the clock and weather TILES,
// the agenda and the launcher grid - in the FOUR skins (classic, domus, tesla, bubble) x light / dark x 10 widths (320 .. 1440);
// in bubble also the surfaces fill / glass / none, both tile styles (card / tile), the row density, and the area's device sheet with
// the VERTICAL sliders (light: brightness; cover: position + tilt; fan). FAILS on escape / overflow / floating / clipped / target.
// Needs the Vite DEV server (the dials go through /src/design/look.ts):
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-bv1-tiles.spec.ts --project=desktop --workers=1
//   LAYOUT_QUICK=1 sweeps four widths.
const LOOK_URL = '/src/design/look.ts';
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

const SKIP = '.vh, .gbox, .bg, .veil, .edit-slot, .skl, .lay-rz, .wx-ic, .wx-fc svg, .fc, .t-ic, .t-facts svg, .ag-x svg';
// the bubbles of the home and the sheet beyond the shared set: the widgets, the tiles' chips, the agenda rows, the launcher rings, the vertical sliders
const BUBBLE = '.arow, a.tile, .wg, sw-kpi, .bsep, .qsb, .qbtn, .mchip, .t-chip, .ag-ev, .lb, .lr, sw-vslider, .bbtn, .target, .floorbtn, .search';

async function setLook(page: Page, look: Record<string, string | number>) {
  await page.evaluate(
    async ([url, l]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnLook(l);
    },
    [LOOK_URL, look] as const,
  );
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(page: Page, hash: string, skin: string, theme: string, outer: string, inner: string) {
  await page.clock.setFixedTime(new Date(BV1_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(([o, i]) => !!document.querySelector('sw-app')?.shadowRoot?.querySelector(o)?.shadowRoot?.querySelector(i), [outer, inner] as const, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** `within` narrows the measured subtree (the other skins' own chrome - 26 px tree buttons, 30 px chips - is theirs, not BV1's); `classes` keeps only those finding classes. */
async function check(page: Page, results: Finding[], ctx: string, roots: string[], within?: string, classes?: Finding['cls'][], skipMore = '') {
  await settle(page);
  const found = await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP + (skipMore ? ', ' + skipMore : ''), roots, within });
  results.push(...(classes ? found.filter((f) => classes.includes(f.cls)) : found));
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

test.describe('BV1 layout guard: the tiles, the agenda, the launcher, the vertical sliders', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked spec');
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

  test('the home with the new widgets: four skins x light / dark x the widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await installBv1Mock(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const skin of SKINS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, '/devices/building', skin, theme, 'devices-building', 'home-widgets');
        // the four widgets are drawn (the launcher and the agenda in every skin; the tiles in bubble, the cards elsewhere)
        await expect(page.locator('sw-app devices-building home-widgets [data-home-widget="agenda"]')).toBeVisible();
        await expect(page.locator('sw-app devices-building home-widgets [data-home-widget="launcher"]')).toBeVisible();
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          const combos: Record<string, string | number>[] = skin === 'bubble'
            ? [{ surface: 'fill' }, { surface: 'glass' }, { surface: 'none' }, { surface: 'fill', density: 'row' }, ...(QUICK ? [] : [{ surface: 'gradient' }, { surface: 'fill', density: 'compact', touch: w > 1100 ? 32 : 44 }])]
            : [{ surface: 'fill' }];
          for (const c of combos) {
            await setLook(page, { density: 'regular', surface: 'fill', radius: 'pill', touch: 44, performance: 'full', ...c });
            await scrollMain(page, 'top');
            runs++;
            // bubble: the whole home (its chrome follows the touch dial); the other skins: the widgets only (their chrome keeps its own sizes)
            // (the 38 px quick-action buttons of those skins' quick widget predate BV1 and are not measured; bubble draws pills there)
            const within = skin === 'bubble' ? undefined : 'home-widgets';
            const skipMore = skin === 'bubble' ? '' : '.qbtn';
            await check(page, results, `home ${skin} ${theme} ${w} ${JSON.stringify(c)}`, ['devices-building'], within, undefined, skipMore);
            await scrollMain(page, 'bottom');
            await check(page, results, `home ${skin} ${theme} ${w} ${JSON.stringify(c)} bottom`, ['devices-building'], within, undefined, skipMore);
          }
        }
      }
    }
    report('layout-bv1-tiles (home, four skins)', runs, results, errors);
  });

  test('bubble: the card style of the clock / weather next to the tiles, and the edit mode with the new bodies', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await installBv1Mock(page, { config: bv1Config({ clockStyle: 'card', weatherStyle: 'card' }) });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, '/devices/building', 'bubble', theme, 'devices-building', 'home-widgets');
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await setLook(page, { density: 'regular', surface: 'fill', radius: 'pill', touch: 44, performance: 'full' });
        await scrollMain(page, 'top');
        runs++;
        await check(page, results, `home-cards bubble ${theme} ${w}`, ['devices-building']);
      }
      // edit mode (the desktop width): the panel with the agenda and launcher bodies open
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('about:blank');
      await page.goto(`/?design=a&skin=bubble&scheme=${theme}#/devices/building?edit=1`);
      await page.waitForSelector('sw-app');
      const panel = page.locator('sw-app devices-building home-edit-panel');
      await expect(panel).toBeVisible({ timeout: 20_000 });
      for (const id of ['agenda', 'launcher', 'clock']) {
        await panel.locator(`[data-home-wopen="${id}"]`).click();
        await expect(panel.locator(`[data-home-wbody="${id}"]`)).toBeVisible();
        runs++;
        // the open body only, without the target class: the edit panel's compact admin controls (30-32 px segments, inputs) are the panel's own design
        await check(page, results, `home-edit bubble ${theme} 1440 ${id}`, ['devices-building'], `[data-home-wbody="${id}"]`, ['escape', 'overflow', 'clipped', 'floating']);
        await panel.locator(`[data-home-wopen="${id}"]`).click();
      }
    }
    report('layout-bv1-tiles (bubble cards + edit)', runs, results, errors);
  });

  test('bubble: the device sheet with vertical sliders (light, cover with tilt, fan) x surfaces x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    // without media.read: the area then draws its media rows as plain pills (the multimedia card of the area is not a BV1 element; bubble-mocks leaves it out too)
    await installBv1Mock(page, { perms: BV1_PERMS.filter((p) => p !== 'media.read') });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, '/devices/areas/living', 'bubble', theme, 'devices-area', '[data-bubble-grid] sw-pill');
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        for (const surface of QUICK ? (['fill', 'none'] as const) : (['fill', 'glass', 'none'] as const)) {
          for (const popup of w <= 480 ? (['sheet'] as const) : (['sheet', 'centred'] as const)) {
            await setLook(page, { density: 'regular', surface, radius: 'pill', touch: 44, performance: 'full', slider: 'vertical', popup });
            for (const id of ['light.living_main', 'cover.living_balcony', 'fan.living_fan']) {
              await page.locator('sw-app devices-area').evaluate((el, eid) => {
                (el as unknown as { sheet: { id: string; card: string } | null }).sheet = { id: eid, card: eid.startsWith('light') ? 'lighting' : eid.startsWith('cover') ? 'covers' : 'climate' };
              }, id);
              await page.waitForTimeout(150);
              await expect(page.locator('sw-app devices-area sw-sheet[data-device-sheet] sw-vslider').first()).toBeVisible();
              runs++;
              await check(page, results, `sheet ${theme} ${w} ${surface} ${popup} ${id}`, ['devices-area']);
            }
            await page.locator('sw-app devices-area').evaluate((el) => {
              (el as unknown as { sheet: unknown }).sheet = null;
            });
            await page.waitForTimeout(80);
          }
        }
        // the surfaceless pills of the area itself, horizontal sliders back
        await setLook(page, { density: 'regular', surface: 'none', radius: 'pill', touch: 44, performance: 'full', slider: 'horizontal' });
        await scrollMain(page, 'top');
        runs++;
        await check(page, results, `area none ${theme} ${w}`, ['devices-area']);
        await scrollMain(page, 'bottom');
        await check(page, results, `area none ${theme} ${w} bottom`, ['devices-area']);
      }
    }
    report('layout-bv1-tiles (vertical sliders + surfaceless area)', runs, results, errors);
  });
});
