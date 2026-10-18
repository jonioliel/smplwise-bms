import { test, expect, type Page } from '@playwright/test';
import { installAccessMock } from './access-control-mocks';
import { installBubbleMock } from './bubble-mocks';
import { ADMIN as MEDIA_ADMIN, fresh as freshMedia, install as installMedia } from './media-players-harness';
import { installTicketsMock } from './tickets-mocks';
import { DD_PLACE_DECLINED } from '../src/shell/dd-place-fit';

// 2.7.2: the header dropdown placement (`ui.dd_place` 1..4, shell/sw-app.ts) swept for real: every screen below x the four placements x
// desktop 1440 / tablet 1024 / phone 390, each on a MOCKED backend that guarantees the dropdown chips are present (`ui.tabs_mode` =
// dropdown is merged into the mock's product settings). A screen without chips FAILS (the old sweep returned early and asserted nothing).
// Measured from the DOM (bounding rectangles, the title as a text range):
//   - the chips never overlap the title, the floating search/status corner, or any other element of the page's top rows (buttons, links,
//     fields, selectors, tabs, headings: a deep walk through the screen's shadow roots);
//   - nothing is clipped outside the viewport and the page never scrolls sideways;
//   - RTL: the effective placement sits where it says (1 above the title, 2 at the far end, 3 after the title, 4 at the start edge);
//   - the effective placement (data-dd-place) is the one the screen supports: the deliberate per-screen fallbacks are in FALLBACK below.
// Needs the Vite DEV server (the media-players harness imports /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test tests/layout-dd-place.spec.ts --project=desktop --workers=1
// One project is enough: every test sets its own viewport. SW_DD_DUMP=1 prints the measured facts, SW_DD_SHOTS=<dir> saves a screenshot each.

type Place = '1' | '2' | '3' | '4';
const PLACES: readonly Place[] = ['1', '2', '3', '4'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

interface Screen {
  id: string;
  hash: string;
  /** the mocked backend for this screen */
  install: (page: Page) => Promise<unknown>;
  /** how many chips hang on the header at least (1 = one tab group, 2 = the pair) */
  chips: number;
}

const SCREENS: readonly Screen[] = [
  { id: 'wiskey', hash: '/wiskey/overview', install: (page) => installAccessMock(page), chips: 1 },
  { id: 'tickets', hash: '/tickets/mine', install: (page) => installTicketsMock(page, { persona: 'admin' }), chips: 1 },
  { id: 'settings', hash: '/system/tickets', install: (page) => installTicketsMock(page, { persona: 'admin' }), chips: 1 },
  { id: 'devices', hash: '/devices/areas/living', install: (page) => installBubbleMock(page), chips: 1 },
  { id: 'players', hash: '/multimedia/players', install: (page) => installMedia(page, freshMedia(MEDIA_ADMIN)), chips: 1 },
];

/** Deliberate fallbacks to placement 1 (shell/dd-place-fit.ts DD_PLACE_DECLINED, docs/release/2.7.2-DROPDOWN-NOTES.md): the settings pages have
 * their menu column at the start edge and the title under their own tab row, so 3 and 4 draw as 1 there (data-dd-fallback="declared").
 * Every other combination must be the real placement: a fallback by collision (data-dd-fallback="collision") on a swept screen is a bug. */
const FALLBACK: Record<string, readonly Place[]> = { settings: ['3', '4'] };
const DD_GAP = 12;

/** The mocked product settings / own prefs get the dropdown mode and the placement merged in (whatever else the screen's mock answers). */
async function overrideSettings(page: Page, place: Place, personal: boolean) {
  await page.addInitScript(
    ([p, own]) => {
      const orig = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await orig(input, init);
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method !== 'GET' || !res.ok) return res;
        const path = new URL(url, location.href).pathname;
        if (path.endsWith('/api/v1/settings')) {
          const body = (await res.clone().json()) as { settings?: Record<string, unknown> };
          const settings = { ...(body.settings ?? {}), 'ui.tabs_mode': 'dropdown', 'ui.dd_place': own ? '1' : p };
          return new Response(JSON.stringify({ ...body, settings }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (path.endsWith('/api/v1/me/prefs') && own) {
          const body = (await res.clone().json()) as { prefs?: Record<string, unknown>; stored?: string[] };
          const out = { ...body, prefs: { ...(body.prefs ?? {}), 'ui.dd_place': p }, stored: [...(body.stored ?? []), 'ui.dd_place'] };
          return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return res;
      };
      try {
        localStorage.removeItem('sw.dd.place');
        localStorage.removeItem('sw.tabs.mode');
      } catch {
        /* storage unavailable */
      }
    },
    [place, personal] as const,
  );
}

interface R {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
interface Facts {
  place: string | null;
  fallback: string | null;
  head: string | null;
  dir: string;
  rowH: number;
  chips: R[];
  title: R | null;
  corner: R | null;
  others: { what: string; r: R }[];
  vw: number;
  vh: number;
  overflow: boolean;
}

const facts = (page: Page): Promise<Facts> =>
  page.locator('sw-app').evaluate((app) => {
    const rect = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
    const root = app.shadowRoot!;
    const chipEls = [...root.querySelectorAll<HTMLElement>('.subnav[data-tabstyle="dropdown"] > sw-tabs, .tabpair:not(.single) > sw-tabs, .tabpair:not(.single) > sw-dropdown, .tabpair:not(.single) > a.alarmpin')];
    const chips = chipEls.map((e) => rect(e.getBoundingClientRect())).filter((r) => r.width > 0 && r.height > 0);
    const row = root.querySelector<HTMLElement>('.tabpair:not(.single), .subnav[data-tabstyle="dropdown"]');
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
    };
    const screen = root.querySelector('.screen') ?? root;
    let h1: HTMLElement | null = null;
    const SEL = 'h1,h2,h3,button,a[href],input,select,textarea,sw-dropdown,sw-tabs,[role="tab"],[role="combobox"],[role="button"],[role="search"]';
    const textRect = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      return t.width > 0 ? rect(t) : null;
    };
    const others: { what: string; r: ReturnType<typeof rect> }[] = [];
    const walk = (r: ParentNode, depth: number) => {
      for (const el of r.querySelectorAll<HTMLElement>('*')) {
        if (!h1 && el.localName === 'h1' && visible(el)) h1 = el;
        if (el.matches(SEL) && visible(el)) {
          const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          // a heading counts by its glyphs (a block heading's box can be far wider than its text)
          const box = /^h[1-3]$/.test(el.localName) ? textRect(el) : rect(el.getBoundingClientRect());
          if (box) others.push({ what: `${el.localName}${el.id ? '#' + el.id : ''}${cls}`, r: box });
        }
        if (el.shadowRoot && depth < 12) walk(el.shadowRoot, depth + 1);
      }
    };
    walk(screen, 0);
    const title = h1 ? textRect(h1) : null;
    const corner = root.querySelector<HTMLElement>('.float');
    const cornerR = corner && visible(corner) ? rect(corner.getBoundingClientRect()) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // only the page's top rows matter (the chips hang there); a container wider than half the viewport is not a header element
    const band = chips.length ? Math.max(...chips.map((c) => c.bottom)) + 8 : 0;
    const out = others.filter((o) => o.r.top < band && o.r.bottom > 0 && o.r.width < vw * 0.5);
    return {
      place: app.getAttribute('data-dd-place'),
      fallback: app.getAttribute('data-dd-fallback'),
      head: app.getAttribute('data-dd-head'),
      dir: getComputedStyle(document.documentElement).direction,
      rowH: row ? Math.round(row.getBoundingClientRect().height) : -1,
      chips,
      title,
      corner: cornerR,
      others: out,
      vw,
      vh,
      overflow: document.documentElement.scrollWidth > vw + 1,
    };
  });

async function stage(page: Page, s: Screen, vp: Viewport, place: Place, personal = false) {
  await s.install(page);
  await overrideSettings(page, place, personal);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`/?design=a#${s.hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  // the chips MUST be there (the mock guarantees a dropdown group): no silent pass when they are not
  await expect.poll(async () => (await facts(page)).chips.length, { message: `${s.id}: dropdown chips on the header`, timeout: 10_000 }).toBeGreaterThanOrEqual(s.chips);
  // the screen's heading is drawn after its data loads
  await expect.poll(async () => (await facts(page)).title !== null, { message: `${s.id}: the page title`, timeout: 10_000 }).toBe(true);
  // the collision check re-runs every 1.2 s while a screen loads: let it settle
  await page.waitForTimeout(1500);
}

const overlap = (a: R, b: R) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
const fmt = (r: R) => `[x ${Math.round(r.left)}..${Math.round(r.right)}, y ${Math.round(r.top)}..${Math.round(r.bottom)}]`;

function assertLayout(f: Facts, s: Screen, vp: Viewport, asked: Place) {
  expect(f.dir, 'the shell is RTL').toBe('rtl');
  expect(f.chips.length, `${s.id}: the dropdown chips are drawn`).toBeGreaterThanOrEqual(s.chips);
  expect(f.title, `${s.id}: the page title is drawn`).not.toBeNull();
  const title = f.title!;
  expect(f.overflow, 'no horizontal page overflow').toBe(false);
  const wide = vp.width >= 1100;
  const declined = !!FALLBACK[s.id]?.includes(asked);
  const expected: Place = declined ? '1' : asked;
  expect(f.fallback, `${s.id}: no fallback by collision, only the declared one`).toBe(declined ? 'declared' : null);
  expect(f.place, `${s.id}: the effective placement`).toBe(expected);
  for (const c of f.chips) {
    expect(c.left >= -0.5 && c.right <= f.vw + 0.5 && c.top >= -0.5 && c.bottom <= f.vh + 0.5, `chip ${fmt(c)} inside the ${f.vw}x${f.vh} viewport`).toBe(true);
    expect(overlap(c, title), `chip ${fmt(c)} over the title ${fmt(title)}`).toBe(false);
    if (f.corner) expect(overlap(c, f.corner), `chip ${fmt(c)} over the floating corner ${fmt(f.corner)}`).toBe(false);
    for (const o of f.others) expect(overlap(c, o.r), `chip ${fmt(c)} over ${o.what} ${fmt(o.r)}`).toBe(false);
  }
  if (f.corner) expect(overlap(title, f.corner), `title ${fmt(title)} under the corner ${fmt(f.corner)}`).toBe(false);
  // below 1100 px every placement draws as the own row (the dial is still read)
  const effective = wide ? expected : '1';
  const top = Math.min(...f.chips.map((c) => c.top));
  const bottom = Math.max(...f.chips.map((c) => c.bottom));
  const left = Math.min(...f.chips.map((c) => c.left));
  const right = Math.max(...f.chips.map((c) => c.right));
  const span = `the chips [x ${Math.round(left)}..${Math.round(right)}, y ${Math.round(top)}..${Math.round(bottom)}]`;
  if (effective === '1') {
    expect(f.rowH, 'placement 1 keeps its own row').toBeGreaterThan(0);
    expect(bottom <= title.top + 0.5, `placement 1: ${span} above the title ${fmt(title)}`).toBe(true);
    return;
  }
  expect(f.rowH, `placement ${effective} collapses the own row`).toBe(0);
  const sameRow = top < title.bottom && bottom > title.top;
  // RTL: the start is the right edge, the far end the left one
  if (effective === '2') {
    expect(left < f.vw / 2, `placement 2: ${span} in the far (left) half`).toBe(true);
    if (sameRow) expect(right <= title.left, `placement 2: ${span} past the title ${fmt(title)}`).toBe(true);
    // right beside the floating corner (it used to overlap it by 3-4 px)
    if (f.corner) expect(left - f.corner.right, `placement 2: ${span} a gap from the floating corner ${fmt(f.corner)}`).toBeLessThanOrEqual(DD_GAP + 2);
  }
  if (effective === '3') {
    expect(sameRow, `placement 3: ${span} on the title's row ${fmt(title)}`).toBe(true);
    expect(right <= title.left, `placement 3: ${span} after the title ${fmt(title)}`).toBe(true);
    // in the FIRST free gap past the title: the chips' near edge is a gap away from the title, or from a control that wraps or follows it
    const near = [title, ...f.others.map((o) => o.r)].filter((o) => o.left >= right - 0.5 && o.top < bottom && o.bottom > top).map((o) => o.left - right);
    expect(Math.min(...near), `placement 3: ${span} directly after the title or the controls that follow it`).toBeLessThanOrEqual(DD_GAP + 2);
  }
  if (effective === '4') {
    expect(right > f.vw / 2, `placement 4: ${span} in the start (right) half`).toBe(true);
    if (sameRow) expect(left >= title.right, `placement 4: ${span} at the start edge, before the title ${fmt(title)}`).toBe(true);
  }
}

for (const s of SCREENS) {
  for (const vp of VIEWPORTS) {
    for (const p of PLACES) {
      test(`${s.id} ${s.hash} at ${vp.name} ${vp.width}px, placement ${p}: chips present, no overlap, nothing clipped`, async ({ page }) => {
        await stage(page, s, vp, p);
        const f = await facts(page);
        if (process.env.SW_DD_DUMP) console.log(JSON.stringify({ s: s.id, vp: vp.name, p, f }));
        if (process.env.SW_DD_SHOTS) await page.screenshot({ path: `${process.env.SW_DD_SHOTS}/dd-${s.id}-p${p}-${vp.width}.png` });
        assertLayout(f, s, vp, p);
      });
    }
  }
}

test('the declared fallbacks are the shell table (DD_PLACE_DECLINED): settings declines 3 and 4, nothing else is declined', () => {
  expect(DD_PLACE_DECLINED).toEqual({ system: ['3', '4'] });
  expect(FALLBACK).toEqual({ settings: DD_PLACE_DECLINED.system });
});

test('a personal placement overrides the installation default (1): placement 4 on the WisKey center', async ({ page }) => {
  const s = SCREENS[0];
  await stage(page, s, VIEWPORTS[0], '4', true);
  assertLayout(await facts(page), s, VIEWPORTS[0], '4');
});

test('the safety net: a control that appears under a placed chip sends the route back to placement 1 (data-dd-fallback="collision")', async ({ page }) => {
  const s = SCREENS[0];
  await stage(page, s, VIEWPORTS[0], '4');
  expect(await page.locator('sw-app').getAttribute('data-dd-fallback')).toBeNull();
  // a button of the screen's own first row drawn exactly where the start-edge chip hangs
  await page.locator('sw-app').evaluate((app) => {
    const chip = app.shadowRoot!.querySelector('.subnav[data-tabstyle="dropdown"] > sw-tabs')!.getBoundingClientRect();
    const b = document.createElement('button');
    b.textContent = 'x';
    b.style.cssText = `position:fixed;left:${chip.left + 10}px;top:${chip.top + 4}px;width:40px;height:30px;z-index:1`;
    app.shadowRoot!.querySelector('.screen')!.appendChild(b);
  });
  await expect.poll(() => page.locator('sw-app').getAttribute('data-dd-fallback'), { timeout: 5000 }).toBe('collision');
  await expect(page.locator('sw-app')).toHaveAttribute('data-dd-place', '1');
});

test('the sweep fails when the chips are absent (the tab mode left at tabs)', async ({ page }) => {
  const s = SCREENS[0];
  await s.install(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?design=a#${s.hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await page.waitForTimeout(800);
  const f = await facts(page);
  expect(f.chips.length, 'tabs mode draws no dropdown chips').toBe(0);
  expect(() => assertLayout(f, s, VIEWPORTS[0], '1')).toThrow();
});
