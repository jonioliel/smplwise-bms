/**
 * NOSCROLL-1366-2437 (owner rule 2026-10-24: a control screen never scrolls; design audit round 30, finding #5, owner option 1: "only an
 * inner panel scrolls"): the service-management lists and the manager board no longer put ALL their content in one scrolling region on a
 * desktop. The header, the numbers and the "today" row stay; the cards are cut into pages that fit the room left (whole card rows, the
 * sections' headers counted), with a pager on the toolbar row.
 *
 * `packPages` is pure: it gets the sections (a header or none, groups of cards with an optional sub-header, how many cards a row holds and
 * how tall a row is) and the measured room, and returns the pages - each page a list of section slices, a section that runs over a page
 * edge continues on the next one under its header again. A page always holds at least one row (a window shorter than one row keeps the
 * region's own overflow as the fallback).
 */

export interface PackGroup<T> {
  key: string;
  /** the group draws a sub-header (the handler's name and load) above its cards */
  sub: boolean;
  items: readonly T[];
  /** cards per row (1 for quiet rows) */
  cols: number;
  /** the height of a row whose cards were not measured yet */
  rowH: number;
  /** the measured height of one card (a row is as tall as its tallest card) */
  heightOf?: (item: T) => number | undefined;
  /** the gap between two rows of this group */
  gap: number;
  /** extra height the group's box adds once (padding of a rows card) */
  pad?: number;
}
export interface PackSection<T> {
  id: string;
  /** false: the cards have no section header (an ungrouped board, the lists) */
  head: boolean;
  /** no groups: a header-only section (the folded "closed" strip) */
  groups: readonly PackGroup<T>[];
}
export interface PackMetrics {
  /** the room for the pages */
  room: number;
  headH: number;
  subH: number;
  /** between two sections */
  secGap: number;
  /** between a section's header and its body, and between two groups of one section */
  inGap: number;
  /** between a group's sub-header and its cards */
  blkGap: number;
}
export interface PageGroup<T> {
  key: string;
  items: T[];
}
export interface PageSection<T> {
  id: string;
  groups: PageGroup<T>[];
  /** the section started on an earlier page */
  cont: boolean;
}

export function packPages<T>(sections: readonly PackSection<T>[], m: PackMetrics): PageSection<T>[][] {
  const pages: PageSection<T>[][] = [];
  let page: PageSection<T>[] = [];
  let used = 0;
  let curSec: PageSection<T> | null = null;
  let curGrp: PageGroup<T> | null = null;
  const started = new Set<string>();
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
    curSec = null;
    curGrp = null;
  };
  /** the height a row (or a header-only section) adds to the current page */
  const cost = (s: PackSection<T>, g: PackGroup<T> | null, rowH: number): number => {
    let add = 0;
    if (!curSec || curSec.id !== s.id) {
      add += (page.length ? m.secGap : 0) + (s.head ? m.headH + (g ? m.inGap : 0) : 0);
      if (g) add += (g.sub ? m.subH + m.blkGap : 0) + (g.pad ?? 0);
    } else if (g && (!curGrp || curGrp.key !== g.key)) {
      add += m.inGap + (g.sub ? m.subH + m.blkGap : 0) + (g.pad ?? 0);
    } else if (g) {
      add += g.gap;
    }
    return add + rowH;
  };
  const place = (s: PackSection<T>, g: PackGroup<T> | null, row: readonly T[], rowH: number) => {
    if (page.length && used + cost(s, g, rowH) > m.room + 0.5) flush();
    used += cost(s, g, rowH);
    if (!curSec || curSec.id !== s.id) {
      curSec = { id: s.id, groups: [], cont: started.has(s.id) };
      started.add(s.id);
      page.push(curSec);
      curGrp = null;
    }
    if (!g) return;
    if (!curGrp || curGrp.key !== g.key) {
      curGrp = { key: g.key, items: [] };
      curSec.groups.push(curGrp);
    }
    curGrp.items.push(...row);
  };
  for (const s of sections) {
    if (!s.groups.length) {
      place(s, null, [], 0);
      continue;
    }
    for (const g of s.groups) {
      const cols = Math.max(1, g.cols);
      for (let i = 0; i < g.items.length; i += cols) {
        const row = g.items.slice(i, i + cols);
        const h = g.heightOf ? Math.max(0, ...row.map((t) => g.heightOf!(t) ?? g.rowH)) : g.rowH;
        place(s, g, row, h);
      }
    }
  }
  flush();
  return pages;
}

/** The number of grid tracks of a laid-out grid (its computed columns). */
export function gridCols(el: Element | null): number {
  if (!el) return 1;
  const v = getComputedStyle(el).gridTemplateColumns;
  return Math.max(1, v && v !== 'none' ? v.split(' ').filter(Boolean).length : 1);
}

/** The row gap of an element in px (0 when it has none). */
export function rowGap(el: Element | null): number {
  if (!el) return 0;
  return parseFloat(getComputedStyle(el).rowGap) || 0;
}

/** The desktop the pages are for (below it the region scrolls as before: a tablet, and on a phone the page). */
export const PAGED_MQ = '(min-width: 1024px)';
