import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LongListsController } from '../api/long-lists';

/**
 * NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; design audit round 30, finding #5): the pages of a card region on the
 * multimedia screens. From FIT_MQ the screen takes the height it is given and its cards region (`region()`) never scrolls: the cards
 * that fit are page 1, the rest are on the next pages (`<sw-pager>`).
 *
 * The page breaks are measured, not guessed. Every card is drawn once (the region clips, so what the operator sees does not move) and
 * the breaks are computed from that one layout: a page takes whole rows of cards (cards of one section that share a top edge) while
 * they end inside the region. A page that starts inside a section draws that section's heading again above its first row, so the
 * heading's height is counted for it. If a drawn page still overflows (an item the layout did not foresee), that page alone is split
 * where it overflows; the earlier pages never change. The breaks are measured anew when the region changes size or when the set of
 * cards changes (`sync(total, signature)`: a filter, a device added or removed), never on a live state update. Below FIT_MQ, and while
 * `enabled()` is false (the layout editor), every card is drawn and nothing changes. A card the screen draws carries `data-fit-item`,
 * in reading order, inside its section's `<section>` element.
 *
 * PAGING-SETTING-2439: moved here from screens/multimedia-page-fit.ts as THE measured-pages helper of every card or row region of a
 * control screen (owner round 32, Q-SYS-4/5). It honours the installation's long-lists setting (api/long-lists.ts): in `scroll` every
 * card is drawn, the pager shows one page and the host carries `data-long-lists="scroll"`, so the screen's CSS lets the region scroll
 * inside itself. `mq` is the screen's desktop edge (default FIT_MQ). A region without `<section>` elements is one section.
 */
export const FIT_MQ = '(min-width: 1024px) and (min-height: 560px)';

/** CR-CMP2-TABLES-GENMAINT-2450: a row region that is a shared `sw-table` draws its rows inside the table's shadow root (the row hook
 * `data-fit-item` comes through `rowAttrs`), where the region's own `querySelectorAll` does not reach. The items in reading order: the
 * region's own, and at a `sw-table` the rows of that table. */
function fitItems(r: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of r.querySelectorAll<HTMLElement>('[data-fit-item], sw-table')) {
    if (el.localName === 'sw-table') out.push(...(el.shadowRoot?.querySelectorAll<HTMLElement>('[data-fit-item]') ?? []));
    else out.push(el);
  }
  return out;
}

/** The `<section>` an item belongs to - for a row inside a `sw-table`, the section around the table. */
function sectionOf(el: HTMLElement): Element | null {
  const own = el.closest('section');
  if (own) return own;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host.closest('section') : null;
}

interface Geo {
  top: number;
  bottom: number;
  sec: Element | null;
  /** the height of the section's heading above its grid (what a page that starts inside the section draws again) */
  head: number;
}

export class PageFit implements ReactiveController {
  /** the first card index of every page plus the total at the end; null = not measured yet (every card drawn) */
  private starts: number[] | null = null;
  page = 1;
  private total = 0;
  private sig = '';
  private raf = 0;
  private ro?: ResizeObserver;
  private observed: HTMLElement | null = null;
  private size = '';
  private mq: MediaQueryList;
  /** the installation's long-lists setting: `scroll` draws every card (the region scrolls inside itself) */
  readonly lists: LongListsController;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private region: () => HTMLElement | null,
    private enabled: () => boolean,
    mq: string = FIT_MQ,
  ) {
    this.mq = window.matchMedia(mq);
    this.lists = new LongListsController(host, () => this.reset());
    host.addController(this);
  }

  /** the screen takes the window's height (a desktop window tall enough, not editing): its region pages - or, when the long lists
   * scroll, scrolls inside itself; the page never does */
  get fits(): boolean {
    return this.mq.matches && this.enabled();
  }

  /** the pages are in force (the screen fits and the long lists are paged) */
  get on(): boolean {
    return this.fits && this.lists.paged;
  }

  get pages(): number {
    return !this.on || !this.starts ? 1 : Math.max(1, this.starts.length - 1);
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
    this.starts = null;
    this.page = 1;
  }

  /** Called while rendering: how many cards there are and what identifies the set (keys + filters). A new set starts at page 1. */
  sync(total: number, sig: string) {
    if (sig !== this.sig || total !== this.total) {
      this.sig = sig;
      this.total = total;
      this.reset();
    }
    if (this.page > this.pages) this.page = this.pages;
  }

  /** Is the card at reading-order index `i` on the current page? */
  shows(i: number): boolean {
    if (!this.on || !this.starts) return true;
    return i >= this.starts[this.page - 1] && i < this.starts[this.page];
  }

  go(page: number) {
    this.page = Math.min(Math.max(1, page), this.pages);
    this.host.requestUpdate();
  }

  hostUpdated() {
    if (!this.on) return;
    const r = this.region();
    if (r && r !== this.observed && typeof ResizeObserver !== 'undefined') {
      this.ro?.disconnect();
      this.observed = r;
      this.size = '';
      this.ro = new ResizeObserver(([e]) => {
        const s = `${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`;
        if (s === this.size) return;
        const first = this.size === '';
        this.size = s;
        if (first) return;
        this.reset(); // the region changed size: measure from every card again
        this.host.requestUpdate();
      });
      this.ro.observe(r);
    }
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.measure());
  }

  private geo(r: HTMLElement): { els: HTMLElement[]; g: Geo[] } {
    // the cards of the other pages are out of the layout (display: none): only the drawn ones count
    const els = fitItems(r).filter((el) => el.getClientRects().length > 0);
    const g = els.map((el) => {
      const b = el.getBoundingClientRect();
      const sec = sectionOf(el);
      const grid = el.parentElement;
      const head = sec && grid ? grid.getBoundingClientRect().top - sec.getBoundingClientRect().top : 0;
      return { top: b.top, bottom: b.bottom, sec, head };
    });
    return { els, g };
  }

  /** How many cards from `i` fit below `y0` (whole rows; a first row that does not fit whole keeps its leading cards that do, at least one). */
  private fitFrom(g: Geo[], i: number, y0: number, limit: number): number {
    let k = 0;
    let lead = 0;
    let j = i;
    let firstRow = true;
    while (j < g.length) {
      const row = g[j];
      let n = 0;
      let ok = true;
      while (j + n < g.length && g[j + n].sec === row.sec && Math.abs(g[j + n].top - row.top) <= 2) {
        const fits = g[j + n].bottom - y0 <= limit + 0.5;
        if (!fits) ok = false;
        else if (firstRow && ok) lead++;
        n++;
      }
      if (!ok) break;
      k += n;
      j += n;
      firstRow = false;
    }
    return k || Math.max(1, lead);
  }

  /** The top of the first drawn section (where a page's content starts). */
  private firstTop(r: HTMLElement): number {
    const sec = [...r.querySelectorAll('section')].find((s) => s.getClientRects().length > 0);
    return (sec ?? r).getBoundingClientRect().top;
  }

  private measure() {
    const r = this.region();
    if (!r || !this.on) return;
    const bottom = r.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(r).paddingBlockEnd) || 0);
    const { g } = this.geo(r);
    if (!g.length) return;
    if (!this.starts) {
      if (r.scrollHeight - r.clientHeight <= 1) {
        this.starts = [0, g.length];
        return;
      }
      // every card is drawn: compute every page break from this one layout
      const base = this.firstTop(r);
      const room = bottom - base;
      const starts = [0];
      let i = 0;
      while (i < g.length) {
        // where the page's content starts in this layout: page 1 at the region's first section, a later page at its first row minus the
        // section heading it draws again
        const y0 = i === 0 ? base : g[i].top - g[i].head;
        i += this.fitFrom(g, i, y0, room);
        starts.push(i);
      }
      this.starts = starts;
      this.page = 1;
      this.host.requestUpdate();
      return;
    }
    // a drawn page: if it still overflows, split it where it does (the pages before it keep their cards)
    if (r.scrollHeight - r.clientHeight <= 1) return;
    const base = this.firstTop(r);
    const k = this.fitFrom(g, 0, base, bottom - base);
    const s = this.starts[this.page - 1];
    if (k >= this.starts[this.page] - s) return;
    this.starts.splice(this.page, 0, s + k);
    this.host.requestUpdate();
  }
}
