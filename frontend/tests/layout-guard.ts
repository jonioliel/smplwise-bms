// Bubble foundation (owner 2026-10-02): the layout guard, ported from the approved mockup's layout-check.mjs
// (docs/design/mockups/bubble-taste on pilot/design-bubble-taste) to the real components, through shadow roots. Shared by
// layout-bubble.spec.ts (the components' demo page) and layout-bubble-screens.spec.ts (the real home / area / multimedia screens).
// `inPageCheck` runs INSIDE the page (page.evaluate): it must stay self-contained - no imports, no closures over this module.
// It walks the composed (flat) tree - light DOM, shadow roots and slotted content - and reports:
//   escape    an element or a text run crossing the box of the bubble that contains it (pill, sheet, chip, button, tree row, dock...)
//   overflow  horizontal overflow of the page, the shell's main column, the named roots or an open sheet's body
//   floating  a floating (fixed / absolute / sticky) element intersecting interactive content outside itself (no sheet open)
//   clipped   text cut by an overflow box without an ellipsis, or text sitting in a bubble's rounded corner
//   target    an interactive element below 44 x 44 px in touch layouts (<= 1100 px) or below the desktop touch dial (44, or 32 when chosen)

export interface Finding {
  cls: 'escape' | 'overflow' | 'floating' | 'clipped' | 'target';
  el: string;
  detail: string;
  ctx: string;
}

export interface GuardArgs {
  /** The context named in every finding (theme, width, dials, state). */
  ctx: string;
  /** Extra "bubble" selectors (containers nothing may leave) beyond the shared set. */
  bubble?: string;
  /** Extra selectors to skip (decorative layers, visually hidden text). */
  skip?: string;
  /** Selectors (inside sw-app's shadow root) whose horizontal overflow is a finding, beyond `main`. */
  roots?: string[];
  /** Only elements inside an element matching this selector are measured (one screen of a shell full of other, known layouts). */
  within?: string;
}

/** Runs inside the page. */
export function inPageCheck(args: GuardArgs): Finding[] {
  const ctx = args.ctx;
  const out: Finding[] = [];
  const touch = innerWidth <= 1100;
  const desktopTouch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
  const MIN = touch ? 44 : desktopTouch;
  const BUBBLE = 'sw-pill, .sheet, .tree-row, .floor-head, nav.tree, .btn, .chip, .sb, .pk-head, .stack, nav.bottom, .fab, .kv > div, .big, .x, .ring, sw-card, .pv-sheet, .seg' + (args.bubble ? ', ' + args.bubble : '');
  // .float = the shell's existing search / status corner (UI round 1), not a phase-B component: its 28 px button is a known shell item
  const SKIP = '.tx.over, .pv-bg, sw-icon, svg, .sr, .grab, .float' + (args.skip ? ', ' + args.skip : '');
  const INTER = 'button, a[href], [role="slider"], [role="button"], [role="switch"], [role="option"], input, select, [tabindex="0"]';
  const all: Element[] = [];
  const collect = (root: Document | ShadowRoot | Element) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) collect(el.shadowRoot);
    }
  };
  collect(document);
  const parentOf = (el: Element): Element | null => {
    if (el.assignedSlot) return el.assignedSlot;
    const p = el.parentNode;
    if (!p) return null;
    if (p instanceof ShadowRoot) return p.host;
    return p instanceof Element ? p : null;
  };
  const ancestors = (el: Element): Element[] => {
    const a: Element[] = [];
    for (let p = parentOf(el); p; p = parentOf(p)) a.push(p);
    return a;
  };
  const csC = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => {
    let s = csC.get(el);
    if (!s) {
      s = getComputedStyle(el);
      csC.set(el, s);
    }
    return s;
  };
  const hidC = new Map<Element, boolean>();
  const hidden = (el: Element | null): boolean => {
    if (!el || el === document.documentElement) return false;
    const c = hidC.get(el);
    if (c !== undefined) return c;
    const s = cs(el);
    const h = s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || (el as HTMLElement).hidden || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert') || hidden(parentOf(el));
    hidC.set(el, h);
    return h;
  };
  const desc = (el: Element) => {
    const c = [...el.classList].slice(0, 3).join('.');
    const t = (el.getAttribute('aria-label') || el.getAttribute('data-dev') || el.getAttribute('data-entity') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`;
  };
  type Box = { l: number; t: number; r: number; b: number };
  const R = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const inter = (a: Box, b: Box): Box => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const empty = (a: Box) => a.r - a.l < 1 || a.b - a.t < 1;
  const scrolls = (s: CSSStyleDeclaration) => /(auto|scroll)/.test(s.overflowX + s.overflowY);
  const clips = (s: CSSStyleDeclaration) => s.overflowX !== 'visible' || s.overflowY !== 'visible';
  const visRect = (el: Element): Box => {
    let v = R(el.getBoundingClientRect());
    for (const e of ancestors(el)) if (clips(cs(e)) && cs(e).position !== 'fixed') v = inter(v, R(e.getBoundingClientRect()));
    return v;
  };
  const add = (cls: Finding['cls'], el: Element, detail: string) => out.push({ cls, el: desc(el), detail, ctx });
  const matches = (el: Element, sel: string) => {
    try {
      return el.matches(sel);
    } catch {
      return false;
    }
  };
  const skip = (el: Element) => matches(el, SKIP) || ancestors(el).some((a) => matches(a, SKIP));

  // overflow
  const ov = (el: Element | null, name: string) => {
    if (el && !hidden(el) && el.scrollWidth > el.clientWidth + 1) add('overflow', el, `${name} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
  };
  if (document.documentElement.scrollWidth > innerWidth + 1) add('overflow', document.documentElement, `page ${document.documentElement.scrollWidth} > ${innerWidth}`);
  const app = document.querySelector('sw-app');
  ov(app?.shadowRoot?.querySelector('main') ?? null, 'main');
  for (const sel of args.roots ?? []) ov(app?.shadowRoot?.querySelector(sel) ?? null, sel);
  const openSheets = all.filter((e) => e.tagName === 'SW-SHEET' && e.hasAttribute('open'));
  const modalSheet = openSheets.find((s) => s.getAttribute('data-layout') !== 'inline') ?? null;
  for (const s of openSheets) ov(s.shadowRoot?.querySelector('.body') ?? null, 'sheet-body');

  // the scope: inside the open modal sheet (its section + slotted content), else the whole page
  const sheetSection = modalSheet?.shadowRoot?.querySelector('.sheet') ?? null;
  const inWithin = (el: Element) => !args.within || matches(el, args.within) || ancestors(el).some((a) => matches(a, args.within as string));
  const inScope = (el: Element) => inWithin(el) && (sheetSection ? el === sheetSection || ancestors(el).includes(sheetSection) : true);
  const scoped = all.filter((e) => inScope(e) && !hidden(e));

  // escape: elements and text runs must stay inside their bubble
  for (const b of scoped) {
    if (!matches(b, BUBBLE) || skip(b)) continue;
    const br = R(b.getBoundingClientRect());
    if (empty(br) || empty(visRect(b))) continue;
    for (const d of scoped) {
      if (d === b || skip(d)) continue;
      const chain = ancestors(d);
      const i = chain.indexOf(b);
      if (i < 0) continue;
      if (chain.slice(0, i).some((e) => scrolls(cs(e)) || cs(e).position === 'fixed')) continue; // scrolled or floating content is laid out on its own
      if (matches(d, '.sheet') || chain.slice(0, i).some((e) => matches(e, '.sheet'))) continue;
      if (cs(d).position === 'absolute' && matches(d, '.pop, .menu, [role="menu"]')) continue; // a menu opened from the bubble floats by design
      const r = R(d.getBoundingClientRect());
      if (empty(r)) continue;
      if (r.l < br.l - 1.5 || r.r > br.r + 1.5 || r.t < br.t - 1.5 || r.b > br.b + 1.5) add('escape', d, `outside ${desc(b)} by ${Math.round(Math.max(br.l - r.l, r.r - br.r, br.t - r.t, r.b - br.b))}px`);
    }
  }
  // clipped text (and text in a rounded corner)
  const textRoots: (Document | ShadowRoot)[] = [document, ...all.filter((e) => e.shadowRoot).map((e) => e.shadowRoot!)];
  for (const root of textRoots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (!el || !inScope(el) || skip(el) || el.closest('script, style') || hidden(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tr = R(range.getBoundingClientRect());
      if (empty(tr)) continue;
      let cornerDone = false;
      for (let e: Element | null = el; e; e = parentOf(e)) {
        const s = cs(e);
        if (scrolls(s)) break;
        const er = R(e.getBoundingClientRect());
        const outX = tr.l < er.l - 1.5 || tr.r > er.r + 1.5;
        if (clips(s) && outX) {
          const ell = cs(el).textOverflow === 'ellipsis' || s.textOverflow === 'ellipsis';
          if (!ell) add('clipped', el, `text cut by ${desc(e)}`);
          break;
        }
        if (matches(e, BUBBLE) && outX) {
          add('escape', el, `text outside ${desc(e)}`);
          break;
        }
        if (matches(e, BUBBLE) && !cornerDone) {
          cornerDone = true;
          const rad = Math.min(parseFloat(s.borderTopLeftRadius) || 0, (er.b - er.t) / 2, (er.r - er.l) / 2);
          if (rad > 4) {
            const pts = [[tr.l + 1, tr.t + 3], [tr.r - 1, tr.t + 3], [tr.l + 1, tr.b - 3], [tr.r - 1, tr.b - 3]];
            const cut = pts.some(([x, y]) => {
              const cx = x < er.l + rad ? er.l + rad : x > er.r - rad ? er.r - rad : null;
              const cy = y < er.t + rad ? er.t + rad : y > er.b - rad ? er.b - rad : null;
              return cx !== null && cy !== null && Math.hypot(x - cx, y - cy) > rad + 1;
            });
            if (cut) add('clipped', el, `text in the rounded corner of ${desc(e)}`);
          }
        }
      }
    }
  }
  // targets
  for (const el of scoped) {
    if (!matches(el, INTER) || el.getAttribute('tabindex') === '-1' || skip(el) || (el as HTMLButtonElement).disabled) continue;
    if (empty(visRect(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) add('target', el, `${Math.round(r.width)}x${Math.round(r.height)} < ${MIN}`);
  }
  // floating elements over interactive content (no modal sheet open)
  if (!modalSheet) {
    const floats = scoped.filter((e) => {
      const s = cs(e);
      return (s.position === 'absolute' || s.position === 'fixed' || s.position === 'sticky') && !skip(e) && !matches(e, '.backdrop, .sheet, sw-sheet') && !ancestors(e).some((a) => matches(a, 'sw-sheet'));
    });
    const targets = scoped.filter((t) => matches(t, INTER) && t.getAttribute('tabindex') !== '-1' && !skip(t));
    for (const f of floats) {
      const fr = visRect(f);
      if (empty(fr)) continue;
      for (const t of targets) {
        if (f === t || ancestors(t).includes(f) || ancestors(f).includes(t)) continue;
        const ir = inter(fr, visRect(t));
        if (!empty(ir) && (ir.r - ir.l) * (ir.b - ir.t) > 4) add('floating', f, `covers ${desc(t)}`);
      }
    }
  }
  return out;
}

/** The report: counts per class and the distinct findings (element + detail), most frequent first. */
export function summarize(results: Finding[], top = 80): { byCls: Record<string, number>; lines: string[] } {
  const byCls: Record<string, number> = {};
  const uniq = new Map<string, Finding & { n: number; ctxs: Set<string> }>();
  for (const r of results) {
    byCls[r.cls] = (byCls[r.cls] || 0) + 1;
    const k = `${r.cls}|${r.el}|${r.detail}`;
    if (!uniq.has(k)) uniq.set(k, { ...r, n: 0, ctxs: new Set() });
    const u = uniq.get(k)!;
    u.n++;
    u.ctxs.add(r.ctx);
  }
  const lines = [...uniq.values()].sort((a, b) => b.n - a.n).slice(0, top).map((u) => `[${u.cls}] ${u.el} - ${u.detail} (x${u.n}; e.g. ${[...u.ctxs][0]})`);
  return { byCls, lines };
}
