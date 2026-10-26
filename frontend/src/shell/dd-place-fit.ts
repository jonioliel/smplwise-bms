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

/** FIX2231C-295: how many animation frames after a route / placement change the shell keeps measuring the header on every frame (about 1.5 s at 60 Hz), with the measured chips hidden until a clear measurement. */
export const DD_FIT_FRAMES = 90;

/** Placement 3 shows its chips once the measured place was the same for this many passes in a row (about 0.15 s at 60 Hz). */
export const DD_FIT_STABLE = 8;

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
  // Infrastructure (2.9.2, owner 2026-10-20): the screens have no page title on their first row; that row is the page's own toolbar
  // (the generator picker, the charts range and CSV buttons, the meters' filters), different on every page. Placement 3 has no title to
  // follow and 2 / 4 land on that toolbar, so the measured safety net sent the route back to 1 after DD_COLLIDE_MS: the page row drew
  // under the header first and then jumped down a row. Declared up front, the own row is drawn from the first frame: the area's chip and
  // the page chip (shell/infra-pages.ts) side by side in it, nothing moves.
  infra: ['2', '3', '4'],
};

/**
 * Placements a single SCREEN (hash path, without the query) declines on top of its area's (same rule, same reason duty).
 * tests/layout-dd-place.spec.ts holds the same table.
 */
export const DD_PLACE_DECLINED_SCREENS: Readonly<Record<string, readonly DdPlace[]>> = {
  // Service-management settings (2.9.1, integ/291): the page's own tab strip is centred on the first row; with the ninth tab ("automatic
  // opening", TKRULES-291) it reaches the far end at 1440 px, so placement 2 collided with it (layout-dd-place, data-dd-fallback=
  // "collision"). Declared up front, the chip draws on its own row from the first frame.
  '/system/tickets': ['2', '3', '4'],
};

/** Whether the asked placement draws as 1 on this area / screen (the declared fallback). */
export function ddPlaceDeclined(area: string, hash: string, asked: DdPlace): boolean {
  if (asked === '1') return false;
  const path = hash.replace(/^#/, '').split('?')[0];
  return !!DD_PLACE_DECLINED[area]?.includes(asked) || !!DD_PLACE_DECLINED_SCREENS[path]?.includes(asked);
}

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
