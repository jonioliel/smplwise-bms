import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installBubbleMock } from './bubble-mocks';

// Bubble phase C (owner 2026-10-02): the layout guard (tests/layout-guard.ts) over the REAL screens in the bubble skin - the home
// (the mocked tree: three floors, eleven areas), the area (the mocked room with every card and control kind, its device sheets
// open: a light, the air conditioner, a cover with a tilt), the players page (the static demo's mock, the now-playing hero, the
// volume morph) and the screens page - across widths 320..1440 x density x surface x scheme, plus the soft / square radii and the
// 32 px desktop touch dial. FAILS on escape / overflow / floating / clipped / target.
// Needs the Vite DEV server (the dials are set through /src/design/look.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5215      then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/layout-bubble-screens.spec.ts --project=desktop --workers=1
//   LAYOUT_QUICK=1 sweeps four widths and the fill surface only.
const LOOK_URL = '/src/design/look.ts';
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const DENSITIES = ['wide', 'regular', 'compact', 'row'] as const;
const SURFACES = QUICK ? (['fill'] as const) : (['fill', 'glass'] as const);
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

// decorative layers and the shell's own items the guard must not measure
const SKIP = '.vh, .gbox, .bg, .veil, .edit-slot, .skl, .lay-rz, .wx-ic, .wx-fc svg, .fc';
// the bubbles of the real screens beyond the shared set
const BUBBLE = '.arow, a.tile, .wg, .pcard, .hero, sw-kpi, .bsep, .rc, .scard, .msens, .sec-strip, .sec-chip, .bbtn, .target, .bmore, .floorbtn, .search, .qsb, .qbtn, .mchip, .k, .vb, .rb, .pk, .pw, .rbtn, .cov';

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

/** Opens a route and waits for `inner` inside the screen `outer` (both inside sw-app's shadow root). */
async function open(page: Page, hash: string, theme: string, outer: string, inner: string, view?: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble&scheme=${theme}#${hash}`);
  if (view) {
    await page.evaluate((v) => localStorage.setItem('sw.devices.layout', v), view);
    await page.reload();
  }
  await page.waitForSelector('sw-app');
  await page.waitForFunction(([o, i]) => !!document.querySelector('sw-app')?.shadowRoot?.querySelector(o)?.shadowRoot?.querySelector(i), [outer, inner] as const, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

function combos(w: number): Record<string, string | number>[] {
  const out: Record<string, string | number>[] = [];
  for (const density of DENSITIES) for (const surface of SURFACES) out.push({ density, surface, radius: 'pill', touch: 44 });
  if (!QUICK) out.push({ density: 'regular', surface: 'gradient', radius: 'pill', touch: 44 }, { density: 'regular', surface: 'flat', radius: 'pill', touch: 44 });
  out.push({ density: 'regular', surface: 'fill', radius: 'soft', touch: 44 }, { density: 'regular', surface: 'fill', radius: 'square', touch: 44 });
  if (w > 1100) out.push({ density: 'compact', surface: 'fill', radius: 'pill', touch: 32 });
  return out;
}

async function check(page: Page, results: Finding[], ctx: string, roots: string[]) {
  await settle(page);
  results.push(...(await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, roots })));
}

/** Scrolls the shell's main column to the bottom (the screens are long): the guard sees the second half too. */
async function scrollMain(page: Page, to: 'top' | 'bottom') {
  await page.evaluate((t) => {
    const m = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    if (m) m.scrollTop = t === 'top' ? 0 : m.scrollHeight;
    for (const el of document.querySelector('sw-app')?.shadowRoot?.querySelectorAll('multimedia-players, multimedia-screens') ?? []) (el as HTMLElement).scrollTop = t === 'top' ? 0 : (el as HTMLElement).scrollHeight;
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

test.describe('bubble layout guard: the real screens', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo / mocked spec');
  test.describe.configure({ timeout: 40 * 60_000 });
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.devices.treeCollapsed');
      } catch {
        /* storage unavailable */
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('home and area (mocked backend): pills, separators, the tree, the device sheets', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await installBubbleMock(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      // the home: the cards view and the tiles view
      for (const view of ['cards', 'tiles'] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, '/devices/building', theme, 'devices-building', view === 'cards' ? 'section.fcard' : 'section.floor', view);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          for (const c of combos(w)) {
            await setLook(page, c);
            await scrollMain(page, 'top');
            runs++;
            await check(page, results, `home-${view} ${theme} ${w} ${JSON.stringify(c)}`, ['devices-building']);
            await scrollMain(page, 'bottom');
            await check(page, results, `home-${view} ${theme} ${w} ${JSON.stringify(c)} bottom`, ['devices-building']);
          }
        }
      }
      // the area: the page, then each sheet
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, '/devices/areas/living', theme, 'devices-area', '[data-bubble-grid] sw-pill');
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        for (const c of combos(w)) {
          await setLook(page, c);
          await scrollMain(page, 'top');
          runs++;
          await check(page, results, `area ${theme} ${w} ${JSON.stringify(c)}`, ['devices-area']);
          await scrollMain(page, 'bottom');
          await check(page, results, `area ${theme} ${w} ${JSON.stringify(c)} bottom`, ['devices-area']);
          if (c.surface === 'fill' && c.radius === 'pill') {
            for (const kind of c.touch === 32 ? (['sheet'] as const) : (['sheet', 'centred'] as const)) {
              await setLook(page, { ...c, popup: kind });
              for (const id of ['light.living_main', 'climate.living_ac', 'cover.living_balcony']) {
                await page.locator('sw-app devices-area').evaluate((el, eid) => {
                  (el as unknown as { sheet: { id: string; card: string } | null }).sheet = { id: eid, card: eid.startsWith('light') ? 'lighting' : eid.startsWith('climate') ? 'climate' : 'covers' };
                }, id);
                await page.waitForTimeout(120);
                runs++;
                await check(page, results, `area ${theme} ${w} ${JSON.stringify({ ...c, popup: kind })} sheet:${id}`, ['devices-area']);
              }
              await page.locator('sw-app devices-area').evaluate((el) => {
                (el as unknown as { sheet: unknown }).sheet = null;
              });
              await page.waitForTimeout(80);
            }
          }
        }
      }
    }
    report('layout-bubble-screens (home + area)', runs, results, errors);
  });

  test('players and screens (the static demo): the hero, the pill rows, the volume morph', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const screen of ['players', 'screens'] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, `/multimedia/${screen}`, theme, `multimedia-${screen}`, screen === 'players' ? 'media-player-card' : 'media-screen-card');
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          for (const c of combos(w)) {
            await setLook(page, c);
            await scrollMain(page, 'top');
            runs++;
            await check(page, results, `${screen} ${theme} ${w} ${JSON.stringify(c)}`, [`multimedia-${screen}`]);
            await scrollMain(page, 'bottom');
            await check(page, results, `${screen} ${theme} ${w} ${JSON.stringify(c)} bottom`, [`multimedia-${screen}`]);
            if (screen === 'players' && c.surface === 'fill' && c.radius === 'pill') {
              await scrollMain(page, 'top');
              const vb = page.locator('sw-app multimedia-players media-player-card .vb').first();
              if (await vb.count()) {
                await vb.evaluate((el) => (el as HTMLElement).click());
                await page.waitForTimeout(120);
                runs++;
                await check(page, results, `${screen} ${theme} ${w} ${JSON.stringify(c)} morph`, [`multimedia-${screen}`]);
                const close = page.locator('sw-app multimedia-players media-player-card [data-volume-close]').first();
                if (await close.count()) await close.evaluate((el) => (el as HTMLElement).click());
              }
            }
          }
        }
      }
    }
    report('layout-bubble-screens (players + screens)', runs, results, errors);
  });
});
