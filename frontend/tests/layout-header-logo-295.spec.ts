import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';

// HDRFIX-295 (owner 2026-10-26, 2000 px desktop captures with the developer logo at the start of the top row): titles drawn over the logos,
// the infrastructure screens without a visible title. Root causes and what this spec pins:
//   1. the shell decided "a row sits above the page title" from the mere presence of an empty `.tabpair` (the security area draws it with
//      no chip in it when only one section and one page are offered - the NVR-less sensor events), so the page header kept no room free of
//      the logos: the title and the logos are measured here and must not overlap, and the empty pair takes no height;
//   2. the infrastructure screens (electricity, water, generator) drew their <h1> visually hidden: it is visible now, one per page, and clear
//      of the logos;
//   3. the notice board draws its own header row inside an empty <sw-page>: it keeps the shell's reserves (source check, the data-driven
//      page needs a backend).
// The browser cases force the dropdown form (`ui.tabs_mode`) through the shell's own module, so they need the Vite DEV server (they skip on a
// preview build, like layout-dd-place.spec.ts):
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test tests/layout-header-logo-295.spec.ts --project=desktop --workers=1
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="#1e2e47"/><text x="150" y="62" font-size="40" text-anchor="middle" fill="#fff">NOA</text></svg>`;
const LIGHT = 'aaaaaaaaaaaaaaaa.svg';

interface R {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

async function boot(page: Page, hash: string, place: '1' | '4'): Promise<boolean> {
  await page.route('**/api/v1/brand/company-logo/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }) : r.fallback()));
  const cache = { company: { name: 'noa', kind: 'management', logo: {}, logo_file: { light: LIGHT, dark: null } }, size: 'm', company_logo_size: 'same', logo_side: 'start', dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: 'T' } };
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
    } catch {
      /* storage unavailable */
    }
  }, cache);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await settlePage(page);
  const ok = await page.evaluate(async (p) => {
    try {
      const url: string = '/src/shell/tabs-mode.ts';
      const m = await import(/* @vite-ignore */ url);
      m.setInstallationTabsMode({ 'ui.tabs_mode': 'dropdown', 'ui.dd_place': p });
      return true;
    } catch {
      return false;
    }
  }, place);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  await page.waitForTimeout(400);
  return ok;
}

/** The logos at the start of the top row, the page's title (its glyphs) and every visible <h1> in the screen, from the DOM. */
async function facts(page: Page) {
  return page.evaluate(() => {
    const app = document.querySelector('sw-app')!;
    const sr = app.shadowRoot!;
    const box = (b: DOMRect) => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right });
    const lead = sr.querySelector('[data-lead-brand]');
    const logos = lead ? [...lead.querySelectorAll('sw-brand')].flatMap((b) => [...(b.shadowRoot?.querySelectorAll('img, svg[data-brand-img]') ?? [])]).map((i) => box(i.getBoundingClientRect())).filter((b) => b.right > b.left) : [];
    const deep = (root: ParentNode, out: Element[] = []): Element[] => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        out.push(el);
        const s = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (s) deep(s, out);
      }
      return out;
    };
    const screen = sr.querySelector('main > .screen')!;
    const h1s = deep(screen).filter((e) => {
      if (e.tagName !== 'H1') return false;
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    const titles = h1s.map((h) => {
      const range = document.createRange();
      range.selectNodeContents(h);
      return box(range.getBoundingClientRect());
    });
    const pair = sr.querySelector('.tabpair');
    return {
      top: app.getAttribute('data-top'),
      dir: getComputedStyle(document.documentElement).direction,
      logos,
      titles,
      pairH: pair ? pair.getBoundingClientRect().height : -1,
      pairKids: pair ? pair.children.length : -1,
    };
  });
}

const overlaps = (a: R, b: R) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

test.describe('HDRFIX-295: a page title never sits on the developer / installer logos', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the viewport is set per case; one project is enough');
  });

  for (const place of ['1', '4'] as const) {
    test(`2000x960 dropdown form, placement ${place}: the security events title with no chip in the pair clears the logos and the pair takes no row`, async ({ page }) => {
      await page.setViewportSize({ width: 2000, height: 960 });
      const dev = await boot(page, '/investigate/events', place);
      test.skip(!dev, 'needs the Vite dev server (the shell module is imported by path)');
      // the NVR-less state: one section and one page offered, so the shell's pair row holds no chip
      await page.evaluate(() => {
        const app = document.querySelector('sw-app') as HTMLElement & { requestUpdate(): void };
        const pair = app.shadowRoot!.querySelector('.tabpair');
        for (const c of Array.from(pair?.children ?? [])) c.remove();
        app.requestUpdate();
      });
      await page.waitForTimeout(600);
      const f = await facts(page);
      expect(f.pairKids).toBe(0);
      expect(f.pairH, 'an empty pair is no row').toBe(0);
      expect(f.top, 'with no row above it the page header is the first row').toBe('page');
      expect(f.logos.length, 'the logo is at the start of the top row').toBeGreaterThan(0);
      expect(f.titles.length, 'one visible title').toBe(1);
      for (const l of f.logos) expect(overlaps(f.titles[0], l), `title ${JSON.stringify(f.titles[0])} over logo ${JSON.stringify(l)}`).toBe(false);
      // RTL: the title starts to the left of the logo, never to its right
      if (f.dir === 'rtl') expect(f.titles[0].right).toBeLessThanOrEqual(Math.min(...f.logos.map((l) => l.left)) + 0.5);
    });
  }

  for (const route of ['/infra/electricity', '/infra/water']) {
    test(`2000x960 ${route}: the infrastructure screen shows its title (one h1), clear of the logos`, async ({ page }) => {
      await page.setViewportSize({ width: 2000, height: 960 });
      const dev = await boot(page, route, '4');
      test.skip(!dev, 'needs the Vite dev server (the shell module is imported by path)');
      const f = await facts(page);
      expect(f.titles.length, 'exactly one visible title').toBe(1);
      expect(f.logos.length).toBeGreaterThan(0);
      for (const l of f.logos) expect(overlaps(f.titles[0], l), `title ${JSON.stringify(f.titles[0])} over logo ${JSON.stringify(l)}`).toBe(false);
      const h1Count = await page.evaluate(() => {
        const sr = document.querySelector('sw-app')!.shadowRoot!;
        const deep = (root: ParentNode, n = 0): number => Array.from(root.querySelectorAll('*')).reduce((a, el) => a + (el.tagName === 'H1' ? 1 : 0) + (el.shadowRoot ? deep(el.shadowRoot) : 0), n);
        return deep(sr.querySelector('main > .screen')!);
      });
      expect(h1Count, 'still exactly one <h1> in the page outline').toBe(1);
    });
  }
});

test.describe('HDRFIX-295: sources', () => {
  const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
  const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

  test('the notice board header row keeps the logos\' and the corner\'s reserves, as <sw-page>\'s own header does', () => {
    const css = read('notices/styles.ts');
    const top = /\.top \{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(top).toContain('padding-inline-start: var(--sw-lead-reserve, 0px)');
    expect(top).toContain('padding-inline-end: var(--sw-float-reserve, 0px)');
  });

  test('the shell counts a tab / section row only when it holds a chip, and hides an empty pair', () => {
    const app = read('shell/sw-app.ts');
    expect(app).toContain(".tabpair > *') ? 'secrow'");
    expect(app).toContain(".tabpair:not(:has(> *))");
  });

  test('the infrastructure screens draw their h1 visibly', () => {
    for (const f of ['infra-electricity', 'infra-water', 'infra-generator']) expect(read(`screens/${f}.ts`), f).toMatch(/srHeading\(.*, true\)/);
  });
});
