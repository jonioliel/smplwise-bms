import type { DdPlace } from './tabs-mode';

/**
 * Header dropdown placement (setting `ui.dd_place`, shell/sw-app.ts `fitDd`): the pieces the shell measures with on a wide screen.
 * 2.7.2 (owner review of the 2.7.1 placements, 2026-10-18): placement 3 is measured instead of guessed, placement 2 keeps clear of the
 * floating corner by its measured size, and a collision is judged against every control of the page's top rows, not only the title.
 */

/** The chips of the tab group's dropdown form that hang on the page's first row (the single chip, or the pair and its alarm button). */
export const DD_CHIPS = '.subnav[data-tabstyle="dropdown"] > sw-tabs, .tabpair:not(.single) > sw-tabs, .tabpair:not(.single) > sw-dropdown, .tabpair:not(.single) > a.alarmpin';

/** The gap kept between a chip and its neighbour (the title, a control, the floating corner). */
export const DD_GAP = 12;

/** How long a measured collision must persist before the route falls back to placement 1 (a loading screen draws a provisional header). */
export const DD_COLLIDE_MS = 900;

/**
 * Placements an AREA does not support on a wide screen: they draw as placement 1 there, deliberately (data-dd-fallback="declared").
 * Each entry needs its reason; tests/layout-dd-place.spec.ts holds the same table and fails when either side changes alone.
 */
export const DD_PLACE_DECLINED: Readonly<Record<string, readonly DdPlace[]>> = {
  // Settings: the start edge of a wide settings page is the settings menu column (its search field is that column's first row), and
  // the page title sits under the section's own tab row, never on the first row: placement 4 (start edge) would cover the menu's
  // search and placement 3 (after the title) has no title on that row to follow. Placement 2 (far end) is real there.
  system: ['3', '4'],
};

export interface DdBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** What a chip on the page's first row must never cover: buttons, links, fields, selectors, tab rows, headings. */
const CONTROLS = 'h1,h2,h3,button,a[href],input,select,textarea,sw-dropdown,sw-tabs,[role="tab"],[role="combobox"],[role="button"],[role="search"]';

/**
 * The screen's header as the shell sees it: the first visible <h1> (as a text range: its glyphs, not its box) and every visible control
 * whose box starts above `band` (the bottom of the hanging chips), searched through the shadow roots. A subtree that starts below the band
 * is skipped, so the walk stays short on a long page. A control wider than half the viewport is a container, not a header element.
 */
export function ddHeader(screen: ParentNode, band: number): { title: DdBox | null; obstacles: DdBox[] } {
  let h1: HTMLElement | null = null;
  const obstacles: DdBox[] = [];
  const half = window.innerWidth / 2;
  const walk = (root: ParentNode, depth: number) => {
    for (const el of root.children) {
      const r = el.getBoundingClientRect();
      const boxed = r.width > 0 || r.height > 0; // display: contents (and a slot) has no box of its own: always look inside
      if (boxed && !isShown(el)) continue; // hidden: nothing inside it shows either
      if (boxed && r.top >= band) {
        // below the band only the first heading still matters (a title under a row of the screen's own tabs), and not far below
        if (h1) continue;
        if (el.localName === 'h1') h1 = el as HTMLElement;
        else if (r.top < band + 400) descend(el, depth);
        continue;
      }
      if (boxed) {
        if (!h1 && el.localName === 'h1') h1 = el as HTMLElement;
        // a heading counts by its glyphs (a block heading's box can be far wider than its text)
        const b = /^h[1-3]$/.test(el.localName) ? textBox(el) : r;
        if (b && el.matches(CONTROLS) && b.bottom > 0 && b.right - b.left < half) obstacles.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });
      }
      descend(el, depth);
    }
  };
  const descend = (el: Element, depth: number) => {
    if (depth > 24) return;
    if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
    walk(el, depth + 1);
  };
  walk(screen, 0);
  return { title: h1 ? textBox(h1) : null, obstacles };
}

/** An element's text as a box (a range over its contents), or null when it draws no text. */
function textBox(el: Element): DdBox | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const t = range.getBoundingClientRect();
  return t.width > 0 ? { left: t.left, right: t.right, top: t.top, bottom: t.bottom } : null;
}

function isShown(el: Element): boolean {
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
}
