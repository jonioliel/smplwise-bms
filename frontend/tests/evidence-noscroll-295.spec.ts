import { test, expect, type Page } from '@playwright/test';

// NOSCROLL-295 (owner rule 2026-10-24: control screens never scroll; they fit the viewport): the paged list views that take no more
// items a page than fit the screen's height (FIX2200's fit-to-height mechanism, api/screen-display.ts measureFitItems; the page size
// setting stays the maximum) - the schedules rows / table / cards views, the automations rows / cards views and the scripts - at the
// reference 1366x768, 1440x900, a 1180x820 landscape tablet and a 390x844 phone. Demo mode (every /api/v1 call is aborted).
// The audit table (every screen, before / after) is docs/changes/NOSCROLL-295.md.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-noscroll-295.spec.ts --project=desktop

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1180x820', width: 1180, height: 820 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const SCHED = { 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }) };
interface Case {
  id: string;
  hash: string;
  query?: string;
  init?: Record<string, string>;
  segment?: string;
  /** the items of the list (to know it has drawn) */
  items: string;
}
const CASES: Case[] = [
  { id: 'schedules-rows', hash: '/devices/schedules', init: SCHED, items: '[data-sched-rows] [data-schedule]' },
  { id: 'schedules-table', hash: '/devices/schedules', query: '&sched_view=table', init: SCHED, items: '[data-sched-table] [data-schedule]' },
  { id: 'schedules-cards', hash: '/devices/schedules', query: '&sched_view=cards', init: SCHED, items: '[data-sched-grid] [data-schedule]' },
  { id: 'automations-rows', hash: '/devices/automations', init: { 'sw.automations.view': 'rows' }, items: '[data-auto-rows] automation-row' },
  { id: 'automations-cards', hash: '/devices/automations', init: { 'sw.automations.view': 'cards' }, items: '[data-auto-grid] automation-card' },
  { id: 'scripts', hash: '/devices/automations', segment: 'scripts', items: 'scripts-panel [data-scripts-panel] > *' },
];

const ready = new WeakSet<Page>();
async function open(page: Page, c: Case) {
  if (!ready.has(page)) {
    ready.add(page);
    await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
    await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
  }
  await page.addInitScript((kv) => {
    try {
      localStorage.clear();
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  }, c.init ?? {});
  await page.goto('about:blank');
  await page.goto(`/?design=a${c.query ?? ''}#${c.hash}`);
  await page.waitForSelector('sw-app');
  if (c.segment) await page.locator(`sw-app button[data-segment="${c.segment}"]`).first().click();
  await page.locator(`sw-app ${c.items}`).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** The vertical overflow of everything that could scroll the screen: the document, the shell's main area, the screen's wrapper and the screen. */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS') : null;
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const se = document.scrollingElement;
    return { doc: over(se), main: over(main), wrap: screen && screen.parentElement !== main ? over(screen.parentElement) : 0, screen: over(screen), tag: screen?.tagName.toLowerCase() ?? '' };
  });

test.describe('control screens fit the viewport: the paged lists take no more than fit (NOSCROLL-295)', () => {
  for (const vp of VIEWPORTS) {
    for (const c of CASES) {
      test(`${c.id} at ${vp.name} does not scroll vertically`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await open(page, c);
        // the fit is measured after the first draw: wait for it to settle (the count stops changing)
        const items = page.locator(`sw-app ${c.items}`);
        await expect.poll(async () => { const a = await items.count(); await page.waitForTimeout(250); return a === (await items.count()); }).toBe(true);
        await expect.poll(async () => { const o = await overflow(page); return Math.max(o.doc, o.main, o.wrap, o.screen); }, { message: `vertical overflow of ${c.id} at ${vp.name}` }).toBeLessThanOrEqual(1);
        expect(await items.count()).toBeGreaterThan(0);
      });
    }
  }

  test('the page size setting stays the maximum: a 1440x900 desktop keeps 10 schedules / 12 automations a page when they fit', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough');
    await page.setViewportSize({ width: 1440, height: 2000 });
    await open(page, CASES[0]);
    await expect.poll(() => page.locator(`sw-app ${CASES[0].items}`).count()).toBe(10);
    await open(page, CASES[3]);
    await expect.poll(() => page.locator(`sw-app ${CASES[3].items}`).count()).toBe(12);
  });
});
