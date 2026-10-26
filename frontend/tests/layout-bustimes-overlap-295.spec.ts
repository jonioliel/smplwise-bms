import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, settled, tvUrl } from './notice-tv-fixtures';
import { columns, digest, screen, serveTransit } from './bustimes-fixtures';

// FIX2231A-295: the weather / clock / welcome block of the side column must never overlap the bus-times block (owner screenshot 2026-10-26:
// the strip layout sat on top of the temperature). Pure geometry, no baselines: runs on the dist preview with the other layout specs.

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

type Rect = { l: number; t: number; r: number; b: number };

/** Visible bounding boxes (in screen pixels) of the side-column blocks and of the bus panels / bus slide. */
async function boxes(page: Page): Promise<{ side: Record<string, Rect>; bus: Record<string, Rect> }> {
  return page.evaluate(() => {
    const vis = (el: Element): DOMRect | null => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 1 || r.height < 1) return null;
      return r;
    };
    const out = { side: {} as Record<string, Rect>, bus: {} as Record<string, Rect> };
    const add = (into: Record<string, Rect>, key: string, el: Element, inner = false): void => {
      // `inner` = the box of the element's own content (text, icons), not its stretched grid cell
      let r = vis(el);
      if (!r) return;
      if (inner) {
        const kids = [...el.querySelectorAll('*')].map(vis).filter((x): x is DOMRect => !!x);
        if (kids.length) r = { left: Math.min(...kids.map((k) => k.left)), top: Math.min(...kids.map((k) => k.top)), right: Math.max(...kids.map((k) => k.right)), bottom: Math.max(...kids.map((k) => k.bottom)), width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      }
      into[key] = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    document.querySelectorAll('#cv .welcome, #cv .clock, #cv .wx').forEach((el, i) => add(out.side, el.className.split(' ')[0] + i, el, true));
    document.querySelectorAll('#cv .bus, #cv .busrow, #cv .it.transit').forEach((el, i) => {
      const it = el.closest('.it.transit');
      if (it && !it.classList.contains('on')) return; // the slide's panels count only while its slide is the one on stage
      add(out.bus, el.className.split(' ')[0] + i, el);
    });
    return out;
  });
}

const hit = (a: Rect, b: Rect): boolean => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;

async function check(page: Page, what: string): Promise<void> {
  const { side, bus } = await boxes(page);
  expect(Object.keys(side).length, what + ': the side column blocks exist').toBeGreaterThan(0);
  for (const [sk, s] of Object.entries(side)) {
    for (const [bk, b] of Object.entries(bus)) {
      expect(hit(s, b), `${what}: ${sk} ${JSON.stringify(s)} overlaps ${bk} ${JSON.stringify(b)}`).toBe(false);
    }
  }
  // and nothing of the side column hangs out of the page
  const vp = page.viewportSize()!;
  for (const [sk, s] of Object.entries(side)) expect(s.b, `${what}: ${sk} stays inside the viewport`).toBeLessThanOrEqual(vp.height + 1);
}

async function open(page: Page, o: { layout: 'side' | 'strip' | 'slide'; theme: 'day' | 'night'; w: number; h: number; tpl?: 1 | 2 | 3; size?: 's' | 'm' | 'l'; dig?: Record<string, unknown> }): Promise<void> {
  await page.setViewportSize({ width: o.w, height: o.h });
  await serveFeed(page, lobbyFeed({ theme: o.theme, template: o.tpl ?? 1, font_size: o.size ?? 's', transit: screen({ layout: o.layout }) } as never));
  await serveTransit(page, digest({ layout: o.layout, nstops: o.layout === 'slide' ? 3 : 2, multi: true, columns: o.layout === 'slide' ? columns(3) : undefined, ...(o.dig ?? {}) }));
  await page.goto(new URL(tvUrl(), base()).toString());
  await settled(page);
  if (o.layout === 'slide') {
    await page.evaluate(() => window.postMessage({ smplwise: 'tv', cmd: 'prev' }, location.origin));
    await page.waitForTimeout(1300);
  }
}

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'geometry is the same on every project; one run is enough');
});

const SIZES = [{ w: 1920, h: 1080, n: 'landscape' }, { w: 2000, h: 956, n: 'wide 2000x956' }, { w: 1080, h: 1920, n: 'portrait' }];
const STATES: Array<{ n: string; dig: Record<string, unknown> }> = [
  { n: 'fresh', dig: {} },
  { n: 'cached', dig: { state: 'cached', updated_hm: '08:53', age_s: 900 } },
  { n: 'expired', dig: { state: 'expired', items: [], overflow: 0, age_s: 4000 } },
  { n: 'empty', dig: { items: [], overflow: 0, window_min: 30, next: { line: '28', dest: 'קניון השרון', stop: 33323, at: '2026-10-23T08:30:00Z', hm: '11:30', mins: 138 } } },
];

for (const layout of ['side', 'strip', 'slide'] as const) {
  for (const sz of SIZES) {
    for (const theme of ['day', 'night'] as const) {
      test(`bus times never overlap the weather/clock block: ${layout} ${sz.n} ${theme}`, async ({ page }) => {
        await open(page, { layout, theme, w: sz.w, h: sz.h });
        await check(page, `${layout} ${sz.n} ${theme}`);
      });
    }
  }
  for (const st of STATES) {
    test(`bus times never overlap the weather/clock block: ${layout} state ${st.n} (landscape, portrait)`, async ({ page }) => {
      for (const sz of [SIZES[0], SIZES[2]]) {
        await open(page, { layout, theme: 'day', w: sz.w, h: sz.h, dig: st.dig });
        await check(page, `${layout} ${st.n} ${sz.n}`);
      }
    });
  }
}

// the owner's board used a larger text size: the strip must hold at every size and in every template
for (const tpl of [1, 2, 3] as const) {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`bus strip never overlaps the weather/clock block: template ${tpl} text size ${size}`, async ({ page }) => {
      for (const sz of [SIZES[0], SIZES[2]]) {
        await open(page, { layout: 'strip', theme: 'night', w: sz.w, h: sz.h, tpl, size });
        await check(page, `strip tpl${tpl} ${size} ${sz.n}`);
      }
    });
  }
}
