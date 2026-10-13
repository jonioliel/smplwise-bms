import { expect, type Locator, type Page } from '@playwright/test';
import { MENU_SCHEMES, MENU_SKINS, alphaOf, expectOpaqueMenu, openApp, paintOf, type MenuPaint, type MenuScheme, type MenuSkin } from './menu-opaque-harness';

// Shared helpers of the "HUD panels over the plan are opaque" specs (owner 2026-10-13, second report): a HUD panel is read in the browser like a
// menu is (tests/menu-opaque-harness.ts: the computed background alpha, the blur, the opacity chain, the paint IS the menu token), and its text
// is measured: every text the panel carries against the opaque colour it really stands on, at the WCAG ratio (4.5, 3 for large text).

export { MENU_SCHEMES, MENU_SKINS, openApp };
export type { MenuScheme, MenuSkin };

/** One text of a panel and how it reads. */
export interface InkReading {
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  need: number;
  size: number;
}

/** Waits until the page's main thread answers quickly again: the 3D scene build, the thumbnail pass and the realistic level's post chain run on it
 * (software GL on the runner and on a workstation), and a measurement taken meanwhile waits behind them for seconds. Three animation frames in a
 * row under 400 ms = calm. */
export async function whenQuiet(page: Page, timeoutMs = 150_000): Promise<void> {
  const t0 = Date.now();
  let calm = 0;
  while (Date.now() - t0 < timeoutMs) {
    const s = Date.now();
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
    calm = Date.now() - s < 400 ? calm + 1 : 0;
    if (calm >= 3) return;
  }
  throw new Error(`the page did not settle within ${timeoutMs} ms`);
}

/** What a panel's texts read like (an empty `texts` = the panel carries none): every text node of the panel in the FLAT tree (shadow roots entered,
 * slotted text read from its slot), its used colour against the opaque stack of backgrounds under it. A text in a disabled control or inside a faded
 * ancestor is skipped (WCAG exempts a disabled control; a fade is not a colour) and counted. */
export async function inkOf(surface: Locator): Promise<{ texts: InkReading[]; skipped: number; unparsed: string[] }> {
  return surface.evaluate((root) => {
    type RGBA = [number, number, number, number];
    const unparsed: string[] = [];
    const parse = (c: string): RGBA | null => {
      const s = c.trim();
      let m = /^rgba?\(([^)]+)\)$/i.exec(s);
      if (m) {
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      }
      m = /^color\(srgb ([^)]+)\)$/i.exec(s);
      if (m) {
        const [rgb, a] = m[1].split('/');
        const p = rgb.trim().split(/\s+/).map(Number);
        return [p[0] * 255, p[1] * 255, p[2] * 255, a === undefined ? 1 : Number(a)];
      }
      // a color-mix() prints as oklab() / oklch() in Chromium: convert to sRGB (Ottosson's matrices)
      m = /^(oklab|oklch)\(([^)]+)\)$/i.exec(s);
      if (m) {
        const [lab, a] = m[2].split('/');
        const q = lab.trim().split(/\s+/).map((v) => (v === 'none' ? 0 : parseFloat(v)));
        let [L, A, B] = q;
        if (m[1].toLowerCase() === 'oklch') {
          const h = (q[2] * Math.PI) / 180;
          A = q[1] * Math.cos(h);
          B = q[1] * Math.sin(h);
        }
        const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
        const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
        const ss = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
        const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss];
        const g = lin.map((v) => Math.min(255, Math.max(0, 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055))));
        return [g[0], g[1], g[2], a === undefined ? 1 : Number(a)];
      }
      if (s === 'transparent') return [0, 0, 0, 0];
      unparsed.push(c);
      return null;
    };
    const over = (f: RGBA, b: RGBA): RGBA => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1) as RGBA;
    const lum = (c: RGBA) => {
      const [r, g, b] = [c[0], c[1], c[2]].map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    /** The flat-tree parent: the slot a node is assigned to, the host of a shadow root, else the parent. */
    const up = (n: Node): Node | null => {
      const slot = (n as Element).assignedSlot;
      if (slot) return slot;
      const p = n.parentNode;
      return p instanceof ShadowRoot ? p.host : p;
    };
    // the elements whose text is read: the owner of every non-blank text node (a slot for slotted text)
    const owners: Element[] = [];
    const walk = (el: Element) => {
      const kids: Node[] = el.shadowRoot ? [...el.shadowRoot.childNodes] : [...el.childNodes];
      for (const n of kids) {
        if (n.nodeType === 3) {
          if ((n.textContent ?? '').trim()) owners.push(el);
        } else if (n.nodeType === 1) {
          const e = n as Element;
          if (e.tagName === 'SLOT') {
            for (const a of (e as HTMLSlotElement).assignedNodes({ flatten: true })) {
              if (a.nodeType === 3) {
                if ((a.textContent ?? '').trim()) owners.push(e);
              } else if (a.nodeType === 1) walk(a as Element);
            }
          } else walk(e);
        }
      }
    };
    walk(root as Element);
    let skipped = 0;
    const out: InkReading[] = [];
    for (const el of new Set(owners)) {
      // skip disabled controls and anything inside a faded ancestor
      let skip = false;
      let fade = 1;
      for (let n: Node | null = el; n; n = up(n)) {
        if (!(n instanceof Element)) continue;
        if (n.hasAttribute('disabled') || n.getAttribute('aria-disabled') === 'true') skip = true;
        fade *= parseFloat(getComputedStyle(n).opacity || '1');
      }
      const cs0 = getComputedStyle(el);
      if (el.getClientRects().length === 0 && el.tagName !== 'SLOT') continue; // not laid out
      if (cs0.visibility === 'hidden') continue;
      if (skip || fade < 0.999) {
        skipped++;
        continue;
      }
      // the opaque stack under the text: collect backgrounds upwards until one is opaque, composite them back down
      const stack: RGBA[] = [];
      for (let n: Node | null = el; n; n = up(n)) {
        if (!(n instanceof Element)) continue;
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg && bg[3] > 0) stack.push(bg);
        if (bg && bg[3] >= 0.999) break;
      }
      let under: RGBA = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i--) under = over(stack[i], under);
      const fg0 = parse(cs0.color);
      if (!fg0) continue;
      const fg = over(fg0, under);
      const size = parseFloat(cs0.fontSize);
      const bold = Number(cs0.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const texts = (el.tagName === 'SLOT' ? (el as HTMLSlotElement).assignedNodes({ flatten: true }).map((a) => a.textContent ?? '').join(' ') : [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent ?? '').join(' ')).trim();
      out.push({ text: texts.slice(0, 40), fg: `rgb(${fg.slice(0, 3).map(Math.round).join(', ')})`, bg: `rgb(${under.slice(0, 3).map(Math.round).join(', ')})`, ratio: Math.round(ratio(fg, under) * 100) / 100, need: large ? 3 : 4.5, size });
    }
    return { texts: out, skipped, unparsed };
  });
}

/** The one assertion for the text of a panel: every reading passes its ratio. */
export async function expectReadable(surface: Locator, label: string): Promise<InkReading[]> {
  const r = await inkOf(surface);
  expect(r.unparsed, `${label}: every colour of the panel parses`).toEqual([]);
  const bad = r.texts.filter((t) => t.ratio < t.need);
  expect(bad, `${label}: text under ${bad.length ? bad[0].need : 4.5}:1 on its fill - ${bad.map((t) => `"${t.text}" ${t.fg} on ${t.bg} = ${t.ratio}`).join('; ')}`).toEqual([]);
  return r.texts;
}

/** A HUD panel painted with the menu surface: opaque, un-blurred, un-faded, its paint IS the token - and its text reads. `readable: false` for a panel
 * with no text of its own (the 2D canvas' zoom buttons are icons). */
export async function expectOpaqueHud(surface: Locator, label: string, readable = true): Promise<MenuPaint> {
  const p = await expectOpaqueMenu(surface, label);
  if (readable) await expectReadable(surface, label);
  return p;
}

/** A shared control (sw-chip / sw-button) on a bar that re-points the surface token: its inner button is opaque in every state. `token: false` for a
 * state whose fill is not the menu surface itself (the accent of a selected chip, the hover wash of the bar). */
export async function expectOpaqueControl(button: Locator, label: string, opts: { token?: boolean } = {}): Promise<MenuPaint> {
  await expect(button, `${label}: visible`).toBeVisible();
  const p = await paintOf(button);
  expect(p.bgAlpha, `${label}: background ${p.bg} must have alpha 1`).toBe(1);
  if (opts.token !== false) expect(p.bg, `${label}: painted with --sw-menu-surface (${p.token})`).toBe(p.token);
  expect(p.blur, `${label}: no backdrop-filter`).toBe('none');
  return p;
}

/** The computed `fill` of an SVG label pill: opaque (alpha 1) and the menu token. */
export async function expectOpaqueFill(shape: Locator, label: string): Promise<void> {
  await expect(shape.first(), `${label}: attached`).toBeAttached();
  const r = await shape.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('i');
    probe.style.cssText = 'position:fixed;inset-block-start:-9999px;color:' + (cs.getPropertyValue('--sw-menu-surface').trim() || 'transparent');
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    return { fill: cs.fill, opacity: cs.fillOpacity, token };
  });
  expect(alphaOf(r.fill), `${label}: fill ${r.fill} must have alpha 1`).toBe(1);
  expect(Number(r.opacity), `${label}: fill-opacity`).toBe(1);
  expect(r.fill, `${label}: filled with --sw-menu-surface (${r.token})`).toBe(r.token);
}
