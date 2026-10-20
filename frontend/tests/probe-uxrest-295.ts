import type { Page } from '@playwright/test';

/** UXREST-295 probes (run inside the page; shadow roots are walked). */
export type ContrastFail = { text: string; ratio: number; fg: string; bg: string; size: number; path: string };

export async function contrastProbe(page: Page, min = 4.5): Promise<{ n: number; fails: ContrastFail[] }> {
  return page.evaluate((minRatio) => {
    const cv = document.createElement('canvas').getContext('2d')!;
    const parse = (c: string): [number, number, number, number] => {
      let m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) {
        cv.fillStyle = '#000';
        cv.fillStyle = c;
        const s = String(cv.fillStyle);
        m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) { const h = s.match(/#(..)(..)(..)/); return h ? [parseInt(h[1], 16), parseInt(h[2], 16), parseInt(h[3], 16), 1] : [0, 0, 0, 0]; }
      }
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3]];
    };
    const lum = (r: number, g: number, b: number) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parentOf = (e: Element): Element | null => e.parentElement ?? ((e.getRootNode() as ShadowRoot).host ?? null);
    const bgOf = (e: Element): [number, number, number] => {
      const stack: [number, number, number, number][] = [];
      for (let n: Element | null = e; n; n = parentOf(n)) {
        const cs = getComputedStyle(n);
        const b = parse(cs.backgroundColor);
        if (b[3] > 0) { stack.push(b); if (b[3] >= 0.99) break; }
        else if (/gradient/.test(cs.backgroundImage)) {
          const m = cs.backgroundImage.match(/rgba?\([^)]+\)/);
          if (m) { const g = parse(m[0]); if (g[3] > 0) { stack.push(g); if (g[3] >= 0.99) break; } }
        }
      }
      let r = 255, g = 255, b = 255;
      const body = parse(getComputedStyle(document.body).backgroundColor);
      const html = parse(getComputedStyle(document.documentElement).backgroundColor);
      const base = body[3] >= 0.99 ? body : html[3] >= 0.99 ? html : null;
      if (base) { r = base[0]; g = base[1]; b = base[2]; }
      for (let i = stack.length - 1; i >= 0; i--) {
        const [sr, sg, sb, sa] = stack[i];
        r = sr * sa + r * (1 - sa); g = sg * sa + g * (1 - sa); b = sb * sa + b * (1 - sa);
      }
      return [r, g, b];
    };
    const out: ContrastFail[] = [];
    let n = 0;
    const seen = new Set<Element>();
    const walk = (root: Node) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let cur: Node | null = tw.currentNode;
      while (cur) {
        if (cur.nodeType === 1) {
          const el = cur as Element;
          if (el.shadowRoot) walk(el.shadowRoot);
        } else if (cur.nodeType === 3 && cur.textContent && cur.textContent.trim().length > 0) {
          const el = cur.parentElement;
          if (el && !seen.has(el)) {
            seen.add(el);
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 1 && r.height > 1 && Number(cs.opacity) > 0.05
                && !el.closest('[disabled],[aria-disabled="true"],script,style')) {
              const fg = parse(cs.color);
              const bg = bgOf(el);
              const fr = fg[0] * fg[3] + bg[0] * (1 - fg[3]);
              const fgc = fg[1] * fg[3] + bg[1] * (1 - fg[3]);
              const fb = fg[2] * fg[3] + bg[2] * (1 - fg[3]);
              const L1 = lum(fr, fgc, fb), L2 = lum(bg[0], bg[1], bg[2]);
              const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
              n++;
              const size = parseFloat(cs.fontSize);
              const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
              if (ratio < (large ? 3 : minRatio)) {
                const path: string[] = [];
                for (let p: Element | null = el, i = 0; p && i < 4; p = parentOf(p), i++) {
                  path.push(p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
                }
                out.push({ text: cur.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, fg: cs.color, bg: `rgb(${bg.map(Math.round).join(',')})`, size, path: path.join(' < ') });
              }
            }
          }
        }
        cur = tw.nextNode();
      }
    };
    walk(document);
    return { n, fails: out };
  }, min);
}

/** Horizontal overflow of the document and elements that stick out of the viewport outside any scroller. */
export async function overflowProbe(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth; // the body clips by design; the page scrolls sideways only when the document does
    const out: string[] = [];
    const up = (p: Element): Element | null => p.parentElement ?? ((p.getRootNode() as ShadowRoot).host ?? null);
    const walk = (root: Node) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let cur: Node | null = tw.nextNode();
      while (cur) {
        const el = cur as Element;
        if (el.shadowRoot) walk(el.shadowRoot);
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && cs.position !== 'fixed' && (r.right > vw + 2 || r.left < -2) && out.length < 8) {
          let scroller = false;
          for (let p = up(el); p; p = up(p)) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { scroller = true; break; }
          }
          if (!scroller) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
        cur = tw.nextNode();
      }
    };
    walk(document);
    return { vw, sw, over: sw > vw + 1, culprits: out };
  });
}
