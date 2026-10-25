import { test, expect, type Page } from '@playwright/test';
import { settlePage } from './pixel-settle';

// LOGOSIDE-295: the developer (company) and installer logos sit at the START of the page's top row (the right in RTL) by default and
// in the corner (beside the SmplWise logo) when the administrator chooses `end`. Measured per width, with the company logo mocked at the
// network edge and the choices injected through the cache the shell reads first (`sw.ui.brandlogo`):
//   1. start: the company logo is a child of [data-lead-brand], on the start side (RTL: right of the pill), the corner row holds only the
//      pill and the SmplWise logo; end: the old layout (everything in the corner row);
//   2. no extra vertical row (the screen's offset in <main> equals the offset with the logos removed, within 1 px);
//   3. the logos cover nothing of the page header (title, buttons, links, fields, tabs) and intercept no click, at every width;
//   4. a company-only size scale (`company_logo_size`) changes the company logo's box and not the SmplWise logo's; "same" follows `size`;
//   5. the phone has no strip at all (the home head keeps its own layout).
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/layout-logo-side-295.spec.ts --project=desktop --workers=1
const LIGHT = 'aaaaaaaaaaaaaaaa.svg';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="#1e2e47"/><text x="150" y="62" font-size="40" text-anchor="middle" fill="#fff">NAVE</text></svg>`;

async function boot(page: Page, hash: string, opts: { side: 'start' | 'end'; size?: string; companySize?: string }) {
  await page.route('**/api/v1/brand/company-logo/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }) : r.fallback()));
  const cache = { company: { name: 'נווה הירדן', kind: 'management', logo: {}, logo_file: { light: LIGHT, dark: null } }, size: opts.size ?? 'm', company_logo_size: opts.companySize ?? 'same', logo_side: opts.side, dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: 'Tower A' } };
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, cache);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await settlePage(page);
}

interface R {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const sr = document.querySelector('sw-app')!.shadowRoot!;
    const r = (el: Element): { top: number; bottom: number; left: number; right: number } => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    };
    const main = sr.querySelector('main')!;
    const screen = sr.querySelector('main > .screen')!;
    const lead = sr.querySelector('[data-lead-brand]');
    const row = sr.querySelector('[data-brand-strip]');
    const imgs = (host: Element | null, sel: string) =>
      host ? [...host.querySelectorAll(sel)].flatMap((b) => [...(b.shadowRoot?.querySelectorAll('img, svg[data-brand-img]') ?? [])]).filter((i) => i.getBoundingClientRect().width > 0) : [];
    const leadLogos = imgs(lead, 'sw-brand');
    const rowCompany = imgs(row, 'sw-brand[kind="company"]');
    const product = row?.querySelector('sw-brand[kind="product"]') ?? null;
    const pill = row?.querySelector('.pillrow') ?? null;
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
    const band = mainTop + 70;
    const controls = all
      .filter((e) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SW-BUTTON|SW-DROPDOWN|SW-TABS)$/.test(e.tagName) || e.getAttribute('role') === 'tab')
      .filter((e) => visible(e) && e.getBoundingClientRect().top < band)
      .map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.textContent ?? '').trim().slice(0, 24), ...r(e) }));
    const hits = leadLogos.map((img) => {
      const b = img.getBoundingClientRect();
      const hit = sr.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!hit && !hit.closest('[data-lead-brand]');
    });
    return {
      side: document.querySelector('sw-app')!.getAttribute('data-brandside'),
      hasLead: !!lead,
      leadLogos: leadLogos.map(r),
      rowCompany: rowCompany.map(r),
      productH: product ? product.getBoundingClientRect().height : 0,
      companyH: leadLogos.length ? leadLogos[0].getBoundingClientRect().height : rowCompany.length ? rowCompany[0].getBoundingClientRect().height : 0,
      pill: pill ? r(pill) : null,
      screenOffset: screen.getBoundingClientRect().top - mainTop + main.scrollTop,
      title,
      controls,
      hits,
      dir: getComputedStyle(document.documentElement).direction,
    };
  });
}

const overlaps = (a: R, b: R) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 1024, h: 768 },
  { w: 820, h: 1180 },
];
const ROUTES = ['/devices', '/system/diagnostics'];

test.describe('LOGOSIDE-295: where the developer / installer logos sit', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the viewports are set per case; one project is enough');
  });

  for (const c of WIDTHS) {
    for (const route of ROUTES) {
      test(`${c.w}x${c.h} ${route}: start side - logos at the start of the top row, no extra row`, async ({ page }) => {
        await page.setViewportSize({ width: c.w, height: c.h });
        await boot(page, route, { side: 'start' });
        const m = await measure(page);
        expect(m.side).toBe('start');
        expect(m.hasLead).toBe(true);
        expect(m.leadLogos.length, 'the company logo is at the start').toBe(1);
        expect(m.rowCompany.length, 'the corner row no longer holds the company logo').toBe(0);
        // the start of an RTL page is its right: the logo lies to the right of the pill
        if (m.dir === 'rtl' && m.pill) expect(m.leadLogos[0].left).toBeGreaterThan(m.pill.right);
        // no extra vertical row: the logos add nothing above the screen
        await page.evaluate(() => {
          const sr = document.querySelector('sw-app')!.shadowRoot!;
          const s = document.createElement('style');
          s.textContent = '[data-lead-brand] { display: none !important; }';
          sr.appendChild(s);
        });
        await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
        const n = await measure(page);
        expect(Math.abs(m.screenOffset - n.screenOffset)).toBeLessThanOrEqual(1);
        test.info().annotations.push({ type: 'measure', description: JSON.stringify({ w: c.w, route, logo: m.leadLogos[0], title: m.title }) });
      });

      test(`${c.w}x${c.h} ${route}: start side - no logo over the title or a control; a click reaches the page`, async ({ page }) => {
        await page.setViewportSize({ width: c.w, height: c.h });
        await boot(page, route, { side: 'start' });
        const m = await measure(page);
        if (m.title) for (const l of m.leadLogos) expect(overlaps(l, m.title), 'a logo over the page title').toBe(false);
        for (const ctl of m.controls) for (const l of m.leadLogos) expect(overlaps(l, ctl), `a logo over ${ctl.tag} "${ctl.text}"`).toBe(false);
        expect(m.hits.every(Boolean)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      });
    }
  }

  test('end side: the old layout - the company logo in the corner row, no lead block', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, '/devices', { side: 'end' });
    const m = await measure(page);
    expect(m.side).toBeNull();
    expect(m.hasLead).toBe(false);
    expect(m.rowCompany.length).toBe(1);
  });

  test('company size: its own scale changes the company logo and not the SmplWise logo; same follows the general scale', async ({ page }) => {
    test.setTimeout(150_000); // three boots
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, '/devices', { side: 'start', size: 'm', companySize: 'same' });
    const base = await measure(page);
    await boot(page, '/devices', { side: 'start', size: 'm', companySize: 'xl' });
    const big = await measure(page);
    expect(big.companyH).toBeGreaterThan(base.companyH * 1.3);
    expect(Math.abs(big.productH - base.productH)).toBeLessThanOrEqual(0.5);
    await boot(page, '/devices', { side: 'start', size: 'xl', companySize: 'same' });
    const general = await measure(page);
    expect(Math.abs(general.companyH - big.companyH)).toBeLessThanOrEqual(1);
    expect(general.productH).toBeGreaterThan(base.productH * 1.3);
  });
});

test.describe('LOGOSIDE-295: the phone', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone project');
  });
  test('390 px: no strip and no lead block - the home head keeps its own layout', async ({ page }) => {
    await boot(page, '/devices', { side: 'start' });
    const m = await measure(page);
    expect(m.hasLead).toBe(false);
    expect(m.side).toBeNull();
  });
});
