import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';
import { installTableMock } from './tickets-table-mocks';

// TICKETS-POLISH-2331 evidence: the request list (cards, table) and the manager board from the REAL build against the mock layer (fake
// data) at desktop 1440 / 1920, tablet 1024 / 1180 and phone 390. Each capture also MEASURES what the design audit of 27.10 (P1-4, P1-5)
// criticised: how far down the first request starts (the control stack above it), how many rows the toolbar takes, and whether the page
// itself scrolls on a desktop / tablet (owner rule: a control screen fits the viewport; the list scrolls inside its own panel).
//   SW_SHOT_TAG=after SW_BASE_URL=http://127.0.0.1:4200/ npx playwright test tests/evidence-tickets-polish-2331.spec.ts --workers=2
// Screenshots + metrics.json in docs/evidence/TICKETS-POLISH-2331/<tag>/ (tag: before | after; default after).
const TAG = process.env.SW_SHOT_TAG || 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../docs/evidence/TICKETS-POLISH-2331/${TAG}`);
const STRICT = TAG === 'after';
const L = 'sw-app tickets-list';
const B = 'sw-app tickets-board';

type Metrics = { firstItemTop: number; toolbarRows: number; pageScroll: number; viewport: string };

/** The extra widths each project also captures (desktop 1920, tablet 1180) besides its own. */
const SIZES: Record<string, Array<{ w: number; h: number }>> = {
  desktop: [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }],
  tablet: [{ w: 1024, h: 768 }, { w: 1180, h: 820 }],
  mobile: [{ w: 390, h: 844 }],
};

async function measure(page: Page, host: string, item: string, toolbar: string): Promise<Metrics> {
  return page.evaluate(({ host, item, toolbar }) => {
    const deep = (sel: string): Element | null => {
      const parts = sel.split(' ');
      let root: Element | ShadowRoot | Document = document;
      let el: Element | null = null;
      for (const p of parts) {
        el = (root as ParentNode).querySelector(p);
        if (!el) return null;
        root = el.shadowRoot ?? el;
      }
      return el;
    };
    const h = deep(host) as HTMLElement | null;
    const first = h?.shadowRoot?.querySelector(item) ?? h?.shadowRoot?.querySelector('tickets-table')?.shadowRoot?.querySelector(item) ?? null;
    const bar = h?.shadowRoot?.querySelector(toolbar) as HTMLElement | null;
    // the rows of the toolbar: its visible direct children grouped by their vertical centre (a child whose centre lies inside a row's band
    // belongs to that row; controls of different heights on one line are one row)
    const bands: Array<{ top: number; bottom: number }> = [];
    if (bar) for (const c of Array.from(bar.children) as HTMLElement[]) {
      const r = c.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(c).visibility === 'hidden') continue;
      const mid = r.top + r.height / 2;
      const band = bands.find((x) => mid >= x.top && mid <= x.bottom);
      if (band) { band.top = Math.min(band.top, r.top); band.bottom = Math.max(band.bottom, r.bottom); } else bands.push({ top: r.top, bottom: r.bottom });
    }
    // the page scroll: any scroller at or above the screen's host (the screen's own inner panel, below the host, does not count)
    let pageScroll = 0;
    for (let n: Node | null = h; n; n = (n as Element).parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null)) {
      if (!(n instanceof HTMLElement)) break;
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll' || n === document.scrollingElement) && n.scrollHeight - n.clientHeight > pageScroll) pageScroll = n.scrollHeight - n.clientHeight;
      if (n === document.documentElement) break;
    }
    return { firstItemTop: Math.round(first?.getBoundingClientRect().top ?? -1), toolbarRows: bands.length, pageScroll, viewport: `${innerWidth}x${innerHeight}` };
  }, { host, item, toolbar });
}

const metrics: Record<string, Metrics> = {};

async function shot(page: Page, name: string, m: Metrics): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  const vp = page.viewportSize();
  const file = `${name}-${vp?.width}x${vp?.height}.png`;
  metrics[file] = m;
  await page.screenshot({ path: path.join(OUT, file) });
}

test.describe('TICKETS-POLISH-2331 evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.afterAll(({}, info) => {
    // several workers write the same project's file: merge, sorted by name
    const f = path.join(OUT, `metrics-${info.project.name}.json`);
    const old = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, Metrics>) : {};
    const all = { ...old, ...metrics };
    fs.writeFileSync(f, JSON.stringify(Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]])), null, 2) + '\n');
  });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('list (cards): one compact toolbar, the first request high on the screen, no page scroll', async ({ page }, info) => {
    for (const s of SIZES[info.project.name]) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installTicketsMock(page, {});
      await page.goto('about:blank');
      await page.goto(url('/tickets/mine'));
      await page.waitForSelector(`${L} ticket-card:not([skeleton])`);
      const m = await measure(page, L, 'ticket-card', 'header [data-toolbar], header .dh-det');
      await shot(page, 'list-cards', m);
      if (STRICT) {
        if (s.w >= 768) expect(m.toolbarRows, 'the toolbar is one row on a desktop / tablet').toBeLessThanOrEqual(1);
        if (s.w >= 1024) expect(m.pageScroll, 'the page itself never scrolls').toBeLessThanOrEqual(1);
        // AUDIT30-C-TICKETS (#6): on a phone the sw-page frame puts its actions (view switch, "+") on a row under the title (+20 px);
        // branch B's floating primary action (B6) takes "+" out of that row again
        expect(m.firstItemTop, 'the first request starts high on the screen').toBeLessThan(s.w < 768 ? 400 : 260);
      }
    }
  });

  test('list (cards): the filter panel opens with the chips and the reset, chips stay after it closes', async ({ page }, info) => {
    const s = SIZES[info.project.name][0];
    await page.setViewportSize({ width: s.w, height: s.h });
    await installTicketsMock(page, {});
    await page.goto(url('/tickets/mine'));
    await page.waitForSelector(`${L} ticket-card:not([skeleton])`);
    await page.locator(`${L} [data-filter-toggle]`).click();
    await expect(page.locator(`${L} [data-filter-panel]`)).toBeVisible();
    await shot(page, 'list-filter-open', await measure(page, L, 'ticket-card', 'header [data-toolbar], header .dh-det'));
    if (!STRICT) return;
    // a state picked in the panel turns into a removable chip in the toolbar, and the reset clears it
    await page.locator(`${L} [data-filter-panel] [data-status-filter="all"]`).click();
    await page.keyboard.press('Escape');
    await expect(page.locator(`${L} [data-filter-panel]`)).toHaveCount(0);
    const chip = page.locator(`${L} [data-active-chips] [data-active-chip="status"]`);
    await expect(chip).toBeVisible();
    await shot(page, 'list-chips', await measure(page, L, 'ticket-card', 'header [data-toolbar]'));
    // a second filter (a department): two chips and one "איפוס" that clears both; a single chip is its own remove
    await page.locator(`${L} [data-filter-toggle]`).click();
    await page.locator(`${L} [data-filter-panel] [data-dept="dept-maintenance"]`).click();
    await page.locator(`${L} [data-filter-toggle]`).click();
    await expect(page.locator(`${L} [data-active-chips] [data-active-chip]`)).toHaveCount(2);
    await page.locator(`${L} [data-active-chips] [data-chips-reset]`).click();
    await expect(page.locator(`${L} [data-active-chips]`)).toHaveCount(0);
    await expect(page).not.toHaveURL(/status=|department=/);
    await page.locator(`${L} [data-filter-toggle]`).click();
    await page.locator(`${L} [data-filter-panel] [data-status-filter="closed"]`).click();
    await page.keyboard.press('Escape');
    await expect(page.locator(`${L} [data-filter-toggle]`)).toBeFocused(); // Escape returns the focus to "סינון"
    await page.locator(`${L} [data-active-chip="status"]`).click();
    await expect(chip).toHaveCount(0);
  });

  test('list (table): sticky header, rows scroll inside the panel', async ({ page }, info) => {
    for (const s of SIZES[info.project.name]) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installTableMock(page, { board: { view: 'table' } });
      await page.goto('about:blank');
      await page.goto(url('/tickets/mine'));
      await page.waitForSelector(`${L} tickets-table`);
      await page.waitForFunction(() => {
        const t = document.querySelector('sw-app')?.shadowRoot?.querySelector('tickets-list')?.shadowRoot?.querySelector('tickets-table');
        return !!t?.shadowRoot?.querySelector('[data-row]');
      });
      const m = await measure(page, L, '[data-row]', 'header [data-toolbar], header .dh-det');
      await shot(page, 'list-table', m);
      if (STRICT && s.w >= 1024) expect(m.pageScroll, 'the page itself never scrolls').toBeLessThanOrEqual(1);
    }
  });

  test('board: one compact toolbar, the board scrolls inside its panel', async ({ page }, info) => {
    for (const s of SIZES[info.project.name]) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installBoardMock(page, {});
      await page.goto('about:blank');
      await page.goto(url('/tickets/board'));
      await page.waitForSelector(`${B} ticket-card:not([skeleton])`);
      const m = await measure(page, B, 'ticket-card', 'header [data-toolbar], header .dh-det');
      await shot(page, 'board', m);
      if (STRICT) {
        if (s.w >= 768) expect(m.toolbarRows, 'the toolbar is one row on a desktop / tablet').toBeLessThanOrEqual(1);
        if (s.w >= 1024) expect(m.pageScroll, 'the page itself never scrolls').toBeLessThanOrEqual(1);
      }
    }
  });

  test('loading / empty / error states', async ({ page }, info) => {
    const s = SIZES[info.project.name][0];
    await page.setViewportSize({ width: s.w, height: s.h });
    await installTicketsMock(page, { empty: true });
    await page.goto(url('/tickets/mine'));
    await page.waitForSelector(`${L} [data-tickets-state="empty"]`);
    await shot(page, 'list-empty', await measure(page, L, '[data-tickets-state]', 'header [data-toolbar], header .dh-det'));
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installTicketsMock(page, { failList: true });
    await page.goto('about:blank');
    await page.goto(url('/tickets/mine'));
    await page.waitForSelector(`${L} [data-tickets-state="error"]`);
    await shot(page, 'list-error', await measure(page, L, '[data-tickets-state]', 'header [data-toolbar], header .dh-det'));
  });
});
