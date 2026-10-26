import { test, expect, type Page } from '@playwright/test';
import { skinsUnderTest } from './helpers/frozen-skins';

// BGFIX-293 (owner 2026-10-20): ONE page background on every screen - the shell's skin canvas (sw-app), as the security screen shows it.
// The bug: the glass screens (חשמל והתקנים with devices.style=glass, schedules, automations, multimedia, tickets, the notification
// settings) painted their palette's --dv-backdrop over the skin canvas: an opaque second page background ("a background on a background").
//
// The guard: per route, walk from the shell's <main> down through shadow roots and fail on any element that covers >= 90% of the visible
// content area and paints a background (colour with alpha, image) or a backdrop-filter. Cards, tables and map stages are content and
// stay under that share; the one allow-listed full-bleed surface is the WisKey frame's stage (an embedded application's own canvas).
// Every devices host is switched to the glass style first (the owner's installation; demo mode defaults to "smplwise").
// Demo mode (no backend):  SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/layout-page-background.spec.ts --project=desktop
// Without PAGE_BG_FULL=1 one skin with a canvas of its own (domus) is swept in light + dark; with it, every skin.

const FULL = !!process.env.PAGE_BG_FULL;
const SKINS = FULL ? skinsUnderTest(['classic', 'domus', 'bubble', 'crystal', 'tesla']) : ['domus'];
const SCHEMES = ['light', 'dark'] as const;

const ROUTES = [
  '#/security', '#/security/alarm', '#/live', '#/live/wall', '#/live/views',
  '#/devices/building', '#/devices/areas/lobby', '#/devices/schedules', '#/devices/automations',
  '#/explore/sites', '#/explore/floors/f0',
  '#/infra/electricity/meters', '#/infra/elevators', '#/infra/generator/live',
  '#/investigate/cases', '#/investigate/events', '#/investigate/exports', '#/investigate/floors/f0/history', '#/investigate/health',
  '#/investigate/playback', '#/investigate/playback/sync', '#/investigate/reviews', '#/investigate/rules', '#/investigate/search',
  '#/multimedia/cast', '#/multimedia/groups', '#/multimedia/players', '#/multimedia/screens',
  '#/system/access', '#/system/access-control', '#/system/audit', '#/system/automations', '#/system/devices', '#/system/diagnostics',
  '#/system/entities', '#/system/infra', '#/system/messaging-accounts', '#/system/multimedia', '#/system/notifications', '#/system/schedules',
  '#/system/security', '#/system/security/cameras', '#/system/security/manage', '#/system/security/nvr', '#/system/setup', '#/system/storage',
  '#/system/tickets', '#/system/update', '#/system/wall', '#/system/wizard',
  '#/tickets/accounts', '#/tickets/all', '#/tickets/board', '#/tickets/department', '#/tickets/handlers', '#/tickets/mine', '#/tickets/overview', '#/tickets/rfqs',
  '#/wiskey/audit', '#/wiskey/devices', '#/wiskey/events', '#/wiskey/overview', '#/wiskey/people', '#/wiskey/schedules', '#/wiskey/sync', '#/wiskey/tools',
];

/** Page-level surfaces that are content of their own, not a page background (tag.class as the walker names them). */
const ALLOWED = [/^wiskey-embed > div\.stage/, /^div\.stage > div\.over$/];

interface Layer { el: string; cover: number; bg: string; img: string; bf: string }

/** Switches every devices host to the glass style (as devices.style=glass does) - the attribute the paint rules key on. */
async function forceGlass(page: Page) {
  await page.evaluate(() => {
    const walk = (root: Document | ShadowRoot) => {
      for (const x of root.querySelectorAll('*')) {
        if (x.hasAttribute('data-devices-style')) x.setAttribute('data-devices-style', 'glass');
        if (x.shadowRoot) walk(x.shadowRoot);
      }
    };
    walk(document);
  });
}

/** Every element under <main> that covers >= 90% of the visible content area and paints something. */
async function pageLayers(page: Page): Promise<Layer[] | null> {
  return page.evaluate(() => {
    const app = document.querySelector('sw-app');
    const main = app?.shadowRoot?.querySelector('main');
    if (!main) return null;
    const m = main.getBoundingClientRect();
    const v = { x0: Math.max(m.left, 0), y0: Math.max(m.top, 0), x1: Math.min(m.right, innerWidth), y1: Math.min(m.bottom, innerHeight) };
    const area = Math.max(1, (v.x1 - v.x0) * (v.y1 - v.y0));
    const out: { el: string; cover: number; bg: string; img: string; bf: string }[] = [];
    const seen = new Set<Element>();
    const visit = (el: Element, parent: string) => {
      if (seen.has(el)) return;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, v.x1) - Math.max(r.left, v.x0));
      const iy = Math.max(0, Math.min(r.bottom, v.y1) - Math.max(r.top, v.y0));
      const cover = (ix * iy) / area;
      if (cover < 0.9) return; // nothing smaller can hold a page-level layer
      const name = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
      const mm = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
      const parts = mm ? mm[1].split(/[ ,/]+/).filter(Boolean) : [];
      const alpha = !mm ? 0 : parts.length > 3 ? Number(parts[3]) : 1;
      const bf = cs.backdropFilter || 'none';
      if (!/^(video|canvas|img|svg|iframe)/.test(name) && (alpha > 0 || cs.backgroundImage !== 'none' || bf !== 'none'))
        out.push({ el: `${parent} > ${name}`, cover: Number(cover.toFixed(2)), bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 80), bf });
      if (el.shadowRoot) for (const c of el.shadowRoot.children) visit(c, name);
      for (const c of el.children) visit(c, name);
      if (el instanceof HTMLSlotElement) for (const c of el.assignedElements({ flatten: true })) visit(c, name);
    };
    for (const c of main.children) visit(c, 'main');
    return out;
  });
}

for (const skin of SKINS) {
  for (const scheme of SCHEMES) {
    test(`every screen shows the shell canvas as its only page background - ${skin} ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone widths cover it');
      test.setTimeout(ROUTES.length * 6_000 + 30_000);
      await page.goto(`./?skin=${skin}&scheme=${scheme}#/security`);
      await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('main'));
      const bad: string[] = [];
      for (const route of ROUTES) {
        await page.evaluate((h) => (location.hash = h), route);
        await page.waitForTimeout(1500);
        await forceGlass(page);
        await page.waitForTimeout(150);
        const layers = await pageLayers(page);
        expect(layers, `${route}: the shell's <main> is missing`).not.toBeNull();
        for (const l of layers ?? []) if (!ALLOWED.some((a) => a.test(l.el))) bad.push(`${route}: ${l.el} (cover ${l.cover}) bg ${l.bg} img ${l.img} backdrop-filter ${l.bf}`);
      }
      expect(bad, 'screens that paint a page background of their own over the skin canvas').toEqual([]);
    });
  }
}

test('a glass area whose scheme differs from the product keeps its own backdrop (readability)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one width is enough');
  await page.goto('./?skin=domus&scheme=light#/devices/building');
  await page.waitForTimeout(2000);
  const paint = (own: boolean) =>
    page.evaluate((own) => {
      const find = (root: Document | ShadowRoot, sel: string): Element | null => {
        const e = root.querySelector(sel);
        if (e) return e;
        for (const x of root.querySelectorAll('*')) if (x.shadowRoot) { const f = find(x.shadowRoot, sel); if (f) return f; }
        return null;
      };
      const host = find(document, 'devices-building') as HTMLElement;
      host.setAttribute('data-devices-style', 'glass');
      host.setAttribute('data-devices-scheme', own ? 'dark' : 'light');
      host.toggleAttribute('data-devices-own-backdrop', own);
      const sp = host.shadowRoot!.querySelector('sw-page')!;
      return getComputedStyle(sp).backgroundImage;
    }, own);
  expect(await paint(false)).toBe('none');
  expect(await paint(true)).toContain('gradient');
});
