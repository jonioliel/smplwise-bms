import { expect, type Locator, type Page } from '@playwright/test';

// Shared helpers of the "no transparency in any menu" specs (owner 2026-10-13): open the app in a skin and a scheme, and read what a menu
// surface REALLY paints - the computed background colour (its alpha), the blur behind it, and the opacity of it and of everything above it.

export const MENU_SKINS = ['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const;
export const MENU_SCHEMES = ['light', 'dark'] as const;
export type MenuSkin = (typeof MENU_SKINS)[number];
export type MenuScheme = (typeof MENU_SCHEMES)[number];

/** The alpha of a computed colour: `rgb(r, g, b)` = 1, `rgba(r, g, b, a)`, `rgb(r g b / a)` and `color(srgb r g b / a)` (how Chromium prints a color-mix()). NaN = not a colour. */
export function alphaOf(c: string): number {
  const s = c.trim();
  let m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length > 3 ? Number(p[3]) : 1;
  }
  m = /^color\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split('/');
    return parts.length > 1 ? Number(parts[1]) : 1;
  }
  return Number.NaN;
}

export interface MenuPaint {
  /** The computed background colour of the surface. */
  bg: string;
  bgAlpha: number;
  /** backdrop-filter and its -webkit- twin as computed ("none" = no blur). */
  blur: string;
  blurWebkit: string;
  /** The opacity of the surface times the opacity of every ancestor (shadow hosts included): 1 = nothing fades it. */
  effectiveOpacity: number;
  /** The menu token as the surface sees it, resolved to a computed colour (what a menu is meant to paint). */
  token: string;
  tokenAlpha: number;
  /** The hairline token resolved the same way. */
  borderToken: string;
}

/** What a surface paints right now (call after its open transition has finished). */
export async function paintOf(surface: Locator): Promise<MenuPaint> {
  const raw = await surface.evaluate((el) => {
    const cs = getComputedStyle(el);
    // resolve a custom-property value (a hex, an rgb(), a var() chain already substituted) to the colour the browser computes
    const resolve = (v: string): string => {
      const probe = document.createElement('i');
      probe.style.cssText = 'position:fixed;inset-block-start:-9999px;color:' + (v.trim() || 'transparent');
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    let o = 1;
    let n: Node | null = el;
    while (n) {
      if (n instanceof Element) o *= parseFloat(getComputedStyle(n).opacity || '1');
      const parent: Node | null = n.parentNode;
      n = parent instanceof ShadowRoot ? parent.host : parent;
    }
    return {
      bg: cs.backgroundColor,
      blur: cs.getPropertyValue('backdrop-filter') || (cs as unknown as Record<string, string>).backdropFilter || 'none',
      blurWebkit: cs.getPropertyValue('-webkit-backdrop-filter') || 'none',
      effectiveOpacity: o,
      token: resolve(cs.getPropertyValue('--sw-menu-surface')),
      borderToken: resolve(cs.getPropertyValue('--sw-menu-border')),
    };
  });
  return { ...raw, bgAlpha: alphaOf(raw.bg), tokenAlpha: alphaOf(raw.token) };
}

/** The one assertion: this surface is opaque, un-blurred, un-faded and painted with the menu token. */
export async function expectOpaqueMenu(surface: Locator, label: string): Promise<MenuPaint> {
  // an open transition (opacity / transform, 200 ms) is over when the surface is not faded any more
  await expect.poll(async () => (await paintOf(surface)).effectiveOpacity, { message: `${label}: still fading in`, timeout: 4000 }).toBe(1);
  const p = await paintOf(surface);
  expect(p.tokenAlpha, `${label}: the menu token itself is opaque (${p.token})`).toBe(1);
  expect(p.bgAlpha, `${label}: background ${p.bg} must have alpha 1`).toBe(1);
  expect(p.bg, `${label}: painted with --sw-menu-surface (${p.token})`).toBe(p.token);
  expect(p.blur, `${label}: no backdrop-filter`).toBe('none');
  expect(p.blurWebkit, `${label}: no -webkit-backdrop-filter`).toBe('none');
  expect(p.effectiveOpacity, `${label}: nothing above it fades it`).toBe(1);
  return p;
}

/** Opens the app on a route in a skin and scheme (demo mode, fixed clock, performance dial full so no tier changes the paint). */
export async function openApp(page: Page, skin: MenuSkin, scheme: MenuScheme, hash: string, query = ''): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}&look=performance:full${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-skin') !== null);
}
