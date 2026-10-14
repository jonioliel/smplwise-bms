import type { Page } from '@playwright/test';

// The rectangles of the HUD over the floor map's plan and 3D canvas, read from the browser: what tests/evidence-hud-layout-live.spec.ts and
// scripts/hud-shots.mjs measure (owner 2026-10-13: three layout collisions the opaque panels made plain). Erasable TypeScript only (Node imports this
// file directly from the screenshot script); `inPageRects` runs INSIDE the page (page.evaluate): no imports, no closures over this module.
//
// Every name is a rectangle in px relative to the stage (the map's box) - an element that is not laid out (display none, no size, hidden) is not
// listed, so "the circuit button is not there" and "it is there and overlaps" are different answers. `covered` says, for each listed element, who
// is PAINTED at its centre when that is not the element itself (the real stacking order, through every shadow root).

/** One measurement of the stage. Rectangles: [x, y, width, height] from the stage's border box. */
export interface HudSnapshot {
  stage: [number, number];
  rects: Record<string, [number, number, number, number]>;
  /** The level bar's chips, one rectangle each (the bar's own box clips them when it scrolls). */
  levelChips: [number, number, number, number][];
  /** The level bar's [scrollWidth, clientWidth]: a scrolling bar is wider inside than its box. */
  barScroll: [number, number] | null;
  /** The contract's attributes on the stage (what the floor map wrote: map/hud-layout.ts). */
  row2: boolean;
  corner: string | null;
  end: number;
  viewport: number;
  /** name -> who is painted at the centre of that element, when it is not the element itself ("other:<tag.class>" for something unlisted). */
  covered: Record<string, string>;
  /** Names under a point sampled inside the picker (centre and four inset corners) that are not the picker: it must be the top-most thing. */
  pickerCovered: string[];
}

/** Runs in the page. */
export function inPageRects(): HudSnapshot {
  const deep = (sel: string, r: Document | ShadowRoot = document): Element | null => {
    const hit = r.querySelector(sel);
    if (hit) return hit;
    for (const el of Array.from(r.querySelectorAll('*'))) {
      if (el.shadowRoot) {
        const f = deep(sel, el.shadowRoot);
        if (f) return f;
      }
    }
    return null;
  };
  const host = deep('explore-floor-map');
  if (!host || !host.shadowRoot) throw new Error('hud-layout-harness: the floor map is not on the page');
  const root = host.shadowRoot;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const sr = stage.getBoundingClientRect();
  const rects: HudSnapshot['rects'] = {};
  const els = new Map<string, Element>();
  const laidOut = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width >= 1 && r.height >= 1 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const add = (name: string, el: Element | null | undefined) => {
    if (!el || !laidOut(el)) return;
    const r = el.getBoundingClientRect();
    rects[name] = [Math.round((r.left - sr.left) * 10) / 10, Math.round((r.top - sr.top) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
    els.set(name, el);
  };
  const q = (sel: string, r: ParentNode = root) => r.querySelector(sel);
  add('chip', q('[data-floorchip]'));
  add('levelbar', q('.levelbar'));
  add('circuits', q('[data-circuit-strip]'));
  root.querySelectorAll('[data-circuit-strip] [data-circuit-toggle]').forEach((b, i) => add(`circuit#${i}`, b));
  add('floorstrip', q('[data-floor-strip]'));
  add('floorbtns', q('[data-floor-buttons]'));
  add('sidelist', q('[data-sidelist]'));
  add('layers', q('[data-layers-panel]'));
  add('pickbar', q('[data-pickbar]'));
  add('legend', q('.legend'));
  const p3 = q('sw-plan-3d') as HTMLElement | null;
  if (p3?.shadowRoot && getComputedStyle(p3).display !== 'none') {
    const r3 = p3.shadowRoot;
    add('pill', q('[data-3d-time]', r3));
    add('picker', q('[data-3d-time-pop]', r3));
    add('minimap', q('canvas.minimap', r3));
    add('bar3d', q('[data-3d-bar]', r3));
    add('thumbs', q('[data-3d-strip]', r3));
    add('hint', q('.pill.hint', r3));
    add('crossfloor', q('.pill.cross-floor', r3));
    add('toast', q('.toast', r3));
    const wh = q('sw-walk-hud', r3);
    if (wh?.shadowRoot) {
      add('walkbar', q('[data-walk-bar]', wh.shadowRoot));
      add('walksheet', q('.sheet', wh.shadowRoot));
    }
  }
  const pc = q('sw-plan-canvas') as HTMLElement | null;
  if (pc?.shadowRoot && getComputedStyle(pc).display !== 'none') {
    add('zoom', q('.controls', pc.shadowRoot));
    add('scale', q('.scale', pc.shadowRoot));
  }
  const bar = q('.levelbar') as HTMLElement | null;
  const levelChips: HudSnapshot['levelChips'] = [];
  bar?.querySelectorAll('[data-level-chip]').forEach((c) => {
    const r = c.getBoundingClientRect();
    levelChips.push([Math.round((r.left - sr.left) * 10) / 10, Math.round((r.top - sr.top) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]);
  });

  // who is painted at a point, through every shadow root
  const hitAt = (x: number, y: number): Element | null => {
    let el = document.elementFromPoint(x, y);
    for (let i = 0; i < 12 && el?.shadowRoot; i++) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  };
  const up = (n: Node): Node | null => {
    const slot = (n as Element).assignedSlot;
    if (slot) return slot;
    const p = n.parentNode;
    return p instanceof ShadowRoot ? p.host : p;
  };
  const nameOf = (hit: Element | null): string => {
    for (let n: Node | null = hit; n; n = up(n)) {
      for (const [name, el] of els) if (el === n) return name;
    }
    if (!hit) return 'nothing';
    const cls = typeof hit.className === 'string' ? hit.className.split(' ')[0] : '';
    return `other:${hit.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };
  const covered: HudSnapshot['covered'] = {};
  for (const [name, el] of els) {
    if (name === 'circuits') continue; // a container: its buttons are listed
    const r = el.getBoundingClientRect();
    const hit = hitAt(r.left + r.width / 2, r.top + r.height / 2);
    // the element itself, or something inside it (its text, its icon), is "itself"
    let inside = false;
    for (let n: Node | null = hit; n; n = up(n)) if (n === el) inside = true;
    if (!inside) covered[name] = nameOf(hit);
  }
  const pickerCovered: string[] = [];
  const picker = els.get('picker');
  if (picker) {
    const r = picker.getBoundingClientRect();
    const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6]];
    for (const [x, y] of pts) {
      const hit = hitAt(x, y);
      let inside = false;
      for (let n: Node | null = hit; n; n = up(n)) if (n === picker) inside = true;
      if (!inside) pickerCovered.push(nameOf(hit));
    }
  }
  const cs = getComputedStyle(stage);
  const endPx = parseFloat(stage.style.getPropertyValue('--hud-end') || cs.getPropertyValue('--hud-end')) || 12;
  return {
    stage: [Math.round(sr.width * 10) / 10, Math.round(sr.height * 10) / 10],
    rects,
    levelChips,
    barScroll: bar ? [bar.scrollWidth, bar.clientWidth] : null,
    row2: stage.hasAttribute('data-hud-row2'),
    corner: stage.getAttribute('data-corner'),
    end: endPx,
    viewport: window.innerWidth,
    covered,
    pickerCovered,
  };
}

/** One reading of the HUD. */
export const readHud = (page: Page): Promise<HudSnapshot> => page.evaluate(inPageRects);

/** The reading once it stops changing (the stage's contract is written after the layout it reads: a resize observer, the 3D element's own
 * report): two equal readings 250 ms apart, or the last one after `timeoutMs`. */
export async function settledHud(page: Page, timeoutMs = 15_000): Promise<HudSnapshot> {
  const t0 = Date.now();
  let prev = JSON.stringify(await readHud(page));
  for (;;) {
    await page.waitForTimeout(250);
    const cur = await readHud(page);
    const s = JSON.stringify(cur);
    if (s === prev || Date.now() - t0 > timeoutMs) return cur;
    prev = s;
  }
}

type Rect = [number, number, number, number];
/** The overlap of two rectangles in px (0 x 0 when they only touch or are apart). */
export function overlapOf(a: Rect, b: Rect): [number, number] {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0.5 && h > 0.5 ? [Math.round(w), Math.round(h)] : [0, 0];
}

/** The findings of one reading against what the state must show:
 *   missing   an element the state is about is not laid out (the check would prove nothing);
 *   overlap   a pair that must stand apart intersects;
 *   clipped   a named element reaches past the stage;
 *   covered   an element has something else painted at its centre (nothing may, except `allowCover[name]`);
 *   level bar not centred in the free band (between the edge inset and --hud-end, to within 1.5 px) or scrolling sideways (a bar of three chips fits at 390 px). */
export function hudFindings(s: HudSnapshot, spec: { present: string[]; apart: [string, string][]; inside?: string[]; allowCover?: Record<string, string[]>; centred?: boolean; noScroll?: boolean }): string[] {
  const out: string[] = [];
  const tag = `stage ${s.stage[0]}x${s.stage[1]}, viewport ${s.viewport}, corner ${s.corner ?? '-'}, ${s.row2 ? 'bar row 2' : 'bar row 1'}, end ${s.end}`;
  const fmt = (n: string) => `${n} [${s.rects[n]?.join(', ')}]`;
  for (const n of spec.present) if (!s.rects[n]) out.push(`missing: ${n} is not laid out (${tag})`);
  for (const [a, b] of spec.apart) {
    if (!s.rects[a] || !s.rects[b]) continue;
    const [w, h] = overlapOf(s.rects[a], s.rects[b]);
    if (w > 0) out.push(`overlap ${w}x${h}px: ${fmt(a)} x ${fmt(b)} (${tag})`);
  }
  const [sw, sh] = s.stage;
  for (const n of spec.inside ?? Object.keys(s.rects)) {
    const r = s.rects[n];
    if (!r) continue;
    if (r[0] < -1 || r[1] < -1 || r[0] + r[2] > sw + 1 || r[1] + r[3] > sh + 1) out.push(`clipped: ${fmt(n)} reaches past the stage ${sw}x${sh} (${tag})`);
  }
  for (const [n, who] of Object.entries(s.covered)) {
    if (!s.rects[n] || (spec.allowCover?.[n] ?? []).includes(who)) continue;
    if (n === 'circuits') continue;
    out.push(`covered: ${fmt(n)} has ${who} painted at its centre (${tag})`);
  }
  if (spec.centred && s.rects.levelbar) {
    const r = s.rects.levelbar;
    const band = [s.end, sw - 12];
    const want = (band[0] + band[1]) / 2;
    const got = r[0] + r[2] / 2;
    if (Math.abs(got - want) > 1.5) out.push(`level bar not centred in the free band: centre ${got.toFixed(1)}, band ${band[0]}..${band[1]} centre ${want.toFixed(1)} (${tag})`);
  }
  if (spec.noScroll && s.barScroll && s.barScroll[0] > s.barScroll[1] + 1) out.push(`level bar scrolls sideways: scrollWidth ${s.barScroll[0]} > clientWidth ${s.barScroll[1]} (${tag})`);
  if (s.levelChips.length && s.rects.levelbar) {
    const b = s.rects.levelbar;
    for (const c of s.levelChips) {
      const scrolls = !!s.barScroll && s.barScroll[0] > s.barScroll[1] + 1;
      if (!scrolls && (c[0] < b[0] - 1 || c[0] + c[2] > b[0] + b[2] + 1)) out.push(`level chip [${c.join(', ')}] sticks out of the bar ${fmt('levelbar')} (${tag})`);
    }
  }
  return out;
}
