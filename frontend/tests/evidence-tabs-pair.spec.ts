import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.1.153 (owner requirement): in the dropdown form the page chrome's TWO levels are two compact chips side by side in ONE row (the
// mockup's tab-pair): security = sections + pages, multimedia = the area's pages + the room filter, home = the area's pages + the areas
// of the floor. Measured at 390 / 360 / 320 px in demo mode through shell/tabs-mode.ts. Needs the Vite DEV server (imports /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test evidence-tabs-pair --project=desktop --workers=1
const SHOTS = process.env.SW_SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/tabs-dropdown');
const MODE_URL = '/src/shell/tabs-mode.ts';
const NAV_URL = '/src/shell/nav.ts';

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function setMode(page: Page, mode: string | null, groups: Record<string, string> = {}) {
  await page.evaluate(
    async ([url, m, g]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnTabsMode(m, g);
    },
    [MODE_URL, mode, groups] as const,
  );
  await page.waitForTimeout(500);
  // the pair specs measure the popover under each chip; the phone setting (owner 2026-10-03) defaults to a bottom sheet
  // (covered by dropdown-phone-choice.spec.ts), so the popover case is the `list` choice
  await page.evaluate(() => document.documentElement.setAttribute('data-dd-phone', 'list'));
}

async function openShell(page: Page, hash: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('about:blank');
  await page.goto(`./?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

/** The chip boxes of the pair row, in DOM order (the first = the primary level), plus the overflow facts. */
async function pair(page: Page) {
  return page.locator('sw-app').evaluate((app) => {
    const root = app.shadowRoot!;
    const row = root.querySelector<HTMLElement>('.tabpair[data-tab-pair]');
    if (!row) return null;
    const chips = [...row.children].flatMap((c) => {
      const el = c as HTMLElement;
      const chip = el.tagName === 'SW-TABS' ? (el.shadowRoot!.querySelector('sw-dropdown') as HTMLElement).shadowRoot!.querySelector<HTMLElement>('.chip') : el.tagName === 'SW-DROPDOWN' ? el.shadowRoot!.querySelector<HTMLElement>('.chip') : null;
      if (!chip) return [];
      const r = chip.getBoundingClientRect();
      return [{ l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, overflowing: [...chip.children].some((k) => { const q = k.getBoundingClientRect(); return !k.classList.contains('dot') && (q.right > r.right + 1 || q.left < r.left - 1); }) }];
    });
    const rr = row.getBoundingClientRect();
    return {
      chips,
      row: { l: rr.left, r: rr.right, h: rr.height, scroll: row.scrollWidth, client: row.clientWidth },
      page: { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth },
    };
  });
}

/** The popover of the n-th chip of the pair row (opens it by the keyboard or the pointer) and its box. */
async function openChip(page: Page, which: number, how: 'click' | 'key') {
  const handle = await page.locator('sw-app').evaluateHandle((app, n) => {
    const row = app.shadowRoot!.querySelector('.tabpair[data-tab-pair]')!;
    const el = row.children[n] as HTMLElement;
    return el.tagName === 'SW-TABS' ? el.shadowRoot!.querySelector('sw-dropdown')! : el;
  }, which);
  const dd = handle.asElement()!;
  const chip = await dd.evaluateHandle((el) => el.shadowRoot!.querySelector<HTMLElement>('.chip')!);
  if (how === 'click') await chip.asElement()!.click();
  else {
    await chip.asElement()!.focus();
    await page.keyboard.press('ArrowDown');
  }
  return dd;
}

const popBox = (dd: import('@playwright/test').ElementHandle) =>
  dd.evaluate((node) => {
    const el = node as HTMLElement;
    const c = el.shadowRoot!.querySelector('.chip')!.getBoundingClientRect();
    const p = el.shadowRoot!.querySelector('[role=listbox]') as HTMLElement;
    const r = p.getBoundingClientRect();
    return { chip: { l: c.left, r: c.right, b: c.bottom }, pop: { l: r.left, r: r.right, t: r.top, b: r.bottom }, vw: document.documentElement.clientWidth, vh: window.innerHeight, shown: !p.hidden };
  });

function assertPair(p: NonNullable<Awaited<ReturnType<typeof pair>>>, n = 2) {
  expect(p.chips.length).toBe(n);
  const [a, b] = p.chips;
  expect(Math.abs(a.t - b.t)).toBeLessThan(2); // the same y
  expect(Math.abs(a.b - b.b)).toBeLessThan(2);
  const left = a.l < b.l ? a : b;
  const right = a.l < b.l ? b : a;
  expect(left.r).toBeLessThanOrEqual(right.l); // no overlap
  expect(b.r).toBeLessThan(a.l + 1); // RTL: the primary level is on the right (DOM order = right to left)
  for (const c of p.chips) {
    expect(c.h).toBeLessThanOrEqual(40);
    expect(c.l).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(p.page.client);
    expect(c.overflowing).toBe(false); // the text is ellipsised inside, never spilling out of the chip
  }
  expect(p.row.scroll).toBeLessThanOrEqual(p.row.client + 1);
  expect(p.page.scroll).toBeLessThanOrEqual(p.page.client + 1); // no horizontal overflow of the page
  expect(Math.abs(a.r - a.l - (b.r - b.l))).toBeLessThan(2); // equal widths
}

for (const w of [390, 360, 320]) {
  test.describe(`the pair at ${w} px`, () => {
    test('security: sections + pages in one row, each with its own popover; keyboard works for both', async ({ page }) => {
      await openShell(page, '/security/live/wall', w);
      await setMode(page, 'dropdown');
      const p = await pair(page);
      expect(p).not.toBeNull();
      assertPair(p!);
      // the old stacked rows are gone
      expect(await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelectorAll('nav.secrow, nav.sectabs, .subnav sw-tabs').length)).toBe(0);
      if (w === 390) await shot(page, 'pair-security-390-light');
      for (const n of [0, 1]) {
        const dd = await openChip(page, n, 'click');
        const b = await popBox(dd);
        expect(b.shown).toBe(true);
        expect(b.pop.t).toBeGreaterThanOrEqual(b.chip.b); // under its own chip
        expect(b.pop.l).toBeGreaterThanOrEqual(0); // not clipped
        expect(b.pop.r).toBeLessThanOrEqual(b.vw);
        expect(b.pop.b).toBeLessThanOrEqual(b.vh);
        expect(Math.abs(b.pop.r - b.chip.r) < 2 || Math.abs(b.pop.l - b.chip.l) < 2 || (b.pop.l <= b.chip.l && b.pop.r >= b.chip.r)).toBe(true); // anchored to its chip
        if (w === 390 && n === 1) await shot(page, 'pair-security-open-390-light');
        await page.keyboard.press('Escape');
        expect(await dd.evaluate((el) => el.shadowRoot!.activeElement?.className)).toContain('chip'); // focus returns
      }
      // the keyboard on the first chip: ArrowDown, ArrowDown, Enter picks the next section and navigates
      const first = await openChip(page, 0, 'key');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => location.hash)).toMatch(/^#\/investigate\//);
      void first;
      // and on the second chip
      await page.goto('about:blank');
      await openShell(page, '/security/live/wall', w);
      await setMode(page, 'dropdown');
      await openChip(page, 1, 'key');
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => location.hash)).not.toBe('#/security/live/wall'); // the last page of the section opened
    });

    test('multimedia: the area pages + the room filter in one row', async ({ page }) => {
      await openShell(page, '/multimedia/screens', w);
      await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).applyMultimediaKinds({ screens: 4, players: 3, groups: 1 }), NAV_URL);
      await setMode(page, 'dropdown');
      const p = await pair(page);
      expect(p).not.toBeNull();
      assertPair(p!);
      if (w === 390) await shot(page, 'pair-media-390-light');
      const dd = await openChip(page, 1, 'click');
      const b = await popBox(dd);
      expect(b.pop.t).toBeGreaterThanOrEqual(b.chip.b);
      expect(b.pop.l).toBeGreaterThanOrEqual(0);
      expect(b.pop.r).toBeLessThanOrEqual(b.vw);
      if (w === 390) await shot(page, 'pair-media-open-390-light');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // a room: filters the page
      await page.waitForTimeout(400);
      expect(await page.locator('multimedia-screens').evaluate((el) => !!el.shadowRoot!.querySelector('[data-rooms-in-shell]'))).toBe(true);
    });

    test('home: the area page chip + the areas of the floor in one row', async ({ page }) => {
      await openShell(page, '/devices/building', w);
      await setMode(page, 'dropdown');
      await page.evaluate(async () => {
        if (!customElements.get('devices-area-nav')) await import(/* @vite-ignore */ ['/src', 'screens', 'devices-area-nav.ts'].join('/'));
        const el = document.createElement('devices-area-nav') as HTMLElement & { areaId: string; areaName: string; floorName: string; areas: unknown };
        el.id = 'nav';
        el.areaId = 'a1';
        el.areaName = 'אזור 1';
        el.floorName = 'קומה 1';
        el.areas = Array.from({ length: 5 }, (_, i) => ({ area_id: `a${i + 1}`, name: `אזור ${i + 1}`, counts: { entities: i + 2 } }));
        el.style.display = 'none';
        document.body.appendChild(el);
      });
      await page.waitForTimeout(500);
      const p = await pair(page);
      expect(p).not.toBeNull();
      assertPair(p!);
      if (w === 390) await shot(page, 'pair-home-390-light');
      const dd = await openChip(page, 1, 'click');
      const b = await popBox(dd);
      expect(b.pop.t).toBeGreaterThanOrEqual(b.chip.b);
      expect(b.pop.r).toBeLessThanOrEqual(b.vw);
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => location.hash)).toBe('#/devices/areas/a5');
    });
  });
}

test.describe('the other shapes', () => {
  test('hybrid: the three sections keep their own bar row, the longer pages row is a dropdown (no pair)', async ({ page }) => {
    await openShell(page, '/security/live/wall', 390);
    await setMode(page, 'hybrid');
    const r = await page.locator('sw-app').evaluate((app) => {
      const root = app.shadowRoot!;
      const tabs = root.querySelector('sw-tabs[data-area-tabs]');
      return { pair: !!root.querySelector('.tabpair'), bar: !!root.querySelector('nav.secrow, nav.sectabs'), pagesVariant: tabs?.getAttribute('data-variant') ?? null };
    });
    expect(r.pair).toBe(false);
    expect(r.bar).toBe(true);
    expect(['dropdown', 'pill', 'underline-compact', 'underline']).toContain(r.pagesVariant);
    await shot(page, 'pair-security-hybrid-390-light');
  });

  test('a single group shows just one chip (settings: no second level)', async ({ page }) => {
    await openShell(page, '/system/notifications', 390);
    await setMode(page, 'dropdown');
    const r = await page.locator('sw-app').evaluate((app) => {
      const root = app.shadowRoot!;
      return { pair: !!root.querySelector('.tabpair'), chips: root.querySelectorAll('sw-tabs[data-area-tabs]').length, variant: root.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null };
    });
    expect(r).toEqual({ pair: false, chips: 1, variant: 'dropdown' });
  });

  test('default tabs: no pair, the rows as before', async ({ page }) => {
    await openShell(page, '/security/live/wall', 390);
    await setMode(page, 'tabs');
    expect(await page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelectorAll('.tabpair').length)).toBe(0);
  });

  test('vertical pixels above the content at 390 px, tabs vs dropdown (security, multimedia)', async ({ page }, info) => {
    const out: Record<string, Record<string, number>> = {};
    const top = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().top));
    // security: the first thing of the page below the chrome
    await openShell(page, '/security/live/wall', 390);
    await setMode(page, 'tabs');
    const secTabs = await page.locator('sw-app').evaluate((app) => Math.round(app.shadowRoot!.querySelector('.screen')!.getBoundingClientRect().top));
    await setMode(page, 'dropdown');
    const secDd = await page.locator('sw-app').evaluate((app) => Math.round(app.shadowRoot!.querySelector('.screen')!.getBoundingClientRect().top));
    out.security = { tabs: secTabs, dropdown: secDd };
    // multimedia: the first card
    await openShell(page, '/multimedia/screens', 390);
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).applyMultimediaKinds({ screens: 4, players: 3, groups: 1 }), NAV_URL);
    await setMode(page, 'tabs');
    const mmTabs = await top(page, 'media-screen-card');
    const mmScreenTabs = await page.locator('sw-app').evaluate((app) => Math.round(app.shadowRoot!.querySelector('.screen')!.getBoundingClientRect().top));
    await setMode(page, 'dropdown');
    const mmDd = await top(page, 'media-screen-card');
    const mmScreenDd = await page.locator('sw-app').evaluate((app) => Math.round(app.shadowRoot!.querySelector('.screen')!.getBoundingClientRect().top));
    out.multimedia = { tabs_first_card: mmTabs, dropdown_first_card: mmDd, tabs_screen_top: mmScreenTabs, dropdown_screen_top: mmScreenDd };
    console.log('VERTICAL_PIXELS_390 ' + JSON.stringify(out));
    info.annotations.push({ type: 'vertical-390', description: JSON.stringify(out) });
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, 'vertical-pixels-390.json'), JSON.stringify(out, null, 2));
    expect(secDd).toBeLessThan(secTabs);
    expect(mmDd).toBeLessThan(mmTabs);
  });
});
