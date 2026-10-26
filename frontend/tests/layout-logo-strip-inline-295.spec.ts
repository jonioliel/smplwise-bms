import { test, expect, type Page } from '@playwright/test';
import { settlePage } from './pixel-settle';
import { skinsUnderTest } from './helpers/frozen-skins';

// LOGOFIT-295 (owner bug report on 2.16.0): the logos (the company logo, the SmplWise logo) share the floating corner's row - the page's own
// top row - instead of a 48 px strip of their own above every screen that pushed the whole screen down. Measured here, per width and skin:
//   1. no extra vertical row: the screen's top offset inside <main> and <main>'s scroll height are the same with the logos and without
//      them (the logo row removed) within 1 px;
//   2. the logo row lies inside the page's first row: its top is at <main>'s top band and its bottom no lower than the page title's row;
//   3. it covers nothing of the page header (title, buttons, links, fields, tabs) and intercepts no click (the logos are no hit target);
//   4. not sticky over a scrolled page (the 2.16.0 gate): once <main> scrolls the logos are hidden, the pill keeps its place.
// Demo mode (no backend); the company logo file is mocked at the network edge and the installation's choice injected through the cache
// the shell reads first (`sw.ui.brandlogo`), as in evidence-brand-logos.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/layout-logo-strip-inline-295.spec.ts --project=desktop --workers=1
const LIGHT = 'aaaaaaaaaaaaaaaa.svg';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="#1e2e47"/><text x="150" y="62" font-size="40" text-anchor="middle" fill="#fff">NAVE</text></svg>`;

async function boot(page: Page, hash: string, skin: string, company: boolean) {
  // LOGOSIDE-295: this spec is about the corner-row layout (side end); the default side is start (tests/layout-logo-side-295.spec.ts)
  await page.route('**/api/v1/brand/company-logo/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }) : r.fallback()));
  const cache = { company: { name: 'נווה הירדן', kind: 'management', logo: {}, logo_file: { light: company ? LIGHT : null, dark: null } }, size: 'm', logo_side: 'end', dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: 'Tower A' } };
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, cache);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await settlePage(page);
}

interface R {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Everything measured in one pass: the logo row, the screen's offset in <main>, the page title, the header controls in the top band. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const sr = document.querySelector('sw-app')!.shadowRoot!;
    const r = (el: Element): { top: number; bottom: number; left: number; right: number } => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    };
    const main = sr.querySelector('main')!;
    const screen = sr.querySelector('main > .screen')!;
    const row = sr.querySelector('[data-brand-strip]');
    const logos = row ? [...row.querySelectorAll('sw-brand')].flatMap((b) => [...(b.shadowRoot?.querySelectorAll('img, svg[data-brand-img]') ?? [])]).filter((i) => i.getBoundingClientRect().width > 0) : [];
    const pill = row?.querySelector('.pillrow') ?? null;
    // the page's own elements, through every shadow root under the screen
    const deep = (root: ParentNode, out: Element[] = []): Element[] => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        out.push(el);
        const s = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (s) deep(s, out);
      }
      return out;
    };
    const all = deep(screen);
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const h1 = all.find((e) => e.tagName === 'H1' && visible(e)) ?? null;
    let title: { top: number; bottom: number; left: number; right: number } | null = null;
    if (h1) {
      const range = document.createRange();
      range.selectNodeContents(h1);
      const b = range.getBoundingClientRect();
      title = { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    }
    const mainTop = main.getBoundingClientRect().top;
    const band = (row ? row.getBoundingClientRect().bottom : mainTop + 60) + 8;
    const controls = all
      .filter((e) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SW-BUTTON|SW-DROPDOWN|SW-TABS)$/.test(e.tagName) || e.getAttribute('role') === 'tab')
      .filter((e) => visible(e) && e.getBoundingClientRect().top < band)
      .map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.textContent ?? '').trim().slice(0, 24), ...r(e) }));
    // a click on the middle of every logo reaches the page, never the logo
    const hits = logos.map((img) => {
      const b = img.getBoundingClientRect();
      const hit = sr.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!hit && !hit.closest('[data-brand-strip]');
    });
    return {
      on: !!row,
      mainTop,
      screenOffset: screen.getBoundingClientRect().top - mainTop + main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      row: row ? r(row) : null,
      logos: logos.map(r),
      pill: pill ? r(pill) : null,
      title,
      controls,
      hits,
    };
  });
}

/** The same screen with the logo row taken out of the page altogether (the no-logo layout of 2.15: the pill alone in the corner). */
async function withoutLogoRow(page: Page) {
  await page.evaluate(() => {
    const sr = document.querySelector('sw-app')!.shadowRoot!;
    const s = document.createElement('style');
    s.setAttribute('data-test-nologo', '');
    s.textContent = '[data-brand-strip] { display: none !important; }';
    sr.appendChild(s);
  });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
}

const overlaps = (a: R, b: R) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

const CASES: { w: number; h: number; skins: string[] }[] = [
  { w: 1440, h: 900, skins: skinsUnderTest(['classic', 'domus', 'bubble', 'crystal', 'tesla']) },
  { w: 1366, h: 768, skins: ['classic', 'domus'] },
  { w: 1024, h: 768, skins: skinsUnderTest(['classic', 'bubble']) }, // the tablet project's width (landscape)
  { w: 820, h: 1180, skins: ['classic', 'domus'] }, // a portrait tablet: the narrow rail
];
const ROUTES = [
  { hash: '/devices', name: 'home' }, // בקרה ראשית
  { hash: '/system/diagnostics', name: 'settings' },
];

test.describe('LOGOFIT-295: the logos share the top row, no extra row', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the viewports are set per case; one project is enough');
  });

  for (const c of CASES) {
    for (const skin of c.skins) {
      for (const route of ROUTES) {
        test(`${c.w}x${c.h} ${skin} ${route.name}: no extra row, nothing covered`, async ({ page }) => {
          await page.setViewportSize({ width: c.w, height: c.h });
          await boot(page, route.hash, skin, true);
          const m = await measure(page);
          expect(m.on, 'the logo row shows on desktop / tablet').toBe(true);
          expect(m.logos.length, 'the company logo and the SmplWise logo').toBe(2);
          await withoutLogoRow(page);
          const n = await measure(page);
          test.info().annotations.push({ type: 'measure', description: JSON.stringify({ w: c.w, h: c.h, skin, route: route.name, screenOffset: m.screenOffset, screenOffsetNoLogo: n.screenOffset, scrollHeight: m.scrollHeight, scrollHeightNoLogo: n.scrollHeight, row: m.row, title: m.title }) });
          // 1. no extra vertical row
          expect(Math.abs(m.screenOffset - n.screenOffset), 'the screen starts where it starts without the logos').toBeLessThanOrEqual(1);
          expect(Math.abs(m.scrollHeight - n.scrollHeight), 'the logos add no height to <main>').toBeLessThanOrEqual(1);
          // 2. inside the page's first row
          const row = m.row!;
          expect(row.top - m.mainTop).toBeGreaterThanOrEqual(-1);
          expect(row.top - m.mainTop).toBeLessThanOrEqual(16);
          if (m.title) expect(row.bottom, 'no lower than the page title row').toBeLessThanOrEqual(m.title.bottom + 16);
          // 3. covers nothing of the page header and intercepts no click
          const cover = [...m.logos, ...(m.pill ? [m.pill] : [])];
          if (m.title) for (const l of cover) expect(overlaps(l, m.title), 'a logo / the pill over the page title').toBe(false);
          for (const ctl of m.controls) for (const l of cover) expect(overlaps(l, ctl), `a logo / the pill over ${ctl.tag} "${ctl.text}"`).toBe(false);
          expect(m.hits.every(Boolean), 'a click on a logo reaches the page').toBe(true);
          // no sideways scroll at any width
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        });
      }
    }
  }

  test('without a company logo: the SmplWise logo beside the pill, still no extra row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, '/devices', 'classic', false);
    const m = await measure(page);
    expect(m.logos.length).toBe(1);
    await withoutLogoRow(page);
    const n = await measure(page);
    expect(Math.abs(m.screenOffset - n.screenOffset)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.scrollHeight - n.scrollHeight)).toBeLessThanOrEqual(1);
  });

  test('a scrolled page has no logo over its sticky header; the pill keeps its place', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await boot(page, '/system/diagnostics', 'classic', true);
    const before = await measure(page);
    const scrollable = await page.evaluate(() => {
      const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
      return main.scrollHeight - main.clientHeight;
    });
    test.skip(scrollable < 40, 'the screen does not scroll at this size');
    await page.evaluate(() => {
      const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
      main.scrollTop = 300;
    });
    await expect(page.locator('sw-app')).toHaveAttribute('data-scrolled', '');
    await expect.poll(() => page.evaluate(() => [...document.querySelector('sw-app')!.shadowRoot!.querySelectorAll('[data-brand-strip] sw-brand')].every((b) => getComputedStyle(b).visibility === 'hidden'))).toBe(true);
    const after = await measure(page);
    expect(Math.abs(after.pill!.left - before.pill!.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.pill!.top - before.pill!.top)).toBeLessThanOrEqual(0.5);
    await page.evaluate(() => {
      document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!.scrollTop = 0;
    });
    await expect(page.locator('sw-app')).not.toHaveAttribute('data-scrolled', '');
  });
});
