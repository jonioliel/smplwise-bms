import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { setLook } from './bubble-chrome-screens';

// Owner 2026-10-04: the schedules screen is designed exactly like the automations and scenes screens (docs/design/schedules-parity.md).
// The layout guard (tests/layout-guard.ts) over every state of it - the list as cards, table and week, "סינון" open, the drawer,
// the trash, the review list and the editor - in demo mode (every /api/v1 call is aborted):
//   1. the bubble skin, all five classes (escape / overflow / floating / clipped / target) across widths x light / dark, the dials at
//      the defaults (the same contract as layout-bubble-lists.spec.ts, which covers the automations screen);
//   2. the classic, domus and tesla skins, the four geometry classes (escape / overflow / floating / clipped) at a phone, a tablet
//      and a desktop width. `target` is the bubble dial's contract: in the glass material a mouse layout keeps the automations
//      screen's 32-38 px controls and every touch layout grows them to 44 px (styles/media-glass.ts), so the classic skins are
//      checked for 44 px at the phone width only.
// Needs the Vite DEV server (the dials are set through /src/design/look.ts):
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/layout-schedules-parity.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const BUBBLE_WIDTHS = QUICK ? [390, 1440] : [320, 390, 600, 768, 1024, 1440];
const OTHER_WIDTHS = QUICK ? [390, 1440] : [390, 820, 1440];
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

// as layout-bubble-lists.spec.ts: the switch (its 44 px hit area is a ::before), native checkboxes and radios (their label is the
// target), the card title links (the card is the target), visually hidden text and decorative layers; the schedule bar and the
// week grid are drawings (sw-schedule-bar / sw-schedule-grid / schedules-week-view keep their own contracts)
const SKIP = ".tog, .tgl, [role='switch'], input[type='checkbox'], input[type='radio'], a.name, .sr-only, .vh, .skl, sw-schedule-bar, sw-schedule-grid, schedules-week-view, sw-day-chips";
const BUBBLE = '.acard, .scard, .kseg, .upnext, .li, .editbar, .statebox, .banner';

interface Case {
  id: string;
  hash: string;
  /** after the route has drawn: open something */
  prep?: (page: Page) => Promise<void>;
  /** the drawer is a modal layer over the list: what lies under it is not a "floating" finding */
  modal?: boolean;
}

const scr = (page: Page) => page.locator('sw-app devices-schedules');

const CASES: Case[] = [
  { id: 'cards', hash: '/devices/schedules' },
  { id: 'table', hash: '/devices/schedules?view=table' },
  { id: 'week', hash: '/devices/schedules?view=week' },
  {
    id: 'filters',
    hash: '/devices/schedules',
    prep: async (page) => {
      await scr(page).locator('[data-filters-toggle]').click();
      await expect(scr(page).locator('[data-sched-filters]')).toBeVisible();
    },
  },
  {
    id: 'menu',
    hash: '/devices/schedules',
    prep: async (page) => {
      await scr(page).locator('article.acard').first().locator('[data-card-menu]').click();
      await expect(scr(page).locator('article.acard [role="menu"]')).toBeVisible();
    },
  },
  { id: 'drawer', hash: '/devices/schedules/4d6e0a', modal: true },
  { id: 'trash', hash: '/devices/schedules/trash' },
  { id: 'review', hash: '/devices/schedules/review' },
  { id: 'empty', hash: '/devices/schedules' },
  { id: 'editor', hash: '/devices/schedules/4d6e0a/edit' },
];

async function openCase(page: Page, c: Case, skin: string, theme: string, empty = false) {
  await page.addInitScript((e) => {
    try {
      localStorage.removeItem('sw.ui.look');
      localStorage.removeItem('sw.schedules.view');
      localStorage.removeItem('sw.schedules.filters');
      localStorage.setItem('sw.demo.schedules', JSON.stringify(e ? { empty: true } : {}));
    } catch {
      /* storage unavailable */
    }
  }, empty);
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#${c.hash}`);
  await page.waitForSelector('sw-app');
  const outer = c.id === 'editor' ? 'schedule-editor' : 'devices-schedules';
  await page.waitForFunction((o) => {
    const el = document.querySelector('sw-app')?.shadowRoot?.querySelector(o);
    return !!el && !!el.shadowRoot && el.shadowRoot.childElementCount > 0;
  }, outer, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scrollScreen(page: Page, to: 'top' | 'bottom') {
  await page.evaluate((t) => {
    const app = document.querySelector('sw-app')?.shadowRoot;
    for (const el of [app?.querySelector('main'), app?.querySelector('devices-schedules'), app?.querySelector('schedule-editor')]) {
      if (el) (el as HTMLElement).scrollTop = t === 'top' ? 0 : (el as HTMLElement).scrollHeight;
    }
  }, to);
  await page.waitForTimeout(150);
}

async function check(page: Page, results: Finding[], ctx: string, c: Case, classes: Finding['cls'][]) {
  await settle(page);
  const found = await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, roots: [c.id === 'editor' ? 'schedule-editor' : 'devices-schedules'] });
  results.push(...found.filter((f) => classes.includes(f.cls) && !(c.modal && f.cls === 'floating')));
}

function report(name: string, runs: number, results: Finding[], errors: string[]) {
  const { byCls, lines } = summarize(results);
  console.log(`${name}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

test.describe('layout guard: the schedules screen in the automations screen\'s design', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo spec');
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('bubble skin: every state, every class, light and dark', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of ['light', 'dark']) {
      for (const c of CASES) {
        for (const w of BUBBLE_WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await openCase(page, c, 'bubble', theme, c.id === 'empty');
          await setLook(page, { density: 'regular', surface: 'fill', radius: 'pill', touch: 44, performance: 'full' });
          await scrollScreen(page, 'top');
          if (c.prep) await c.prep(page);
          runs++;
          await check(page, results, `${c.id} bubble ${theme} ${w}`, c, ['escape', 'overflow', 'floating', 'clipped', 'target']);
          if (!c.prep && !c.modal && c.id !== 'empty') {
            await scrollScreen(page, 'bottom');
            await check(page, results, `${c.id} bubble ${theme} ${w} bottom`, c, ['escape', 'overflow', 'floating', 'clipped', 'target']);
          }
        }
      }
    }
    report('layout-schedules-parity (bubble)', runs, results, errors);
  });

  for (const skin of ['classic', 'domus', 'tesla']) test(`${skin} skin: every state, the geometry classes (44 px targets at the phone width)`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of ['light', 'dark']) {
      for (const c of CASES) {
        for (const w of OTHER_WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await openCase(page, c, skin, theme, c.id === 'empty');
          await scrollScreen(page, 'top');
          if (c.prep) await c.prep(page);
          runs++;
          const classes: Finding['cls'][] = w <= 480 && c.id !== 'editor' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'floating', 'clipped'];
          await check(page, results, `${c.id} ${skin} ${theme} ${w}`, c, classes);
        }
      }
    }
    report(`layout-schedules-parity (${skin})`, runs, results, errors);
  });
});
