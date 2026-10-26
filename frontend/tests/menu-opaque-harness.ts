import { expect, type Locator, type Page } from '@playwright/test';
import { skinsUnderTest } from './helpers/frozen-skins';

// Shared helpers of the "no transparency in any menu" specs (owner 2026-10-13): open the app in a skin and a scheme, and read what a menu
// surface REALLY paints - the computed background colour (its alpha), the blur behind it, and the opacity of it and of everything above it.

export const MENU_SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
export const MENU_SCHEMES = ['light', 'dark'] as const;
export type MenuSkin = (typeof MENU_SKINS)[number];
export type MenuScheme = (typeof MENU_SCHEMES)[number];

/** The alpha of a computed colour: `rgb(r, g, b)` = 1, `rgba(r, g, b, a)`, `rgb(r g b / a)`, and the colour functions Chromium prints for a color-mix()
 * (`color(srgb r g b / a)`, `oklab(L a b / a)`, `oklch`, `lab`, `lch`, `hsl`, `hwb`): the part after the slash, else 1. NaN = not a colour. */
export function alphaOf(c: string): number {
  const s = c.trim();
  let m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length > 3 ? Number(p[3]) : 1;
  }
  m = /^(?:color|oklab|oklch|lab|lch|hsla?|hwb)\(([^)]+)\)$/i.exec(s);
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
  // the menu really is open and on screen (a closed menu would be "opaque" for free)
  await expect(surface, `${label}: the menu is open and visible`).toBeVisible();
  // an open transition (opacity / transform, 200 ms) is over when the surface is not faded any more
  await expect.poll(async () => (await paintOf(surface)).effectiveOpacity, { message: `${label}: still fading in`, timeout: 15000 }).toBe(1);
  const p = await paintOf(surface);
  expect(p.tokenAlpha, `${label}: the menu token itself is opaque (${p.token})`).toBe(1);
  expect(p.bgAlpha, `${label}: background ${p.bg} must have alpha 1`).toBe(1);
  expect(p.bg, `${label}: painted with --sw-menu-surface (${p.token})`).toBe(p.token);
  expect(p.blur, `${label}: no backdrop-filter`).toBe('none');
  expect(p.blurWebkit, `${label}: no -webkit-backdrop-filter`).toBe('none');
  expect(p.effectiveOpacity, `${label}: nothing above it fades it`).toBe(1);
  return p;
}

/** Parses the colour a probe element computes for a CSS colour string (hex or rgb()) into the browser's `rgb(r, g, b)` text. */
export const rgbText = (hex: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgb(${parseInt(m[1].slice(0, 2), 16)}, ${parseInt(m[1].slice(2, 4), 16)}, ${parseInt(m[1].slice(4, 6), 16)})`;
};

/** A stage over the app with `sw-tabs` in dropdown form, one per dd-style (the dropdown's own harness, as dropdown-styles-b.spec.ts uses it). */
export async function mountDropdowns(page: Page, styles: readonly string[], n = 6): Promise<void> {
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.evaluate(
    ([list, count]) => {
      document.querySelectorAll('#stage').forEach((e) => e.remove());
      const st = document.createElement('div');
      st.id = 'stage';
      st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:flex-start';
      document.body.appendChild(st);
      const words = ['סלון', 'מטבח', 'חדר שינה', 'משרד', 'מרפסת', 'חצר', 'מחסן', 'חדר כביסה'];
      const items = Array.from({ length: count as number }, (_, i) => ({ id: `i${i}`, label: words[i % words.length], ...(i === 0 ? { count: 6 } : {}) }));
      for (const s of list as string[]) {
        const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
        t.setAttribute('variant', 'dropdown');
        t.setAttribute('dd-style', s);
        t.setAttribute('group-label', 'אבטחה');
        t.setAttribute('data-t', s);
        t.items = items;
        t.active = 'i0';
        st.appendChild(t);
      }
    },
    [styles as string[], n] as [string[], number],
  );
  await page.waitForTimeout(300);
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
