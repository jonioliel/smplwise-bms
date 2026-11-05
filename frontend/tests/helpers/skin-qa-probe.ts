import type { Locator, Page } from '@playwright/test';
import { createRequire } from 'node:module';

// SKIN-QA-2403: the measuring tools of the skin x scheme layout / evidence spec (tests/layout-skin-qa-2403.spec.ts).
//
// Contrast is measured on the RENDERED page, not on the token model: the glass skins (domus, crystal, soft) draw translucent surfaces
// over a gradient canvas, so the background of a word is only known once it is painted. For every visible text (and every icon, for the
// non-text 3:1 rule) under a root - walked through the shadow roots and the slotted light DOM - the text's colour, its opacity and its
// size are read; then ONE screenshot is taken with every glyph made transparent (a stylesheet adopted into the document and every shadow
// root), and the background pixels inside each text's own box are compared with the text colour composited over them (WCAG 2.x relative
// luminance). The ratio kept for a text is its second-lowest sample (a single border pixel crossing the box does not decide it).

type PNGLike = { width: number; height: number; data: Buffer };
type PNGMod = { sync: { read: (b: Buffer) => PNGLike } } | null;
let PNG: PNGMod = null;
try {
  PNG = (createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as { PNG: PNGMod }).PNG;
} catch {
  PNG = null;
}

export interface TextTarget {
  key: string;
  text: string;
  /** rgba of the glyphs */
  color: [number, number, number, number];
  /** the product of the opacities of the element and its flat-tree ancestors */
  opacity: number;
  size: number;
  weight: number;
  /** 'text' (4.5 / 3 for large text) or 'icon' (3, non-text contrast) */
  kind: 'text' | 'icon';
  rect: { x: number; y: number; w: number; h: number };
  /** the text overflows its own box (cut, or ended with an ellipsis) */
  cut: boolean;
  ellipsis: boolean;
}

export interface ContrastRow {
  key: string;
  text: string;
  kind: 'text' | 'icon';
  ratio: number;
  need: number;
  size: number;
  weight: number;
  cut: boolean;
  ellipsis: boolean;
}

const lin = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
export const lum = (c: readonly number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a: readonly number[], b: readonly number[]) => {
  const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
};
/** `fg` (rgba, alpha 0-1) composited over the opaque `bg`. */
export const over = (fg: readonly number[], bg: readonly number[]) => {
  const a = fg[3] ?? 1;
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};
export const parseRgba = (s: string): [number, number, number, number] => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0, 0];
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p.length > 3 ? p[3] : 1];
};

/** Every visible text (and icon) under `root`, through shadow roots and slotted children. Runs in the page. */
export async function collectTargets(root: Locator, opts: { icons?: boolean; skip?: string } = {}): Promise<TextTarget[]> {
  return root.evaluate(
    (rootEl, o) => {
      const out: TextTarget[] = [];
      const vw = innerWidth;
      const vh = innerHeight;
      const flatParent = (el: Element): Element | null => (el.assignedSlot as Element | null) ?? el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);
      const opacityOf = (el: Element) => {
        let op = 1;
        for (let e: Element | null = el; e; e = flatParent(e)) op *= Number(getComputedStyle(e).opacity || '1');
        return op;
      };
      const exempt = (el: Element) => {
        for (let e: Element | null = el; e; e = flatParent(e)) {
          if (e.matches(':disabled, [aria-disabled="true"], [inert], [hidden]')) return true;
          if (o.skip && e.matches(o.skip)) return true;
        }
        return false;
      };
      const name = (el: Element) => {
        const parts: string[] = [];
        for (let e: Element | null = el, n = 0; e && n < 4; e = flatParent(e), n++) {
          const id = e.getAttribute('data-fold-toggle') ?? e.getAttribute('data-access-fold') ?? e.getAttribute('data-wall-key') ?? '';
          parts.unshift(`${e.tagName.toLowerCase()}${e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''}${id ? `[${id}]` : ''}`);
        }
        return parts.join('>');
      };
      const visible = (r: DOMRect) => r.width > 0.5 && r.height > 0.5 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
      // `styleEl`: where the glyphs take their style from - a slotted text node inherits from its slot (the flat tree), not from the
      // light-DOM element that holds it (sw-button's label is drawn in the button's own colour)
      const push = (el: Element, rect: DOMRect, text: string, kind: 'text' | 'icon', styleEl: Element = el) => {
        const cs = getComputedStyle(styleEl);
        if (cs.visibility === 'hidden') return;
        const fill = cs.getPropertyValue('-webkit-text-fill-color');
        const colorStr = kind === 'text' && fill && !fill.includes('rgba(0, 0, 0, 0)') && fill !== cs.color ? fill : cs.color;
        const m = colorStr.match(/rgba?\(([^)]+)\)/);
        const p = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : [0, 0, 0, 1];
        const color: [number, number, number, number] = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        const host = el as HTMLElement;
        const own = getComputedStyle(el);
        const cut = kind === 'text' && (own.overflow.includes('hidden') || own.overflowX === 'hidden' || own.overflow.includes('clip')) && host.scrollWidth > host.clientWidth + 1;
        const x = Math.max(0, rect.left);
        const y = Math.max(0, rect.top);
        out.push({
          key: name(el),
          text: text.replace(/\s+/g, ' ').trim().slice(0, 48),
          color,
          opacity: opacityOf(styleEl),
          size: parseFloat(cs.fontSize) || 0,
          weight: Number(cs.fontWeight) || 400,
          kind,
          rect: { x, y, w: Math.min(vw, rect.right) - x, h: Math.min(vh, rect.bottom) - y },
          cut,
          ellipsis: own.textOverflow === 'ellipsis' && cut,
        });
      };
      const walk = (node: Element | ShadowRoot) => {
        const kids = node instanceof ShadowRoot ? [...node.children] : [...node.children];
        if (!(node instanceof ShadowRoot)) {
          const el = node;
          if (el.matches('style, script, template, svg, option')) return;
          if (!exempt(el)) {
            if (el.matches('select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=hidden]), textarea')) {
              const r = el.getBoundingClientRect();
              const txt = el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? '' : (el as HTMLInputElement).value;
              const cs = getComputedStyle(el);
              if (txt.trim() && visible(r) && Number(cs.opacity) > 0.05) {
                const pad = parseFloat(cs.paddingInlineStart || '0') || 4;
                push(el, new DOMRect(r.left + pad, r.top + r.height * 0.25, Math.max(4, r.width - 2 * pad - 18), r.height * 0.5), txt, 'text');
              }
            } else if (o.icons && el.tagName === 'SW-ICON') {
              const r = el.getBoundingClientRect();
              if (visible(r)) push(el, r, `icon:${el.getAttribute('name') ?? ''}`, 'icon');
            } else {
              for (const n of el.childNodes) {
                if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? '').trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(n);
                const rects = [...range.getClientRects()].filter(visible);
                if (!rects.length) continue;
                const l = Math.min(...rects.map((r) => r.left));
                const t = Math.min(...rects.map((r) => r.top));
                const rr = Math.max(...rects.map((r) => r.right));
                const b = Math.max(...rects.map((r) => r.bottom));
                push(el, new DOMRect(l, t, rr - l, b - t), n.textContent ?? '', 'text', (n as Text).assignedSlot ?? el);
              }
            }
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        }
        for (const k of kids) walk(k);
      };
      walk(rootEl);
      return out;
    },
    { icons: !!opts.icons, skip: opts.skip ?? '' },
  );
}

const HIDE_CSS = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
  caret-color: transparent !important; transition: none !important; } sw-icon, svg { visibility: hidden !important; }`;

/** Every glyph and icon transparent (document + every shadow root), or back. */
async function hideGlyphs(page: Page, on: boolean) {
  await page.evaluate(
    ([css, enable]) => {
      const w = window as unknown as { __skinQaSheet?: CSSStyleSheet };
      if (!w.__skinQaSheet) {
        w.__skinQaSheet = new CSSStyleSheet();
        w.__skinQaSheet.replaceSync(css as string);
      }
      const sheet = w.__skinQaSheet;
      const roots: (Document | ShadowRoot)[] = [document];
      const walk = (n: Element | ShadowRoot | Document) => {
        for (const el of (n as ParentNode).querySelectorAll('*')) {
          if (el.shadowRoot) {
            roots.push(el.shadowRoot);
            walk(el.shadowRoot);
          }
        }
      };
      walk(document);
      for (const r of roots) {
        const list = r.adoptedStyleSheets.filter((s) => s !== sheet);
        r.adoptedStyleSheets = enable ? [...list, sheet] : list;
      }
    },
    [HIDE_CSS, on] as const,
  );
}

/** The contrast of every target, measured against the rendered background (see the header). */
export async function measureContrast(page: Page, targets: TextTarget[]): Promise<ContrastRow[]> {
  if (!targets.length || !PNG) return [];
  await hideGlyphs(page, true);
  await page.waitForTimeout(60);
  let png: PNGLike;
  try {
    png = PNG.sync.read(await page.screenshot({ scale: 'css', animations: 'disabled' }));
  } finally {
    await hideGlyphs(page, false);
  }
  const px = (x: number, y: number) => {
    const X = Math.max(0, Math.min(png.width - 1, Math.round(x)));
    const Y = Math.max(0, Math.min(png.height - 1, Math.round(y)));
    const i = (Y * png.width + X) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  const rows: ContrastRow[] = [];
  for (const t of targets) {
    const fg = [t.color[0], t.color[1], t.color[2], t.color[3] * t.opacity];
    if (fg[3] < 0.02) continue;
    const samples: number[] = [];
    const cols = Math.max(3, Math.min(8, Math.round(t.rect.w / 12)));
    for (let i = 0; i < cols; i++) {
      for (const fy of [0.3, 0.5, 0.7]) {
        const bg = px(t.rect.x + 1 + ((t.rect.w - 2) * (i + 0.5)) / cols, t.rect.y + t.rect.h * fy);
        samples.push(ratio(over(fg, bg), bg));
      }
    }
    samples.sort((a, b) => a - b);
    const r = samples[Math.min(1, samples.length - 1)];
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    rows.push({ key: t.key, text: t.text, kind: t.kind, ratio: Math.round(r * 100) / 100, need: t.kind === 'icon' || large ? 3 : 4.5, size: t.size, weight: t.weight, cut: t.cut, ellipsis: t.ellipsis });
  }
  return rows;
}

/** One background pixel colour (css px) of the page as rendered now, with the glyphs hidden. */
export async function pixelAt(page: Page, x: number, y: number, hide = true): Promise<number[]> {
  if (!PNG) return [0, 0, 0];
  if (hide) await hideGlyphs(page, true);
  try {
    const png = PNG.sync.read(await page.screenshot({ scale: 'css', clip: { x: Math.max(0, x), y: Math.max(0, y), width: 1, height: 1 } }));
    return [png.data[0], png.data[1], png.data[2]];
  } finally {
    if (hide) await hideGlyphs(page, false);
  }
}

/** The vertical and sideways overflow of everything that could scroll the page (the NOSCROLL-295 / 297 probe, plus the width). */
export const pageScroll = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS') : null;
    const v = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const h = (el: Element | null | undefined) => (el ? el.scrollWidth - el.clientWidth : 0);
    const doc = document.scrollingElement;
    const wrap = screen && screen.parentElement !== main ? screen.parentElement : null;
    return {
      vertical: Math.max(v(doc), v(main), v(wrap), v(screen)),
      sideways: Math.max(h(doc), h(main), h(wrap), h(screen), document.documentElement.scrollWidth - innerWidth),
    };
  });

export const failing = <T extends ContrastRow>(rows: T[]): T[] => rows.filter((r) => r.ratio < r.need);
