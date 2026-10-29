import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';

// UXFIX-RTL (UX audit 2026-10-20), findings 1, 2 and 3 in the REAL build: a non-Hebrew ticket title keeps its beginning and is clamped to two
// lines with the full text offered; long site names / addresses wrap by words, stay clamped and the action buttons align across a row.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-uxfix-rtl.spec.ts --project=desktop --project=mobile --workers=1

const RU = 'Согласовать работы по лифту между 6 и 7 этажами в часы пик и предупредить жильцов заранее чтобы никто не застрял';
const EN = 'Replace the faulty meter on the main distribution board, bus 742 (S/N 4F77A1) 3-phase 400V, before the audit';
const HE_DATE = 'פגישה עם הספק 2026-10-28 19:30 בלובי';

async function cardWith(page: Page, title: string) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installBoardMock(page, {});
  await page.goto('about:blank');
  await page.goto(url('/tickets/board'));
  await page.waitForSelector('sw-app tickets-board ticket-card');
  const card = page.locator('sw-app tickets-board ticket-card').first();
  // The board refreshes once right after it opened (the shared LiveRefresh fires on the first window focus, 2.5.4), which replaces the card's item
  // with the mock's own row: a title set a moment too early is lost. Set it until it survives a short settle (the next refresh is 20 s away).
  await expect(async () => {
    await card.evaluate(async (el, t) => {
      const c = el as HTMLElement & { item: Record<string, unknown>; updateComplete: Promise<boolean> };
      c.item = { ...c.item, title: t };
      await c.updateComplete;
    }, title);
    await page.waitForTimeout(250);
    expect(await card.locator('h3[data-card-title] a.name').getAttribute('title')).toBe(title);
  }).toPass({ timeout: 15_000 });
  return card;
}

test.describe('ticket card titles', () => {
  test.beforeEach(async ({}, info) => test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390'));

  for (const [name, title] of [['russian', RU], ['english', EN]] as const) {
    // GATELANES-297 timing lane: the wrapping is measured while the web fonts load (FLAKY in 4 of the last 40 runs); the release gate
    // leaves these two out (--grep-invert @timing-lane), scripts/gate/timing_lane.sh runs them when the runner is quiet
    test(`a ${name} title keeps its beginning: dir=auto, two lines, full text in title`, { tag: '@timing-lane' }, async ({ page }) => {
      const card = await cardWith(page, title);
      const h3 = card.locator('h3[data-card-title]');
      await expect(h3).toHaveAttribute('dir', 'auto');
      await expect(h3.locator('a.name')).toHaveAttribute('title', title);
      const m = await h3.evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        return { direction: cs.direction, clamp: cs.getPropertyValue('-webkit-line-clamp'), h: el.getBoundingClientRect().height, lh, sw: el.scrollWidth, cw: el.clientWidth };
      });
      expect(m.direction).toBe('ltr');
      expect(m.clamp).toBe('2');
      expect(m.h).toBeLessThanOrEqual(m.lh * 2 + 2);
      expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
      // the first letter is on screen, inside the card (not cut off the start by an RTL ellipsis)
      const first = await h3.locator('a.name').evaluate((a) => {
        const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
        const node = walker.nextNode() as Text;
        const r = document.createRange();
        r.setStart(node, 0);
        r.setEnd(node, 1);
        const b = r.getBoundingClientRect();
        const box = a.closest('article')!.getBoundingClientRect();
        return b.left >= box.left - 1 && b.right <= box.right + 1;
      });
      expect(first).toBe(true);
    });
  }

  test('a Hebrew title with an ISO date keeps the date and time in reading order', async ({ page }) => {
    const card = await cardWith(page, HE_DATE);
    const h3 = card.locator('h3[data-card-title]');
    expect(await h3.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    expect(await h3.locator('a.name').textContent()).toContain('⁦2026-10-28 19:30⁩');
  });
});

test.describe('sites and buildings cards', () => {
  test('long names and addresses wrap by words, stay short and align their buttons', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.goto(url('/explore/sites'));
    const screen = page.locator('explore-sites');
    await screen.locator('[data-site-card]').first().waitFor();
    const LONG = 'Кампус Северный Технологический Парк, корпуса A-D, главная площадка управляющей компании «Горизонт» и партнёров';
    const ADDR = 'شارع الملك فيصل، حي الرمال الشرقي، مبنى رقم 14، الطابق الثالث، بجوار المركز التجاري الكبير، المدينة القديمة';
    await screen.evaluate(async (el, [name, addr]) => {
      const e = el as HTMLElement & { tree: { source: string; canCreateSite: boolean; sites: Record<string, unknown>[] }; updateComplete: Promise<boolean> };
      const mk = (i: number, n: string, a: string) => ({ id: `ux-${i}`, name: n, address: a, timezone: 'Asia/Jerusalem', sort_order: i, buildings: [], image_url: null });
      e.tree = { source: 'demo', canCreateSite: false, sites: [mk(1, name, addr), mk(2, 'אתר קצר', ''), mk(3, 'הקמפוס הצפוני של פארק הטכנולוגיה והחדשנות העירוני, מבני A עד D', 'רחוב ההגנה 14, קומה שלישית, ליד המרכז המסחרי הגדול, העיר העתיקה, ישראל')] };
      await e.updateComplete;
    }, [LONG, ADDR]);
    const cards = screen.locator('[data-site-card]');
    await expect(cards).toHaveCount(3);
    const m = await cards.evaluateAll((els) => els.map((c) => {
      const name = c.querySelector('[data-site-name]') as HTMLElement;
      const btn = c.querySelector('.acts sw-button') as HTMLElement | null;
      const lh = parseFloat(getComputedStyle(name).lineHeight) || 20;
      const top = btn ? btn.getBoundingClientRect().top - c.getBoundingClientRect().top : -1;
      const rect = c.getBoundingClientRect();
      const count = c.querySelector('.txt > small:not(.clamp2)') as HTMLElement;
      const cl = parseFloat(getComputedStyle(count).lineHeight) || 20;
      // SITENAME-2272: the name takes the card width, the count stays on one line, and the name is never cut below three lines
      return { h: rect.height, nameLines: name.getBoundingClientRect().height / lh, top, w: rect.width, y: rect.top, nameW: name.getBoundingClientRect().width, countLines: count.getBoundingClientRect().height / cl, countFits: count.scrollWidth <= count.clientWidth + 1, clipped: name.scrollHeight > name.clientHeight + 1, nameFs: parseFloat(getComputedStyle(name).fontSize) };
    }));
    for (const c of m) {
      expect(c.h).toBeLessThan(400);
      expect(c.nameLines).toBeLessThanOrEqual(3.3); // at most three lines, the rest is clamped with the full text in the title
      expect(c.w).toBeGreaterThanOrEqual(270);
      expect(c.nameW).toBeGreaterThanOrEqual(c.w * 0.8);
      expect(c.countLines).toBeLessThanOrEqual(1.8);
      expect(c.countFits).toBe(true);
      expect(c.nameFs).toBeGreaterThanOrEqual(16);
    }
    // the buttons of the cards in one row sit at the same height
    const row = m.filter((c) => Math.abs(c.y - m[0].y) < 2);
    if (row.length > 1) for (const c of row) expect(Math.abs(c.top - row[0].top)).toBeLessThanOrEqual(1);
    await expect(screen.locator('[data-site-name]').first()).toHaveAttribute('title', LONG);
  });
});
