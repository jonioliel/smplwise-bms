import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { applyAutomationsGlass } from '../styles/glass';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type Meta, type ModuleState } from '../api/tickets';
import { SkinController } from '../design/skin';
import { replaceRoute, type RouteState } from '../router';
import { PAGED_MQ } from '../screens/tickets-pages';
import { measureHeaderBar } from '../styles/media-page';
import { tIcon } from './icons';
import { NO_CARD_FILTERS, type CardFilters } from './list-filters';
import { FilterPanelController } from './list-toolbar';
import type { LiveRefresh } from './live-refresh';
import { ticketHref } from './model';
import { onTicketNames, setTicketNames } from './naming';
import { tt } from './text';
import type { TicketCardAction } from './ticket-card';

type ViewScreen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off';

/** `#/tickets/mine?status=open` -> the path and the params the router writes (no history entry for a filter keystroke). */
export function writeHref(href: string, replace: boolean): void {
  if (!replace) {
    window.location.hash = href;
    return;
  }
  const raw = href.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  replaceRoute(path, new URLSearchParams(query));
}

/**
 * CR-DUP-TICKETS-VIEWS (review 06:DUP-4): the rules the list page and the manager board both carried, word for word. Each screen places
 * this fragment directly before its own `css` block, so every rule here still comes before that screen's own rules and after the shared
 * sheets, as it did when it was written inside the block.
 */
export const ticketViewStyles = css`
  .cgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: var(--dv-gap-lg, 16px);
    align-items: stretch;
  }
  .flt {
    position: fixed;
    inset-block-end: 24px;
    inset-inline: 0;
    margin-inline: auto;
    inline-size: fit-content;
    max-inline-size: calc(100% - 32px);
    box-sizing: border-box;
    z-index: 40;
    box-shadow: var(--dv-shadow-2);
  }
  /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the screen's
     content scrolls in its own region - the page itself never scrolls and the controls stay in place. On a phone the region is transparent
     (display: contents) and the page scrolls. */
  .scr {
    display: contents;
  }
  /* AUDIT30-C-TICKETS (#6): sw-page is the frame (its header row: the title, the actions slot); the toolbar under it no longer sticks or
     compacts - the title it compacted moved into the frame (on a phone the page scrolls, the toolbar with it) */
  .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dh {
    position: static;
    padding-block-start: 0;
  }
  @media (min-width: 768px) {
    :host {
      overflow: hidden;
    }
    .page {
      block-size: 100%;
      min-block-size: 0;
      box-sizing: border-box;
      padding-block-end: 0;
      gap: 18px;
    }
    .scr {
      display: flex;
      flex-direction: column;
      gap: 18px;
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--dv-border-strong) transparent;
      margin-inline: -36px;
      padding: 2px 36px 28px;
    }
  }
  @media (min-width: 768px) and (max-width: 1023px) {
    .scr {
      margin-inline: -24px;
      padding-inline: 24px;
    }
  }
  @media (max-width: 767px) {
    .flt {
      inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
    }
  }
`;

/**
 * CR-DUP-TICKETS-VIEWS (review 06:DUP-4): what the list page (`tickets-list`) and the manager board (`tickets-board`) hold in common - the
 * module / meta / screen states, the phone and paged media queries, the search box's debounce, the toast, the "סינון" panel controller,
 * the card-height bookkeeping of the pages, the card actions and the connect / disconnect plumbing. A screen keeps its own route, data,
 * load, filters and render; where the two differ (the address a card opens, what a typed search writes, what is measured) it answers
 * through the abstract members below.
 */
export abstract class TicketsViewBase extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() protected module: ModuleState | null = null;
  @state() protected meta: Meta | null = null;
  @state() protected screen: ViewScreen = 'loading';
  @state() protected failed = '';
  @state() protected phone = window.matchMedia('(max-width: 767px)').matches;
  @state() protected drawerUsed = false;
  @state() protected toast: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() protected now = new Date();
  @state() protected q = '';
  @state() protected filterOpen = false;
  /** TKUI4: the card filters over the held cards (TICKETS-POLISH-2331: in the one "סינון" panel) */
  @state() protected filters: CardFilters = { ...NO_CARD_FILTERS };
  /** TICKETS-POLISH-2331: the "סינון" panel - Escape, a press outside, the focus in and back */
  readonly panelCtl = new FilterPanelController(this, () => this.filterOpen, (open) => (this.filterOpen = open));
  /** NOSCROLL-1366-2437: on a desktop the cards are cut into pages that fit the measured room; the pager sits on the toolbar row */
  @state() protected paged = window.matchMedia(PAGED_MQ).matches;
  @state() protected cardPage = 1;
  private pagedMq = window.matchMedia(PAGED_MQ);
  /** protected: the screens' long-lists setting (PAGING-SETTING-2439) re-measures through it when the setting flips */
  protected onPaged = () => {
    this.paged = this.pagedMq.matches;
    this.resetFit();
  };
  /** the tallest each card was seen (by request id): a row of the pages is as tall as its tallest card */
  protected cardH = new Map<string, number>();
  private fitObserver: ResizeObserver | null = null;
  protected fitBox: Element | null = null;
  /** the pages of the current render (counted in render() before the toolbar is drawn) */
  protected pageCount = 1;
  private pageKey = '';
  /** the text last typed into the search box, until the address carries it */
  private pendingQ: string | null = null;
  protected seq = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private qTimer = 0;
  private toastTimer = 0;
  private offNames: (() => void) | null = null;

  /** 2.5.4: the shared poller; each screen says what a tick does */
  protected abstract live: LiveRefresh;
  /** After the module answered "on": read the meta (and whatever else the screen needs before its first load). */
  protected abstract loadMeta(): Promise<void>;
  protected abstract reloadIfNeeded(force?: boolean): void;
  /** The address that opens request `id` in the drawer over this screen. */
  protected abstract openHref(id: string): string;
  /** This screen's own address with no request open and nothing being created. */
  protected abstract plainHref(): string;
  /** The debounced search text goes into the address. */
  protected abstract searchTo(v: string): void;
  /** The pages box to observe (null while the screen is not paged). */
  protected abstract fitTarget(): Element | null;
  protected abstract measureFit(): void;
  /** The paged media query flipped: forget everything measured. */
  protected abstract resetFit(): void;

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.pagedMq.addEventListener('change', this.onPaged);
    this.offNames = onTicketNames(() => this.requestUpdate());
    this.live.start();
    void this.boot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.pagedMq.removeEventListener('change', this.onPaged);
    this.fitObserver?.disconnect();
    this.fitObserver = null;
    this.fitBox = null;
    this.offNames?.();
    this.live.stop();
    window.clearTimeout(this.qTimer);
    window.clearTimeout(this.toastTimer);
  }

  protected updated(): void {
    measureHeaderBar(this.renderRoot, this.phone);
    this.watchFit();
  }

  /** Observe the pages box (its height is the room the layout leaves it, not its content) and measure after every draw. */
  private watchFit() {
    const box = this.fitTarget();
    if (box !== this.fitBox) {
      this.fitObserver?.disconnect();
      this.fitObserver = null;
      this.fitBox = box;
      if (box && typeof ResizeObserver !== 'undefined') {
        this.fitObserver = new ResizeObserver(() => this.measureFit());
        this.fitObserver.observe(box);
      }
    }
    if (box) this.measureFit();
  }

  /** Remember the tallest each card was seen; true when one grew. */
  protected noteCardHeights(cards: readonly HTMLElement[]): boolean {
    let grew = false;
    for (const c of cards) {
      const id = (c as unknown as { item?: { id?: string } }).item?.id;
      if (id && c.offsetHeight > (this.cardH.get(id) ?? 0)) {
        this.cardH.set(id, c.offsetHeight);
        grew = true;
      }
    }
    return grew;
  }

  /** The page of cards on screen (the wanted one, kept inside the pages of this render). */
  protected pageAt(): number {
    return Math.min(Math.max(1, this.cardPage), this.pageCount);
  }

  /** The search box keeps what is being typed when the address change is our own debounced write (a trailing space survives). */
  protected syncSearch(q: string): void {
    if (this.pendingQ === null || q !== this.pendingQ.trim()) {
      this.q = q;
      this.pendingQ = null;
    }
  }

  /** A new scope or filter starts at the first page of cards (opening a request - the drawer's address - keeps the page). */
  protected firstPageOn(key: string): void {
    if (key !== this.pageKey) {
      this.pageKey = key;
      this.cardPage = 1;
    }
  }

  // ---------------------------------------------------------------- data

  protected async boot(): Promise<void> {
    try {
      const m = await ticketsApi().module();
      this.module = m;
      setTicketNames(m.name);
      if (!m.enabled) {
        this.screen = 'off';
        return;
      }
      await this.loadMeta();
      this.reloadIfNeeded(true);
    } catch (e) {
      this.fail(e);
    }
  }

  protected fail(e: unknown): void {
    if (e instanceof ApiError && e.status === 403) this.screen = 'forbidden';
    else if (e instanceof ApiError && e.status === 404 && e.body.code === 'feature_disabled') this.screen = 'off';
    else {
      this.failed = describeError(e);
      this.screen = 'error';
    }
  }

  protected say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.toast = { text, tone };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), tone === 'bad' ? 7000 : 3500);
  }

  // ---------------------------------------------------------------- navigation

  protected onSearch(v: string): void {
    this.q = v;
    this.pendingQ = v;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => this.searchTo(v), 300);
  }

  protected detailMode() {
    return this.module?.ui.detail ?? 'drawer_fullscreen';
  }

  protected hrefOf(id: string, timeline = false): string {
    if (this.detailMode() === 'fullscreen') return ticketHref(id);
    const href = this.openHref(id);
    return timeline ? `${href}${href.includes('?') ? '&' : '?'}view=timeline` : href;
  }

  protected onCardAction = (e: CustomEvent<{ item: { id: string }; action: TicketCardAction }>) => {
    const { item, action } = e.detail;
    if (action === 'open') writeHref(this.hrefOf(item.id), false);
    else if (action === 'full') writeHref(ticketHref(item.id), false);
    else if (action === 'copy') {
      const url = `${location.origin}${location.pathname}${location.search}${ticketHref(item.id)}`;
      void navigator.clipboard?.writeText(url).then(() => this.say(tt('linkCopied'))).catch(() => this.say(url));
    }
  };

  protected closeDrawer = () => this.isConnected && writeHref(this.plainHref(), false);

  // ---------------------------------------------------------------- render

  protected stateBox(icon: Parameters<typeof tIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-tickets-state=${kind}><span class="ring">${tIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  protected toastView(): TemplateResult | typeof nothing {
    return this.toast ? html`<div class=${`banner flt ${this.toast.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-tickets-toast>${tIcon(this.toast.tone === 'bad' ? 'warning' : 'check')}<div>${this.toast.text}</div></div>` : nothing;
  }
}
