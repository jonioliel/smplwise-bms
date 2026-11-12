import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../tickets/ticket-card';
import { parseAssignParam, withAssign } from '../tickets/create-assign-model'; // TKUI1: the new-request sheet's vendor flow
import '../tickets/ticket-detail';
import '../tickets/ticket-create';
import '../tickets/board-tree';
import './tickets-handlers'; // CR-DEPT-MANAGER-HANDLERS: the board's "מטפלים וספקים" pane
import '../components/sw-pager';
import '../components/sw-page';
import { PAGED_MQ, gridCols, packPages, rowGap, type PackGroup, type PackSection, type PageSection } from './tickets-pages';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { replaceRoute, type RouteState } from '../router';
import { ticketsApi, type Meta, type ModuleState, type TicketDetail } from '../api/tickets';
import { saveBoardPrefs } from '../api/tickets-table';
import { boardApi, boardUiOf, type BoardItem, type BoardResponse, type BoardUi } from '../api/tickets-board';
import { relTime, ticketHref, listHref } from '../tickets/model';
import { lastScope } from '../tickets/model';
import { tt } from '../tickets/text';
import { bt } from '../tickets/board-text';
import { ot } from '../tickets/overview-text';
import { tIcon } from '../tickets/icons';
import { onTicketNames, setTicketNames } from '../tickets/naming';
import { ageOf, boardHref, floorChips, floorsLayout, groupingOn, parseBoardRoute, placeLabel, sections, stripItems, type BoardRoute } from '../tickets/board-model';
import type { TicketCardAction } from '../tickets/ticket-card';
import { dlt } from '../tickets/delete-text';
import { LiveRefresh } from '../tickets/live-refresh';
import { listViewSwitch, type ListMode } from '../tickets/list-view-switch';
import { setCalendarWanted } from '../tickets/calendar-mode';
import { applyCardFilters, NO_CARD_FILTERS, type CardFilters } from '../tickets/list-filters';
import { cardFilterChips, filterRow } from '../tickets/list-filter-row';
import { activeChips, filterPanel, filterToggle, FilterPanelController, panelSection, ticketToolbarStyles, type ActiveChip } from '../tickets/list-toolbar';
import { roleFor, avatarPair } from '../tickets/list-card-model';
import { loadMeter, todayEntries } from '../tickets/board-today';
import { lt } from '../tickets/list-text';
import { oldestOpenText } from '../tickets/elapsed-model';
import { ticketBoardV5Styles, ticketListFrameStyles } from '../tickets/list-styles';
import { ticketChipSelected } from '../tickets/chip-selected'; // AUDIT30-C-TICKETS: one selected chip look (#4)

type Screen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off';

function writeHref(href: string, replace: boolean): void {
  if (!replace) {
    window.location.hash = href;
    return;
  }
  const raw = href.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  replaceRoute(path, new URLSearchParams(query));
}

/**
 * CR-038 slice 6, the manager board (`#/tickets/board`, section 13.5; mock-up v2 "לוח"): the large title, the department chips with
 * counts, the state strip with counts (D21: הכול · ממתינות לי · תקועות · ללא מטפל · and "נסגרו השבוע" / "סגורות (הכול)" / nothing), the
 * text filter, "+ חדשה", a one-line banner for the stuck ones, and the cards - grouped into ממתין לי / תקועות / בטיפול (by assignee)
 * when D20 says so, with the recently closed ones collapsed at the end. The floors (D19) are a side tree with counts, or chips, or chips
 * with the tree behind "סינון"; each user may hide the tree (D30, remembered in /me/prefs). A card opens the drawer or the full screen
 * (D18), "+" the sheet or the dialog (D22). The server's single visibility rule decides every row and every count; the board polls every
 * 30 s while the tab is visible. States: loading, empty, no match, error, not a manager, the module off.
 */
@customElement('tickets-board')
export class TicketsBoard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private r: BoardRoute = parseBoardRoute(new URLSearchParams());
  @state() private module: ModuleState | null = null;
  @state() private meta: Meta | null = null;
  @state() private data: BoardResponse | null = null;
  @state() private screen: Screen = 'loading';
  @state() private failed = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private treeHidden = false;
  @state() private filterOpen = false;
  @state() private showClosed = false;
  @state() private drawerUsed = false;
  @state() private now = new Date();
  @state() private q = '';
  @state() private toast: { text: string; tone: 'ok' | 'bad' } | null = null;
  /** TKUI4: the card filters over the held cards (TICKETS-POLISH-2331: in the one "סינון" panel), and the title that compacts while the page scrolls */
  @state() private filters: CardFilters = { ...NO_CARD_FILTERS };
  /** TICKETS-POLISH-2331: the "סינון" panel - Escape, a press outside, the focus in and back */
  readonly panelCtl = new FilterPanelController(this, () => this.filterOpen, (open) => (this.filterOpen = open));
  private pendingQ: string | null = null;
  private key = '';
  private seq = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  /** NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, owner option 1): on a desktop the board's groups are
   *  cut into pages that fit the room under the "today" row and the banner - whole card rows, a group's header counted, a group that runs
   *  over the page edge continues on the next page under its header. The pager sits on the toolbar row. `fit` = the measured room and
   *  sizes (null until measured: the first draw shows everything once, to measure it). */
  @state() private paged = window.matchMedia(PAGED_MQ).matches;
  @state() private cardPage = 1;
  @state() private fit: { room: number; cols: number; rowH: number; gap: number; headH: number; subH: number; secGap: number; inGap: number; blkGap: number; crH: number; crPad: number } | null = null;
  private pagedMq = window.matchMedia(PAGED_MQ);
  private onPaged = () => {
    this.paged = this.pagedMq.matches;
    this.fit = null;
    this.maxH = { row: 0, head: 0, sub: 0, cr: 0 };
    this.cardH.clear();
  };
  /** the tallest card / header / handler line / closed row seen so far: they only grow, so the pages never overflow and never loop */
  private maxH = { row: 0, head: 0, sub: 0, cr: 0 };
  /** the tallest each card was seen (by request id): a row of the pages is as tall as its tallest card */
  private cardH = new Map<string, number>();
  private fitObserver: ResizeObserver | null = null;
  private fitBox: Element | null = null;
  private pageCount = 1;
  private pageKey = '';
  private qTimer = 0;
  private live = new LiveRefresh(() => { this.now = new Date(); if (this.screen === 'ready') void this.load(true); }); // 2.5.4: shared poller
  private toastTimer = 0;
  private offNames: (() => void) | null = null;
  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, ticketListFrameStyles, ticketBoardV5Styles, ticketToolbarStyles, css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .layout.with-tree {
      grid-template-columns: 280px minmax(0, 1fr);
    }
    .side {
      position: sticky;
      inset-block-start: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* TICKETS-POLISH-2331 (audit §7.5.9): the tree's own head carries its hide control (it was a third button on the title row) */
    .sidehead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-inline: 6px 2px;
      min-block-size: 32px;
    }
    .sidehead b {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      color: var(--dv-text-2);
    }
    .sidehead .btn {
      box-shadow: none;
    }
    .treeshow {
      flex: none;
      margin-inline-start: auto;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .cnt {
      display: inline-grid;
      place-items: center;
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 6px;
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--dv-warning-soft);
      color: var(--au-warn-text);
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .seg button small,
    .rc small {
      font-variant-numeric: tabular-nums;
      margin-inline-start: 6px;
    }
    /* a floor's count is a small badge, never read as part of the floor's own number ("קומה 1" + 2) */
    .rc small {
      display: inline-grid;
      place-items: center;
      min-inline-size: 18px;
      block-size: 18px;
      padding-inline: 5px;
      box-sizing: border-box;
      margin-inline-start: 8px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--dv-text) 8%, transparent);
      color: var(--dv-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .rc[aria-pressed='true'] small {
      background: color-mix(in srgb, currentColor 18%, transparent);
      color: inherit;
    }
    .sub {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-inline: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .sub b {
      color: var(--dv-text);
      font-size: var(--sw-fs-md);
    }
    .assignee-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      text-align: center;
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
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the board (the
       today row, the tree, the groups of cards) scrolls in its own region - the page itself never scrolls and the controls stay in place;
       the tree stays beside the cards (sticky inside the region). On a phone the region is transparent and the page scrolls. */
    .scr {
      display: contents;
    }
    /* AUDIT30-C-TICKETS (#6): the page is sw-page (its own header row: the title and the actions slot). The frame's own gap and
       padding give way to the glass page's (.page, styles/media-page.ts); the toolbar header under it no longer sticks or compacts - the
       title it compacted moved into the frame (on a phone the page scrolls, the toolbar with it). */
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
    .dh:empty {
      display: none;
    }
    /* AUDIT30-C-TICKETS (#17): a group's heading is a section title (--sw-fs-xl), a clear step below the page title - it was
       --sw-fs-3xl / 800 (26 px) under a 30 px title */
    .fsec > .sh h2 {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
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
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5): on a desktop the board is paged - the "today"
       row and the banner stay, the groups take the room left (.pgbox: its height set by the layout, never by the cards) and show what fits;
       the tree scrolls inside its own column; the pager is at the end of the toolbar row. The region keeps overflow: auto only as the
       fallback of a window shorter than one group header and one row of cards. */
    .bpager {
      flex: none;
      margin-inline-start: auto;
    }
    @media (min-width: 1024px) {
      .scr.paged {
        padding-block-end: 20px;
      }
      .scr.paged > .layout {
        flex: 1 1 0;
        min-block-size: 0;
        grid-template-rows: minmax(0, 1fr);
        align-items: stretch;
      }
      .scr.paged .side {
        position: static;
        min-block-size: 0;
        max-block-size: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .scr.paged [data-board-main] {
        min-block-size: 0;
        gap: 14px;
      }
      .scr.paged .pgbox {
        flex: 1 1 0;
        min-block-size: 0;
      }
      .scr.paged .pgbox > .groups {
        gap: 18px;
      }
      .scr.paged .pgbox .cgrid {
        align-content: start;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .scr {
        margin-inline: -24px;
        padding-inline: 24px;
      }
      .layout.with-tree {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      /* a portrait tablet: "סינון" and "+ חדשה" are icon buttons (their names stay in aria-label), and the toolbar may take a second line
         rather than run past the screen's edge (the layout guard found both labels cut by the board at 768) */
      .tb .filterbtn .lbl,
      .pact .newbtn .lbl {
        display: none;
      }
      .pact .newbtn {
        min-inline-size: 44px;
        justify-content: center;
      }
      .dh-det.tb {
        flex-wrap: wrap;
      }
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 'r r r';
      }
      /* the state strip (in the "סינון" sheet on a phone): three a row (nothing hidden behind a scroll, every count readable) */
      .fpop .seg.stf {
        grid-auto-flow: row;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `, ticketChipSelected];

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

  /** The board's cards are paged: a desktop, the board pane, the board drawn. */
  private pagedBoard(): boolean {
    return this.paged && this.screen === 'ready' && this.r.pane !== 'handlers' && !!this.data?.items.length;
  }

  /** Observe the pages box (its height is the room the layout leaves it, not its content) and measure after every draw. */
  private watchFit() {
    const box = this.pagedBoard() ? this.renderRoot.querySelector('[data-board-pages]') : null;
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

  private measureFit() {
    const box = this.fitBox as HTMLElement | null;
    if (!box || !box.isConnected) return;
    const grid = box.querySelector('.cgrid');
    const cards = [...box.querySelectorAll<HTMLElement>('.cgrid > ticket-card')];
    if (!grid || !cards.length) return;
    const tallest = (sel: string) => Math.max(0, ...[...box.querySelectorAll<HTMLElement>(sel)].map((e) => e.offsetHeight));
    const m = this.maxH;
    m.row = Math.max(m.row, ...cards.map((c) => c.offsetHeight));
    let grew = false;
    for (const c of cards) {
      const id = (c as unknown as { item?: { id?: string } }).item?.id;
      if (id && c.offsetHeight > (this.cardH.get(id) ?? 0)) {
        this.cardH.set(id, c.offsetHeight);
        grew = true;
      }
    }
    m.head = Math.max(m.head, tallest('.fsec > .sh'));
    m.sub = Math.max(m.sub, tallest('.assignee-block > .sub'));
    m.cr = Math.max(m.cr, tallest('.closedrows > .cr'));
    const rows = box.querySelector('.closedrows');
    const crPad = rows ? (parseFloat(getComputedStyle(rows).paddingBlockStart) || 0) + (parseFloat(getComputedStyle(rows).paddingBlockEnd) || 0) : 8;
    const next = {
      room: box.clientHeight,
      cols: gridCols(grid),
      rowH: m.row,
      gap: rowGap(grid),
      headH: m.head || 40,
      subH: m.sub || 36,
      secGap: rowGap(box.querySelector(':scope > .groups')),
      inGap: rowGap(box.querySelector('.fsec')),
      blkGap: rowGap(box.querySelector('.assignee-block')) || 10,
      crH: m.cr || 44,
      crPad,
    };
    const f = this.fit;
    if (!f || grew || (Object.keys(next) as (keyof typeof next)[]).some((k) => f[k] !== next[k])) this.fit = next;
  }

  /** TKUI4: the view switch of the board - cards / table go back to the list (the choice is remembered, as on the list), "board" stays. */
  /** The state strip's tooltip: how long the oldest open request of that state has been open (elapsed time, not an SLA rule). */
  private stripTip(id: string): string {
    const d = this.data;
    if (!d || id === 'closed') return '';
    const pick = id === 'waiting' ? (x: BoardItem) => x.group === 'waiting' : id === 'stuck' ? (x: BoardItem) => !!x.stuck : id === 'unassigned' ? (x: BoardItem) => ['new', 'returned'].includes(x.status) : () => true;
    return oldestOpenText(d.items.filter(pick), this.now);
  }

  private pickMode = (m: ListMode): void => {
    if (m === 'board') return;
    // TKCAL: the calendar is a mode of the list page: the board's switch returns to the list in that mode
    setCalendarWanted(m === 'calendar');
    if (m !== 'calendar') void saveBoardPrefs({ view: m });
    window.location.hash = listHref(lastScope());
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('route') && this.route) {
      this.r = parseBoardRoute(this.route.params);
      if (this.r.ticketId) this.drawerUsed = true;
      if (this.pendingQ === null || this.r.q !== this.pendingQ.trim()) {
        this.q = this.r.q;
        this.pendingQ = null;
      }
      if (this.screen === 'ready' || this.screen === 'error') this.reloadIfNeeded();
      // a new filter starts at the first page (opening a request - the drawer's address - keeps the page)
      const key = [this.r.q, this.r.dept, this.r.place, this.r.state, this.r.pane].join('|');
      if (key !== this.pageKey) {
        this.pageKey = key;
        this.cardPage = 1;
      }
    }
    const c = changed as Map<PropertyKey, unknown>; // private states: not in PropertyValues<this>
    if (c.has('filters') || c.has('showClosed')) this.cardPage = 1;
  }

  // ---------------------------------------------------------------- data

  private async boot(): Promise<void> {
    try {
      const m = await ticketsApi().module();
      this.module = m;
      setTicketNames(m.name);
      if (!m.enabled) {
        this.screen = 'off';
        return;
      }
      const [meta, hidden] = await Promise.all([ticketsApi().meta(), boardApi().treeHidden().catch(() => false)]);
      this.meta = meta;
      this.treeHidden = hidden;
      this.reloadIfNeeded(true);
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    if (e instanceof ApiError && e.status === 403) this.screen = 'forbidden';
    else if (e instanceof ApiError && e.status === 404 && e.body.code === 'feature_disabled') this.screen = 'off';
    else {
      this.failed = describeError(e);
      this.screen = 'error';
    }
  }

  private queryKey(): string {
    return `${this.r.state}|${this.r.dept}|${this.r.place}|${this.r.q.trim()}|${this.r.assignee ?? ''}`;
  }

  private reloadIfNeeded(force = false): void {
    const k = this.queryKey();
    if (!force && k === this.key) return;
    this.key = k;
    void this.load(false);
  }

  /** `quiet`: the 30 s refresh - the cards stay as they are while it runs, and a failure keeps the last answer. */
  private async load(quiet: boolean): Promise<void> {
    const seq = ++this.seq;
    if (!quiet && !this.data) this.screen = 'loading';
    try {
      const d = await boardApi().board({ state: this.r.state, department_id: this.r.dept || undefined, place: this.r.place || undefined, q: this.r.q, assignee: this.r.assignee || undefined });
      if (seq !== this.seq) return;
      this.data = d;
      this.now = new Date();
      this.screen = 'ready';
    } catch (e) {
      if (seq !== this.seq || quiet) return;
      this.fail(e);
    }
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.toast = { text, tone };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), tone === 'bad' ? 7000 : 3500);
  }

  /** MGRDASH: the name on the chip of the handler filter (a row of the overview's load card opens the board filtered to one handler). */
  private assigneeName(): string {
    const key = this.r.assignee ?? '';
    if (key === 'none') return bt('noAssigneeGroup');
    const it = this.data?.items.find((x) => x.assignee_key === key) ?? this.data?.closed.find((x) => x.assignee_key === key);
    return it?.assignee?.name ?? this.data?.handling.find((h) => h.key === key)?.name ?? ot('ldTitle');
  }

  private ui(): BoardUi {
    return boardUiOf(this.data ? ({ ...(this.module as ModuleState), ui: { ...(this.module?.ui ?? {}), ...this.data.ui } } as ModuleState) : this.module);
  }

  // ---------------------------------------------------------------- navigation

  private go(patch: Partial<BoardRoute>, replace = false): void {
    writeHref(boardHref({ ...this.r, ...patch }, { t: this.r.ticketId || undefined }), replace);
  }

  private onSearch(v: string): void {
    this.q = v;
    this.pendingQ = v;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => this.go({ q: v }, true), 300);
  }

  private detailMode() {
    return this.module?.ui.detail ?? 'drawer_fullscreen';
  }

  private hrefOf(id: string, timeline = false): string {
    if (this.detailMode() === 'fullscreen') return ticketHref(id);
    const href = boardHref(this.r, { t: id });
    return timeline ? `${href}${href.includes('?') ? '&' : '?'}view=timeline` : href;
  }

  private onCardAction = (e: CustomEvent<{ item: BoardItem; action: TicketCardAction }>) => {
    const { item, action } = e.detail;
    if (action === 'open') writeHref(this.hrefOf(item.id), false);
    else if (action === 'full') writeHref(ticketHref(item.id), false);
    else if (action === 'copy') {
      const url = `${location.origin}${location.pathname}${location.search}${ticketHref(item.id)}`;
      void navigator.clipboard?.writeText(url).then(() => this.say(tt('linkCopied'))).catch(() => this.say(url));
    }
  };

  private closeDrawer = () => this.isConnected && writeHref(boardHref(this.r), false);

  /** 2.5.4: gone or deleted - the drawer closes, a deleted request leaves the board at once (confirmation shown), then a quiet re-read. */
  private onGone = (e: CustomEvent<{ id: string; deleted?: boolean }>) => {
    this.closeDrawer();
    if (e.detail?.deleted) {
      this.say(dlt('deletedOne'));
      const id = e.detail.id;
      if (this.data) this.data = { ...this.data, items: this.data.items.filter((x) => x.id !== id), closed: this.data.closed.filter((x) => x.id !== id) };
    }
    void this.load(true);
  };

  private async setTreeHidden(hidden: boolean): Promise<void> {
    this.treeHidden = hidden;
    try {
      await boardApi().setTreeHidden(hidden);
    } catch {
      /* the choice still holds on this screen; the server keeps the previous one */
    }
  }

  // ---------------------------------------------------------------- render

  /** TICKETS-POLISH-2331: every board filter that is not at its default (the state strip and the text have their own controls). */
  private chips(): ActiveChip[] {
    const d = this.data;
    const out: ActiveChip[] = [];
    if (this.r.dept) {
      const x = d?.departments.find((y) => y.id === this.r.dept);
      out.push({ key: 'department', label: x ? x.name : lt('tbDept'), remove: () => this.go({ dept: '' }) });
    }
    // MGRDASH: the handler filter (a row of the overview's load card opens the board filtered to one handler)
    if (this.r.assignee) out.push({ key: 'assignee', label: this.assigneeName(), remove: () => this.go({ assignee: undefined }), attrs: { 'data-assignee-filter': this.r.assignee, 'aria-label': ot('clearHandler', { name: this.assigneeName() }) } });
    if (d) out.push(...cardFilterChips([...d.items, ...d.closed], this.filters, (next) => (this.filters = next)));
    return out;
  }

  private resetFilters = (): void => {
    this.filters = { ...NO_CARD_FILTERS };
    if (this.r.dept || this.r.assignee) this.go({ dept: '', assignee: undefined });
  };

  /** The "סינון" panel of the board: the departments with their counts, the floors tree (D19 "chips + tree in the filter"), the card filters. */
  private panelBody(layout: ReturnType<typeof floorsLayout>, strip: TemplateResult | typeof nothing = nothing): TemplateResult {
    const d = this.data;
    const depts = d?.departments ?? [];
    return html`
      ${strip === nothing ? nothing : panelSection(bt('stateStrip'), strip, 'state')}
      ${depts.length > 1 ? panelSection(lt('tbDept'), html`<div class="fchips" role="group" aria-label=${tt('departmentsGroup')} data-dept-chips>
        <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${() => this.go({ dept: '' })}>${tt('allDepartments')}<small>${depts.reduce((s, x) => s + x.count, 0)}</small></button>
        ${depts.map((x) => html`<button type="button" class="rc" aria-pressed=${String(this.r.dept === x.id)} data-dept=${x.id} @click=${() => this.go({ dept: x.id })}>${bidi(x.name)}<small>${x.count}</small></button>`)}
      </div>`, 'department') : nothing}
      ${layout.treeInFilter && d ? panelSection(lt('tbPlace'), this.tree(d), 'place') : nothing}
      ${d ? filterRow([...d.items, ...d.closed], this.filters, (next) => (this.filters = next)) : nothing}`;
  }

  private tree(d: BoardResponse): TemplateResult {
    const total = d.tree.reduce((s, n) => s + (n.parent ? 0 : n.count), 0);
    return html`<ticket-board-tree .nodes=${d.tree} .selected=${this.r.place} .total=${total} @place-pick=${(e: CustomEvent<{ key: string }>) => this.go({ place: e.detail.key })}></ticket-board-tree>`;
  }

  /**
   * TICKETS-POLISH-2331 (design audit 27.10, P1-5): the title row - the title, the manager's board / handlers switch, the floor chips (D19)
   * and the page actions (view switch, "+ חדשה"); ONE toolbar - the state strip with its counts (the board's scope), the search, "סינון"
   * (departments, the floors tree when D19 puts it there, priority, handler, flags) and the chips of what is narrowed now.
   */
  private header(): TemplateResult {
    const d = this.data;
    const ui = this.ui();
    const layout = floorsLayout(ui.board_floors, this.treeHidden, this.phone);
    const tools = this.screen === 'ready' || this.screen === 'loading';
    const canCreate = !!this.meta?.can.create;
    const floor = d && layout.chips ? floorChips(d.tree) : [];
    const handlersPane = this.r.pane === 'handlers';
    const chips = this.chips();
    // AUDIT30-C-TICKETS (#6): the title is sw-page's (the one page frame); the board / handlers switch, the view switch and "+ חדשה" sit in
    // its actions slot (#8 / B6: "+ חדשה" moves to sw-page's `primary` slot once branch B adds it). Below the frame's header: the floor
    // chips (when D19 puts them there) and ONE toolbar.
    const paneSwitch = this.meta?.can.manage ? html`<div class="seg sm" role="radiogroup" aria-label=${tt('dmPaneGroup')} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!handlersPane)} data-pane="cards" @click=${() => this.go({ pane: 'cards' })}>${tt('area')}</button>
          <button type="button" role="radio" aria-checked=${String(handlersPane)} data-pane="handlers" @click=${() => this.go({ pane: 'handlers' })}>${tt('hdTitle')}</button>
        </div>` : nothing;
    const actions = html`<div class="pact" slot="actions">
      ${paneSwitch}
      ${tools && !handlersPane ? html`${listViewSwitch('board', true, this.pickMode)}
        ${canCreate ? html`<button type="button" class="btn primary newbtn" data-new aria-label=${tt('newTitle')} @click=${() => writeHref(boardHref(this.r, { create: true }), false)}>${tIcon('plus')}<span class="lbl">${tt('newShort')}</span></button>` : nothing}` : nothing}
    </div>`;
    // AUDIT30-C-TICKETS (#9, Q14 option 1): on a phone the state strip goes into the one "סינון" sheet (with the departments): at most two
    // rows of keys above the cards
    const strip = d ? html`<div class="seg sm stf" role="radiogroup" aria-label=${bt('stateStrip')} data-state-strip>
          ${stripItems(ui.closed_strip, d.counts).map((s) => html`<button type="button" role="radio" aria-checked=${String(this.r.state === s.id)} data-state=${s.id} title=${this.stripTip(s.id)} @click=${() => this.go({ state: s.id })}>${s.label}<small>${s.count}</small></button>`)}
        </div>` : nothing;
    const panel = this.filterOpen ? filterPanel(this.panelBody(layout, this.phone ? strip : nothing), chips.length, this.resetFilters, () => (this.filterOpen = false)) : nothing;
    return html`${actions}<header class="dh" data-board-header>
      ${floor.length && !handlersPane ? html`<div class="dh-row">
        <div class="rooms" role="group" aria-label=${bt('floors')} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${() => this.go({ place: '' })}>${bt('allFloors')}</button>
          ${floor.map((n) => html`<button type="button" class="rc" aria-pressed=${String(this.r.place === n.key)} data-place=${n.key} @click=${() => this.go({ place: n.key })}>${bidi(placeLabel(n))}<small>${n.count}</small></button>`)}
        </div>
      </div>` : nothing}
      ${tools && !handlersPane ? html`<div class="dh-det tb" role="group" aria-label=${lt('lfGroup')} data-toolbar>
        ${this.phone ? nothing : strip}
        <label class="search">${tIcon('search')}<span class="vh">${tt('searchShort')}</span><input type="search" data-search maxlength="80" placeholder=${this.phone ? tt('searchShort') : tt('search')} .value=${this.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
        <span class="fanchor">
          ${filterToggle(this.filterOpen, chips.length, () => (this.filterOpen = !this.filterOpen), layout.treeInFilter ? 'board' : '')}
          ${this.phone ? nothing : panel}
        </span>
        ${activeChips(chips, this.resetFilters)}
        ${layout.toggle && this.treeHidden ? html`<button type="button" class="btn sm treeshow" aria-pressed="false" data-tree-toggle @click=${() => void this.setTreeHidden(false)}>${tIcon('tree')}${bt('treeShow')}</button>` : nothing}
        ${this.pagedBoard() ? this.pagerRow() : nothing}
        ${this.phone ? panel : nothing}
      </div>` : nothing}
    </header>`;
  }

  private stateBox(icon: Parameters<typeof tIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-tickets-state=${kind}><span class="ring">${tIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private card(t: BoardItem): TemplateResult {
    const fullScreen = this.detailMode() !== 'drawer';
    return html`<ticket-card .item=${t} .board=${true} .role=${roleFor(t, this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id, true)} .fullScreen=${fullScreen} ?data-picked=${this.r.ticketId === t.id} @card-action=${this.onCardAction}></ticket-card>`;
  }

  private grid(items: readonly BoardItem[], attr: string): TemplateResult {
    return html`<div class="cgrid" data-cards=${attr}>${repeat(items, (t) => t.id, (t) => this.card(t))}</div>`;
  }

  private section(id: string, title: string, sub: string, count: number, body: TemplateResult): TemplateResult {
    return html`<section class="fsec" data-section=${id}>
      <div class="sh"><h2>${title}</h2><span class="cnt" data-section-count>${count}</span><small>${sub}</small></div>
      ${body}
    </section>`;
  }

  /** TKUI4: a handler's group - the avatar, the name, how many are in hand and the oldest, and the load meter (full load turns red). */
  private handling(items: readonly BoardItem[], grouped = false): TemplateResult {
    const d = this.data as BoardResponse;
    const groups = d.handling.filter((h) => items.some((i) => h.ids.includes(i.id)));
    if (groups.length <= 1 && !grouped) return this.grid(items, 'handling');
    return html`${groups.map((h) => {
      const mine = items.filter((i) => h.ids.includes(i.id));
      const meter = loadMeter(mine.length);
      const av = avatarPair(mine[0])[0];
      return html`<div class="assignee-block" data-assignee=${h.key}>
        <div class="hgroup sub">${av && h.name ? html`<span class=${`av ${av.kind}`} aria-hidden="true">${av.ini}</span>` : nothing}<b>${h.name ? bidi(h.name) : bt('noAssigneeGroup')}</b><span>${lt('bdHandlingBy', { n: h.count, age: ageOf(h.oldest_at, this.now) })}</span>
          <span class="load" role="img" aria-label=${lt('bdLoadLabel', { n: mine.length })} data-load=${meter.on}>${Array.from({ length: meter.total }, (_, i) => html`<i class=${i < meter.on ? (meter.hot && i === meter.total - 1 ? 'hot' : 'on') : ''}></i>`)}</span></div>
        ${this.grid(mine, 'handling')}
      </div>`;
    })}`;
  }

  /** TKUI4 ("today" row, the manager board ONLY): visits and the next response target of today, and what waits for the manager. */
  private today(d: BoardResponse): TemplateResult | typeof nothing {
    const rows = todayEntries(d.items, d.counts, this.now);
    if (!rows.length) return nothing;
    return html`<div class="today glass" role="list" aria-label=${lt('bdTodayGroup')} data-board-today><b>${lt('bdToday')}</b>
      ${rows.map((e) => e.id
        ? html`<button type="button" class=${`up ${e.tone}`} role="listitem" data-today=${e.kind} @click=${() => writeHref(this.hrefOf(e.id), false)}><i></i><time>${e.time}</time><span>${bidi(e.label)}</span>${e.what ? html`<span class="what">${bidi(e.what)}</span>` : nothing}</button>`
        : html`<span class=${`up ${e.tone}`} role="listitem" data-today=${e.kind}><i></i><span>${e.label}</span></span>`)}
    </div>`;
  }

  /** The recently closed ones are quiet rows (number, title, who, when); a row opens the request like a card. */
  private closedRows(items: readonly BoardItem[]): TemplateResult {
    return html`<div class="closedrows glass" data-cards="closed">${items.map((t) => html`<a class="cr" href=${this.hrefOf(t.id)} data-closed-row=${t.id} aria-label=${lt('bdOpenRow', { n: t.number })}>
      <span class="num">#${t.number}</span><b>${t.title}</b><span class="hide-p">${t.assignee?.name ? bidi(t.assignee.name) : ''}</span><span>${relTime(t.closed_at ?? t.last_activity_at, this.now)}</span></a>`)}</div>`;
  }

  private cards(): TemplateResult {
    const d = this.data as BoardResponse;
    const ui = this.ui();
    const items = applyCardFilters(d.items, this.filters);
    const closed = applyCardFilters(d.closed, this.filters);
    if (!d.items.length) {
      const filtered = !!(this.r.q.trim() || this.r.dept || this.r.place || this.r.state !== 'all');
      if (filtered) return this.stateBox('search', this.r.state !== 'all' && !this.r.q.trim() ? bt('emptyState') : tt('emptyFiltered'), 'no-match', html`<button type="button" class="btn sm" data-clear-filters @click=${() => writeHref(boardHref({}), false)}>${tt('clearFilters')}</button>`);
      return this.stateBox('ticket', bt('emptyBoard'), 'empty');
    }
    if (!items.length && !closed.length) return this.stateBox('search', lt('lfNoMatch'), 'no-match-filters', html`<button type="button" class="btn sm" data-clear-card-filters @click=${() => (this.filters = { ...NO_CARD_FILTERS })}>${tIcon('x')}${lt('lfClear')}</button>`);
    if (this.pagedBoard() && this.fit) return this.pagedCards(items, closed);
    if (!groupingOn(ui.grouping, this.r.state)) return this.grid(items, 'flat');
    const s = sections(items);
    return html`<div class="groups">
      ${s.waiting.length ? this.section('waiting', bt('grpWaiting'), bt('grpWaitingSub'), s.waiting.length, this.grid(s.waiting, 'waiting')) : nothing}
      ${s.stuck.length ? this.section('stuck', bt('grpStuck'), bt('grpStuckSub'), s.stuck.length, this.grid(s.stuck, 'stuck')) : nothing}
      ${s.handling.length ? this.section('handling', bt('grpHandling'), bt('grpHandlingSub'), s.handling.length, this.handling(s.handling)) : nothing}
      ${this.r.state === 'all' && ui.closed_strip !== 'hidden' && closed.length ? html`<section class="fsec" data-section="closed">
        <div class="sh"><h2>${bt('grpClosed')}</h2><span class="cnt">${closed.length}</span>
          <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${() => (this.showClosed = !this.showClosed)}>${this.showClosed ? bt('hideClosed') : bt('showClosed')}</button></div>
        ${this.showClosed ? this.closedRows(closed) : nothing}
      </section>` : nothing}
    </div>`;
  }

  /** NOSCROLL-1366-2437: the groups of the board as the pages see them (the same groups, order and handler blocks as the unpaged board). */
  private packSections(items: readonly BoardItem[], closed: readonly BoardItem[]): PackSection<BoardItem>[] {
    const d = this.data as BoardResponse;
    const ui = this.ui();
    const f = this.fit!;
    const g = (key: string, list: readonly BoardItem[], sub = false): PackGroup<BoardItem> => ({ key, sub, items: list, cols: f.cols, rowH: f.rowH, gap: f.gap, heightOf: (t) => this.cardH.get(t.id) });
    if (!groupingOn(ui.grouping, this.r.state)) return [{ id: 'flat', head: false, groups: [g('flat', items)] }];
    const s = sections(items);
    const out: PackSection<BoardItem>[] = [];
    if (s.waiting.length) out.push({ id: 'waiting', head: true, groups: [g('waiting', s.waiting)] });
    if (s.stuck.length) out.push({ id: 'stuck', head: true, groups: [g('stuck', s.stuck)] });
    if (s.handling.length) {
      const hs = d.handling.filter((h) => s.handling.some((i) => h.ids.includes(i.id)));
      out.push({ id: 'handling', head: true, groups: hs.length <= 1 ? [g('handling', s.handling)] : hs.map((h) => g(`h:${h.key}`, s.handling.filter((i) => h.ids.includes(i.id)), true)) });
    }
    if (this.r.state === 'all' && ui.closed_strip !== 'hidden' && closed.length) {
      out.push({ id: 'closed', head: true, groups: this.showClosed ? [{ key: 'closed', sub: false, items: closed, cols: 1, rowH: f.crH, gap: 0, pad: f.crPad }] : [] });
    }
    return out;
  }

  private pagedCards(items: readonly BoardItem[], closed: readonly BoardItem[]): TemplateResult {
    const f = this.fit!;
    const all = this.packSections(items, closed);
    const pages = packPages(all, { room: f.room, headH: f.headH, subH: f.subH, secGap: f.secGap, inGap: f.inGap, blkGap: f.blkGap });
    this.pageCount = Math.max(1, pages.length);
    const at = Math.min(Math.max(1, this.cardPage), this.pageCount);
    const page: PageSection<BoardItem>[] = pages[at - 1] ?? [];
    const s = sections(items);
    const count = (id: string) => (id === 'waiting' ? s.waiting.length : id === 'stuck' ? s.stuck.length : id === 'handling' ? s.handling.length : closed.length);
    const flatOnly = page.length === 1 && page[0].id === 'flat';
    if (flatOnly) return this.grid(page[0].groups[0]?.items ?? [], 'flat');
    return html`<div class="groups">${page.map((p) => {
      const list = p.groups.flatMap((x) => x.items);
      if (p.id === 'closed') {
        return html`<section class="fsec" data-section="closed">
          <div class="sh"><h2>${bt('grpClosed')}</h2><span class="cnt">${closed.length}</span>
            <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${() => (this.showClosed = !this.showClosed)}>${this.showClosed ? bt('hideClosed') : bt('showClosed')}</button></div>
          ${this.showClosed && list.length ? this.closedRows(list) : nothing}
        </section>`;
      }
      const grouped = all.find((x) => x.id === p.id)?.groups.some((x) => x.sub) ?? false;
      const body = p.id === 'handling' ? this.handling(list, grouped) : this.grid(list, p.id);
      const title = p.id === 'waiting' ? bt('grpWaiting') : p.id === 'stuck' ? bt('grpStuck') : bt('grpHandling');
      const sub = p.id === 'waiting' ? bt('grpWaitingSub') : p.id === 'stuck' ? bt('grpStuckSub') : bt('grpHandlingSub');
      return this.section(p.id, title, sub, count(p.id), body);
    })}</div>`;
  }

  /** NOSCROLL-1366-2437: the board's pages on the toolbar row (nothing when one page holds the board). */
  private pagerRow(): TemplateResult | typeof nothing {
    if (this.pageCount <= 1) return nothing;
    const at = Math.min(Math.max(1, this.cardPage), this.pageCount);
    return html`<sw-pager class="bpager" data-board-pager .page=${at} .pages=${this.pageCount} @page-change=${(e: CustomEvent<{ page: number }>) => (this.cardPage = e.detail.page)}></sw-pager>`;
  }

  private body(): TemplateResult {
    switch (this.screen) {
      case 'loading': {
        // UXFIX-A11Y-295: skeleton cards in the board card's own anatomy (the warning line instead of the chips), not shorter bars
        const card = html`<ticket-card skeleton .board=${true}></ticket-card>`;
        return html`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
      }
      case 'off':
        return this.stateBox('ticket', tt('moduleOff'), 'off');
      case 'forbidden':
        return this.stateBox('lock', bt('notManager'), 'forbidden');
      case 'error':
        return this.stateBox('warning', tt('loadFailed'), 'error', html`${this.failed ? html`<span class="vh" data-error-detail>${this.failed}</span>` : nothing}<button type="button" class="btn sm" data-retry @click=${() => { this.screen = 'loading'; this.data = null; void this.boot(); }}>${tIcon('refresh')}${tt('retry')}</button>`);
      default:
        break;
    }
    if (this.r.pane === 'handlers') return html`<tickets-handlers embedded data-board-handlers></tickets-handlers>`;
    const d = this.data as BoardResponse;
    const ui = this.ui();
    const layout = floorsLayout(ui.board_floors, this.treeHidden, this.phone);
    const banner = d.counts.stuck > 0 && this.r.state !== 'stuck'
      ? html`<div class="banner warn" role="status" data-stuck-banner>${tIcon('warning')}<div><b>${bt('banner', { n: d.counts.stuck })}</b></div><button type="button" class="btn sm" data-stuck-go @click=${() => this.go({ state: 'stuck' })}>${bt('bannerGo')}</button></div>`
      : nothing;
    return html`
      ${this.today(d)}
      <div class=${`layout${layout.tree ? ' with-tree' : ''}`}>
        ${layout.tree ? html`<aside class="side" aria-label=${lt('tbTree')}>
          ${layout.toggle ? html`<div class="sidehead"><b>${bt('floors')}</b><button type="button" class="btn sm" aria-pressed="true" data-tree-toggle @click=${() => void this.setTreeHidden(true)}>${tIcon('tree')}${bt('treeHide')}</button></div>` : nothing}
          ${this.tree(d)}
        </aside>` : nothing}
        <div class="groups" data-board-main>
          ${banner}
          ${this.pagedBoard() ? html`<div class="pgbox" data-board-pages data-page=${Math.min(Math.max(1, this.cardPage), this.pageCount)} data-pages=${this.pageCount}>${this.cards()}</div>` : this.cards()}
          ${d.truncated ? html`<div class="note" data-truncated>${bt('truncated')}</div>` : nothing}
        </div>
      </div>`;
  }

  render() {
    const ui = this.module?.ui;
    const drawerOpen = !!this.r.ticketId && this.screen === 'ready';
    this.pageCount = 1;
    const body = this.body(); // first: it counts the pages the toolbar's pager shows
    return html`<sw-page class="page" wide data-screen="tickets-board" heading=${tt('area')} data-tickets-title=${tt('area')}>
      ${this.header()}
      <div class=${`scr${this.pagedBoard() ? ' paged' : ''}`} data-board-scroll>${body}</div>
    </sw-page>
    ${this.drawerUsed && this.module?.enabled ? html`<ticket-detail mode="drawer" .open=${drawerOpen} .ticketId=${this.r.ticketId} .detailMode=${ui?.detail ?? 'drawer_fullscreen'} .scope=${'department'} .focusTimeline=${this.route?.params.get('view') === 'timeline'} .initialTab=${this.route?.params.get('tab') ?? ''}
      .defaultTab=${ui?.detail_tab ?? ''} .sizeSetting=${ui?.drawer_size ?? ''} .sheetSetting=${ui?.phone_sheet ?? ''} .cameraViewfinder=${ui?.camera_viewfinder === true} .assignContact=${parseAssignParam(this.route?.params.get('assign'))}
      @assign-consumed=${() => writeHref(boardHref(this.r, { t: this.r.ticketId }), true)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${() => void this.load(true)} @ticket-gone=${this.onGone}></ticket-detail>` : nothing}
    ${this.module?.enabled && this.meta?.can.create ? html`<ticket-create .open=${this.r.creating && this.screen === 'ready'} .meta=${this.meta} .mode=${ui?.new_ticket ?? 'sheet'} .scope=${'department'} .detailMode=${ui?.detail ?? 'drawer_fullscreen'}
      @close=${() => writeHref(boardHref(this.r), false)} @created=${(e: CustomEvent<{ ticket: TicketDetail | null; id: string; number: number; result: 'created' | 'absorbed'; failedPhotos: number; assignContact?: string }>) => {
        const x = e.detail;
        this.say(x.failedPhotos ? tt('photosFailed', { n: x.failedPhotos }) : tt(x.result === 'absorbed' ? 'absorbed' : 'created', { n: x.number }), x.failedPhotos ? 'bad' : 'ok');
        const href = this.detailMode() === 'fullscreen' ? ticketHref(x.id) : boardHref(this.r, { t: x.id });
        writeHref(x.assignContact && x.result === 'created' ? withAssign(href, x.assignContact) : href, true); // TKUI1: the vendor flow, step two
        void this.load(false);
      }}></ticket-create>` : nothing}
    ${this.toast ? html`<div class=${`banner flt ${this.toast.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-tickets-toast>${tIcon(this.toast.tone === 'bad' ? 'warning' : 'check')}<div>${this.toast.text}</div></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-board': TicketsBoard;
  }
}
