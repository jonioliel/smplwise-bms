import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { CHROME_SCREENS, openChrome, setLook } from './bubble-chrome-screens';

// 0.1.157 (TASK_QUEUE item 4): the layout guard (tests/layout-guard.ts) over the screens that got the bubble CHROME - the security
// area (live overview, wall, saved views, events, cases, rules, exports, the alarm), the device lists (catalogue, cameras, schedules),
// the automations lists (קברניט) and the settings screens - in the demo mode (no backend answers; every /api/v1 call is aborted),
// across widths x density x radius x scheme x the 32 px desktop touch dial. Video, map, 3D, timeline and the dense tables are not
// redesigned, so their internals are skipped; the chrome around them must pass: FAILS on escape / overflow / floating / clipped / target.
// Needs the Vite DEV server (the dials are set through /src/design/look.ts):
//   npx vite --host 127.0.0.1 --port 5215      then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/layout-bubble-lists.spec.ts --project=desktop --workers=1
//   LAYOUT_QUICK=1 sweeps four widths; LAYOUT_SCREENS=live,alarm,... limits the screens (ids below).
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

// the internals the chrome work leaves alone (video, map, 3D, timeline, players, thumbnails) and decorative layers
// also skipped, with the reason: the glass switch `.tog` (its 44 px hit area is a ::before the guard cannot measure), native checkboxes
// and radios (their label is the target), inline text links inside a sentence or a table cell (never a 44 px block), and the
// notifications' section rail `.setnav` (a scrolling column of its own), the product's switches (`[role='switch']`, `.tgl`: a 42 x 24 /
// 46 x 28 drawing with a larger hit area - the shared toggle contract, not this task's), the card title links `a.name` (the card
// is the target) and visually hidden text (`.sr-only`, clipped by design). Every skipped kind is listed in the task report as open.
const SKIP = "sw-plan-canvas, sw-timeline, sw-live-player, sw-camera-tile, sw-scene, video, canvas, .video, .player, .stage, .grid .tile, .thumb, .pv-bg, .skl, .vh, .bg, .veil, .preview, .lphone, .pushcard, .escprev, .sw-prev, .mini-rail, .mini-bar, .tog, .tgl, [role='switch'], input[type='checkbox'], input[type='radio'], td a, li a, p a, span a, small a, .muted a, a.name, .sr-only, .setnav";
// the bubbles of the chrome beyond the shared set (nothing may leave them)
const BUBBLE = '.layouts, .rangepick, .transport, .kseg, .switcher, .pages, .range, .sevseg, .wrow, .item, .hcard, .zone, .kpi, nav.sections, .acard, .scard, .pcard';

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

function combos(w: number): Record<string, string | number>[] {
  const out: Record<string, string | number>[] = [
    { density: 'regular', surface: 'fill', radius: 'pill', touch: 44 },
    { density: 'row', surface: 'fill', radius: 'pill', touch: 44 },
    { density: 'regular', surface: 'fill', radius: 'soft', touch: 44 },
  ];
  if (!QUICK) out.push({ density: 'compact', surface: 'glass', radius: 'square', touch: 44 });
  if (w > 1100) out.push({ density: 'compact', surface: 'fill', radius: 'pill', touch: 32 });
  return out.map((c) => ({ ...c, performance: 'full' }));
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

const WANTED = process.env.LAYOUT_SCREENS ? new Set(process.env.LAYOUT_SCREENS.split(',')) : null;

test.describe('bubble layout guard: the chrome screens (security, lists, settings)', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo spec');
  test.describe.configure({ timeout: 40 * 60_000 });
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.demo.automations');
      } catch {
        /* storage unavailable */
      }
    });
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const group of ['security', 'devices', 'automations', 'settings'] as const) test(`${group}: the chrome in the bubble skin`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const screens = CHROME_SCREENS.filter((s) => s.group === group && (!WANTED || WANTED.has(s.id)));
    test.skip(!screens.length, 'no screen selected');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      for (const s of screens) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openChrome(page, s, theme);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          for (const c of combos(w)) {
            await setLook(page, c);
            await scrollMain(page, 'top');
            runs++;
            await check(page, results, `${s.id} ${theme} ${w} ${JSON.stringify(c)}`, [s.outer]);
            await scrollMain(page, 'bottom');
            await check(page, results, `${s.id} ${theme} ${w} ${JSON.stringify(c)} bottom`, [s.outer]);
          }
        }
      }
    }
    report(`layout-bubble-lists (${group})`, runs, results, errors);
  });
});
