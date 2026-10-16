import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installRfqMock, RFQ7 } from './tickets-rfq-mocks';

// RFQMOBILEFIX: the floating approve bar of the manager's comparison / award board on a phone (375x812, 390x844, light / dark, he).
// The bar is sticky inside the shell's scrolling <main>; the phone's bottom dock is a separate grid row below <main>. Guards:
//   - the bar sits at the bottom edge of the scroller (just above the dock) - not floating a dock-height higher over the content
//   - while nothing is picked the bar is compact (one line, button + hint) and takes a small share of the screen
//   - scrolled to the end, the last row of the table is not covered by the bar
//   - every quote's pick control can be scrolled into view, is a 44 px target and is not under the bar or the dock
//   - picking quotes enables the approve button; the confirm dialog opens; with two quotes it is the split-by-line flow
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-rfq-bar.spec.ts --project=mobile --workers=1
const C = 'sw-app tickets-rfqs tickets-rfq-compare';
const SIZES = [{ width: 375, height: 812 }, { width: 390, height: 844 }];
const THEMES = ['light', 'dark'] as const;

test.use({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });

async function open(page: Page, theme: 'light' | 'dark', size: { width: number; height: number }): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installRfqMock(page);
  await page.setViewportSize(size);
  await page.goto('about:blank');
  await page.goto(url(`/tickets/rfqs?rfq=${RFQ7}&view=compare`, 'classic', theme));
  await page.waitForSelector(`${C} [data-phase="ready"] [data-cmp-bar]`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

interface Geo {
  bar: { top: number; bottom: number; height: number } | null;
  main: { top: number; bottom: number } | null;
  dock: { top: number } | null;
  vh: number;
  lastRow: { bottom: number } | null;
  picks: { id: string; top: number; bottom: number; h: number; covered: boolean }[];
}

/** Measured inside the page: the bar, the scroller (<main>), the dock, the last table row and every pick control (through shadow roots). */
function geometry(page: Page, scrollToEnd: boolean): Promise<Geo> {
  return page.evaluate(async (toEnd) => {
    const app = document.querySelector('sw-app')?.shadowRoot;
    const cmp = app?.querySelector('tickets-rfqs')?.shadowRoot?.querySelector('tickets-rfq-compare')?.shadowRoot;
    const main = app?.querySelector('main') as HTMLElement | null;
    const bar = cmp?.querySelector('[data-cmp-bar]') as HTMLElement | null;
    const dock = app?.querySelector('nav.bottom') as HTMLElement | null;
    const scroller = app?.querySelector('tickets-rfqs') as HTMLElement | null;
    if (toEnd && scroller) { scroller.scrollTop = scroller.scrollHeight; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
    const rect = (e: Element | null | undefined) => e?.getBoundingClientRect() ?? null;
    const b = rect(bar);
    const m = rect(main);
    const d = rect(dock);
    const rows = Array.from(cmp?.querySelectorAll('[data-cmp-table] tbody tr') ?? []);
    const lr = rect(rows[rows.length - 1]);
    const picks = Array.from(cmp?.querySelectorAll('[data-cmp-pick]') ?? []).map((el) => {
      (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'nearest' });
      const label = (el.closest('label') ?? el) as HTMLElement;
      const r = label.getBoundingClientRect();
      const bb = bar?.getBoundingClientRect();
      const covered = !!bb && r.bottom > bb.top + 1 && r.top < bb.bottom - 1;
      return { id: el.getAttribute('data-cmp-pick') ?? '', top: r.top, bottom: r.bottom, h: r.height, covered };
    });
    return {
      bar: b && { top: b.top, bottom: b.bottom, height: b.height },
      main: m && { top: m.top, bottom: m.bottom },
      dock: d && { top: d.top },
      vh: innerHeight,
      lastRow: lr && { bottom: lr.bottom },
      picks,
    };
  }, scrollToEnd);
}

for (const size of SIZES) {
  for (const theme of THEMES) {
    test.describe(`approve bar ${size.width}x${size.height} ${theme}`, () => {
      test.beforeEach(async ({ page }, info) => {
        test.skip(info.project.name !== 'mobile', 'the phone only');
        test.setTimeout(120_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
      });

      test('the bar hugs the scroller bottom, is compact with a hint, and hides no row or pick control', async ({ page }) => {
        await open(page, theme, size);
        const first = await geometry(page, false);
        expect(first.picks.length, 'needs at least 3 quotes').toBeGreaterThanOrEqual(3);
        expect(first.bar && first.main, 'bar and scroller exist').toBeTruthy();
        // positioned above the dock: the dock is a row below <main>, so the bar must end at <main>'s bottom edge (small gap only)
        expect(first.bar!.bottom, 'bar bottom inside the scroller').toBeLessThanOrEqual(first.main!.bottom + 0.5);
        expect(first.main!.bottom - first.bar!.bottom, 'bar floats above the scroller bottom (double dock offset)').toBeLessThanOrEqual(20);
        if (first.dock) expect(first.bar!.bottom, 'bar overlaps the dock').toBeLessThanOrEqual(first.dock.top + 0.5);
        // compact while it only shows a hint
        expect(first.bar!.height, 'hint-only bar is compact').toBeLessThanOrEqual(76);
        expect(first.bar!.height / size.height, 'bar share of the screen').toBeLessThan(0.1);

        const end = await geometry(page, true);
        expect(end.lastRow!.bottom, 'last row covered by the bar at the end of the scroll').toBeLessThanOrEqual(end.bar!.top + 1);
        for (const p of end.picks) {
          expect(p.h, `pick ${p.id} target`).toBeGreaterThanOrEqual(43.5);
        }
        // each pick control, scrolled to the middle of the scroller, is not under the bar
        const mid = await geometry(page, false);
        for (const p of mid.picks) expect(p.covered, `pick ${p.id} is under the bar`).toBe(false);
      });

      test('picking quotes enables approve; two quotes open the split flow', async ({ page }) => {
        await open(page, theme, size);
        const approve = page.locator(`${C} [data-cmp-approve]`);
        await expect(approve).toBeDisabled();
        const picks = page.locator(`${C} [data-cmp-pick]`);
        const n = await picks.count();
        expect(n).toBeGreaterThanOrEqual(3);
        await picks.nth(0).scrollIntoViewIfNeeded();
        await picks.nth(0).check();
        await expect(approve).toBeEnabled();
        // the bar with a selection (summary lines) must still leave every pick reachable
        const g = await geometry(page, false);
        for (const p of g.picks) expect(p.covered, `pick ${p.id} is under the bar with a selection`).toBe(false);
        const box = await approve.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(43.5);
        await picks.nth(1).scrollIntoViewIfNeeded();
        await picks.nth(1).check();
        await expect(approve).toBeEnabled();
        await expect(page.locator(`${C} [data-cmp-scope]`)).toHaveCount(2);
        // split by line: the first picked quote with more than one line
        const lines = page.locator(`${C} [data-cmp-scope] [data-scope="lines"]`).first();
        if (await lines.count()) {
          await lines.scrollIntoViewIfNeeded();
          await lines.click();
          await expect(approve).toBeEnabled();
        }
        await approve.scrollIntoViewIfNeeded();
        await approve.click();
        await expect(page.locator(`${C} [data-cmp-confirm-item]`)).toHaveCount(2);
        await expect(page.locator(`${C} [data-cmp-confirm-ok]`)).toBeVisible();
      });
    });
  }
}
