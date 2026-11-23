import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LongListsController } from '../api/long-lists';
import { FIT_MQ } from './page-fit';

/**
 * SCROLL-AUDIT-2480 (owner rule: a control screen never scrolls; owner on the first comparison: "page 1 shows four sensors in one
 * column and two thirds of the width stay empty"): the pages of a region of EQUAL items - the alarm sensors, as cards or as list rows.
 *
 * `PageFit` (page-fit.ts) pages a region by whole rows in reading order, section by section. That is right for a region whose
 * sections stack, and wrong for the alarm's areas, which pack side by side: the page broke at the first area that ran out of height,
 * so page 1 was one narrow area column. Here the page is the grid that fits the region:
 *
 *  1. probe - every item is drawn in the screen's own grouped layout (the region clips). If nothing overflows, that layout stays
 *     (`grouped`: a small installation keeps its areas side by side, nothing pages).
 *  2. flat - otherwise the screen draws the items in ONE uniform grid (`flat`). The controller lays them out at their natural height
 *     once (the row height variable removed), counts the columns of the first row (the CSS grid's auto-fill decides them from the
 *     region's real width) and the rows that fit the region's real height (`floor((room + gap) / (item + gap))`). A page is
 *     columns x rows items; the row height is stretched to `(room - gaps) / rows` (`--fit-row-h` on the region), so every page but the
 *     last fills the region to its bottom edge.
 *
 * Measured again when the region changes size or the set changes (`sync(total, signature)`), never on a live state update. Below the
 * desktop edge (`mq`, default 1024x560 as PageFit) and when the installation's long lists scroll (הגדרות › כללי › עיצוב הממשק),
 * nothing changes: every item is drawn in the grouped layout. An item carries `data-fit-item`.
 */
type Mode = 'probe' | 'grouped' | 'flat';

export class GridFit implements ReactiveController {
  page = 1;
  /** columns and rows of a page (0 = not measured yet) */
  cols = 0;
  rows = 0;
  private mode: Mode = 'probe';
  private total = 0;
  private sig = '';
  private dirty = true;
  private raf = 0;
  private ro?: ResizeObserver;
  private observed: HTMLElement | null = null;
  private size = '';
  private mq: MediaQueryList;
  readonly lists: LongListsController;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private region: () => HTMLElement | null,
    mq: string = FIT_MQ,
  ) {
    this.mq = window.matchMedia(mq);
    this.lists = new LongListsController(host, () => this.reset());
    host.addController(this);
  }

  /** the pages are in force (a desktop window tall enough, the long lists paged): the region clips, it never scrolls */
  get on(): boolean {
    return this.mq.matches && this.lists.paged;
  }

  /** the screen draws its items in the one uniform grid (they did not fit in the grouped layout) */
  get flat(): boolean {
    return this.on && this.mode === 'flat';
  }

  private get per(): number {
    return this.cols * this.rows;
  }

  get pages(): number {
    return this.flat && this.per ? Math.max(1, Math.ceil(this.total / this.per)) : 1;
  }

  hostConnected() {
    this.mq.addEventListener('change', this.onMq);
  }

  hostDisconnected() {
    this.mq.removeEventListener('change', this.onMq);
    this.ro?.disconnect();
    this.ro = undefined;
    this.observed = null;
    cancelAnimationFrame(this.raf);
  }

  private onMq = () => {
    this.reset();
    this.host.requestUpdate();
  };

  private reset() {
    this.mode = 'probe';
    this.cols = 0;
    this.rows = 0;
    this.page = 1;
    this.dirty = true;
  }

  /** Called while rendering: how many items and what identifies the set (keys, filter, view). A new set starts at page 1. */
  sync(total: number, sig: string) {
    if (sig !== this.sig || total !== this.total) {
      this.sig = sig;
      this.total = total;
      this.reset();
    }
    if (this.page > this.pages) this.page = this.pages;
  }

  /** Is the item at reading-order index `i` on the current page? */
  shows(i: number): boolean {
    if (!this.flat || !this.per) return true;
    return i >= (this.page - 1) * this.per && i < this.page * this.per;
  }

  go(page: number) {
    this.page = Math.min(Math.max(1, page), this.pages);
    this.host.requestUpdate();
  }

  hostUpdated() {
    const r = this.region();
    if (!this.on) {
      r?.style.removeProperty('--fit-row-h');
      return;
    }
    if (r && r !== this.observed && typeof ResizeObserver !== 'undefined') {
      this.ro?.disconnect();
      this.observed = r;
      this.size = '';
      this.dirty = true;
      this.ro = new ResizeObserver(([e]) => {
        const s = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`;
        if (s === this.size) return;
        const first = this.size === '';
        this.size = s;
        if (first) return;
        this.reset(); // the region changed size: decide and measure from every item again
        this.host.requestUpdate();
      });
      this.ro.observe(r);
    }
    if (!this.dirty) return;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.measure());
  }

  private measure() {
    const r = this.region();
    if (!r || !this.on) return;
    if (this.mode === 'probe') {
      // every item drawn in the grouped layout: keep it when it fits, else the uniform grid
      this.mode = r.scrollHeight - r.clientHeight <= 1 ? 'grouped' : 'flat';
      this.dirty = this.mode === 'flat';
      if (this.mode === 'flat') this.host.requestUpdate();
      return;
    }
    if (this.mode !== 'flat') return;
    // the natural layout: the row height variable off for this one synchronous read (no frame is painted in between)
    const had = r.style.getPropertyValue('--fit-row-h');
    r.style.removeProperty('--fit-row-h');
    const items = [...r.querySelectorAll<HTMLElement>('[data-fit-item]')].filter((el) => el.getClientRects().length > 0);
    if (!items.length) {
      if (had) r.style.setProperty('--fit-row-h', had);
      return;
    }
    const rects = items.map((el) => el.getBoundingClientRect());
    const top = rects[0].top;
    const cols = Math.max(1, rects.filter((b) => Math.abs(b.top - top) <= 2).length);
    const h = Math.max(...rects.map((b) => b.height));
    const parent = items[0].parentElement;
    const pcs = parent ? getComputedStyle(parent) : null;
    const gap = pcs ? parseFloat(pcs.rowGap) || 0 : 0;
    const rcs = getComputedStyle(r);
    const rb = r.getBoundingClientRect();
    const contentTop = rb.top + (parseFloat(rcs.borderTopWidth) || 0) + (parseFloat(rcs.paddingTop) || 0);
    const contentBottom = rb.top + (parseFloat(rcs.borderTopWidth) || 0) + r.clientHeight - (parseFloat(rcs.paddingBottom) || 0);
    // a wrapper between the region and the items (the list's card): its edge above the first item and below the last
    const endChrome = parent && parent !== r && pcs ? (parseFloat(pcs.paddingBottom) || 0) + (parseFloat(pcs.borderBottomWidth) || 0) : 0;
    // the room from the first item's top (below a wrapper's top edge) to the region's content bottom
    const room = contentBottom - Math.max(top, contentTop) - endChrome;
    const rows = Math.max(1, Math.floor((room + gap) / (h + gap) + 0.001));
    const rowH = Math.max(h, Math.floor(((room - gap * (rows - 1)) / rows) * 100) / 100);
    r.style.setProperty('--fit-row-h', `${rowH}px`);
    this.dirty = false;
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      if (this.page > this.pages) this.page = this.pages;
      this.host.requestUpdate();
    }
  }
}
