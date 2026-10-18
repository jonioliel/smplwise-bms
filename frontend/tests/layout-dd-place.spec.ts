import { test, expect, type Page } from '@playwright/test';

// 2026-10-17: header dropdown placement (ui.dd_place 1..4) swept over the main screens x the four placements x widths 1280 / 1024 / 390.
// NOT RUN when written (the runner was busy with a release gate): run with
//   npx playwright test tests/layout-dd-place.spec.ts --project=desktop --workers=1
// Asserted per combination: no horizontal page overflow; the chip(s), the first heading and the floating search/status corner never overlap
// each other; below 1100 px (1024, 390) the placement is always the own row (data-dd-place may read the dial but the row keeps its height);
// at 1280 a placement 2/3/4 is honoured (zero-height row) or the screen fell back to 1 on its own (never an overlap either way).

const SCREENS = [
  '/security/live/wall',
  '/multimedia/screens',
  '/multimedia/players',
  '/multimedia/groups',
  '/devices/automations',
  '/devices/schedules',
  '/tickets',
  '/tickets/list',
  '/tickets/overview',
  '/tickets/rfqs',
  '/explore/sites',
  '/system/notifications',
  '/system/tickets',
] as const;
const PLACES = ['1', '2', '3', '4'] as const;
const WIDTHS = [1280, 1024, 390] as const;

async function open(page: Page, hash: string, width: number, place: string) {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('sw.dd.place', JSON.stringify({ u: 'anon', value: p }));
    } catch {
      /* storage unavailable: the installation default (1) applies */
    }
  }, place);
  await page.goto(`/#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await page.waitForTimeout(1800); // the collision check re-runs every 1.2 s while a screen loads
}

interface Facts {
  place: string | null;
  rowH: number;
  chips: DOMRect[];
  title: DOMRect | null;
  corner: DOMRect | null;
  overflow: boolean;
}

const facts = (page: Page): Promise<Facts> =>
  page.locator('sw-app').evaluate((app) => {
    const root = app.shadowRoot!;
    const chips = [...root.querySelectorAll<HTMLElement>('.tabpair:not(.single) > *, .subnav[data-tabstyle=dropdown] > sw-tabs')].map((e) => e.getBoundingClientRect().toJSON() as DOMRect).filter((r) => r.width > 0);
    const row = root.querySelector<HTMLElement>('.tabpair:not(.single), .subnav[data-tabstyle=dropdown]');
    const find = (r: ParentNode): HTMLElement | null => {
      for (const el of r.querySelectorAll<HTMLElement>('*')) {
        if (el.localName === 'h1' && el.getBoundingClientRect().width > 0) return el;
        const inner = el.shadowRoot ? find(el.shadowRoot) : null;
        if (inner) return inner;
      }
      return null;
    };
    const h1 = find(root.querySelector('.screen') ?? root);
    let title: DOMRect | null = null;
    if (h1) {
      const range = document.createRange();
      range.selectNodeContents(h1);
      title = range.getBoundingClientRect().toJSON() as DOMRect;
    }
    const corner = root.querySelector<HTMLElement>('.float');
    return {
      place: app.getAttribute('data-dd-place'),
      rowH: row ? Math.round(row.getBoundingClientRect().height) : -1,
      chips,
      title,
      corner: corner ? (corner.getBoundingClientRect().toJSON() as DOMRect) : null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const hash of SCREENS) {
  for (const w of WIDTHS) {
    for (const p of PLACES) {
      test(`${hash} at ${w}px, placement ${p}: no overlap, no horizontal overflow`, async ({ page }) => {
        await open(page, hash, w, p);
        const f = await facts(page);
        expect(f.overflow, 'horizontal overflow').toBe(false);
        if (f.chips.length === 0) return; // this screen's group is not in dropdown mode: nothing hangs on the header
        for (const c of f.chips) {
          if (f.title) expect(overlap(c, f.title), 'chip over the title').toBe(false);
          if (f.corner) expect(overlap(c, f.corner), 'chip over the floating search/status corner').toBe(false);
        }
        if (f.title && f.corner) expect(overlap(f.title, f.corner), 'title under the corner').toBe(false);
        if (w < 1100) expect(f.rowH, 'a narrow screen keeps the own row').toBeGreaterThan(0);
        else if (f.place !== '1') expect(f.rowH, `placement ${f.place} collapses the row`).toBe(0);
      });
    }
  }
}
