import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../tickets/ticket-card';
import { parseAssignParam, withAssign } from '../tickets/create-assign-model'; // TKUI1: the new-request sheet's vendor flow
import '../tickets/ticket-detail';
import '../tickets/ticket-create';
import '../tickets/calendar-view'; // TKCAL: the weekly calendar mode
import '../tickets/inbound-queue'; // slice 5b: the unmatched WhatsApp replies (a chip only while the queue is not empty)
import '../tickets/intake-queue'; // CR-INTAKE99: free-text requests waiting for approval (a chip only while the caller may handle them and one waits)
import './tickets-table'; // CR-038 S6b (D24): the board's table view
import '../tickets/my-numbers'; // MGRDASH: a handler's own numbers at the top of "שלי" (owner decision, question 4 b)
import type { TicketsTable } from './tickets-table';
import { boardPrefs, saveBoardPrefs, type BoardView } from '../api/tickets-table';
import { listViewSwitch, type ListMode } from '../tickets/list-view-switch';
import { calendarWanted, setCalendarWanted } from '../tickets/calendar-mode';
import { BOARD_HREF } from '../tickets/board-model';
import { boardApi } from '../api/tickets-board';
import { foldCounts, NO_COUNTS, countText, type ListCounts } from '../tickets/list-counts';
import { applyCardFilters, activeCardFilters, NO_CARD_FILTERS, type CardFilters } from '../tickets/list-filters';
import { filterButton, filterRow } from '../tickets/list-filter-row';
import { roleFor, type CardItem } from '../tickets/list-card-model';
import { lt } from '../tickets/list-text';
import { ticketListFrameStyles } from '../tickets/list-styles';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { can, canNav, isApi } from '../api/session';
import { ticketsScopesAllowed } from '../shell/nav';
import { replaceRoute, type RouteState } from '../router';
import { ticketsApi, type ListPage, type Meta, type ModuleState, type TicketDetail, type TicketItem } from '../api/tickets';
import { NO_FILTERS, SCOPES, STATUS_FILTERS, filterLabel, listHref, parseTicketsRoute, rememberScope, scopeLabel, ticketHref, type ListFilters, type TicketsRoute } from '../tickets/model';
import { tt } from '../tickets/text';
import { dlt } from '../tickets/delete-text';
import { LiveRefresh } from '../tickets/live-refresh';
import { tIcon } from '../tickets/icons';
import { onTicketNames, setTicketNames } from '../tickets/naming';
import type { TicketCardAction } from '../tickets/ticket-card';

type Screen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off';

/** `#/tickets/mine?status=open` -> the path and the params the router writes (no history entry for a filter keystroke). */
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
 * CR-038 slice 1, the tickets area (`#/tickets/<mine|department|all>`; mock-up v2's board page frame, the automations list anatomy): the large
 * title (the module's configured name, D33), the departments as chips, the state filter (פתוחות · ללא מטפל · בטיפול · הסתיימו · סגורות ·
 * הכול), the text filter (number / title / device), "+ חדשה" for a holder of tickets.create, and the cards. A card opens the ticket in the
 * drawer (`?t=<id>`) or on the full screen (`#/tickets/<id>`) by the installation's D18 setting; "+" opens the create sheet or dialog
 * (`?new=1`, D22). The list is the server's: its single visibility rule decides every row (the scope tabs only narrow it). States: loading,
 * empty per scope, no match, error, forbidden, the module switched off. Later slices add the board (D19-D21), the table and kanban (D24).
 */
@customElement('tickets-list')
export class TicketsList extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private r: TicketsRoute = parseTicketsRoute(['tickets', 'mine'], new URLSearchParams());
  @state() private module: ModuleState | null = null;
  @state() private meta: Meta | null = null;
  @state() private items: TicketItem[] | null = null;
  @state() private next: string | null = null;
  @state() private screen: Screen = 'loading';
  @state() private failed = '';
  @state() private loadingMore = false;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private drawerUsed = false;
  @state() private toast: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private now = new Date();
  @state() private q = '';
  @state() private view: BoardView = 'cards'; // CR-038 S6b (D24): cards | table, the user's tickets.board.view
  /** TKCAL: the weekly calendar mode (per tab; the cards / table preference above is the server's) */
  @state() private cal = calendarWanted();
  /** TKUI4: the page frame's counts (scope, state, department) and the filter row over the held cards */
  @state() private counts: ListCounts = NO_COUNTS;
  @state() private filterOpen = false;
  @state() private filters: CardFilters = { ...NO_CARD_FILTERS };
  @state() private compactHeader = false;
  private countSeq = 0;
  /** the text last typed into the search box, until the address carries it */
  private pendingQ: string | null = null;
  private listKey = '';
  private seq = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  /** NOSCROLL-297: on a desktop the view switch sits on the title row (one control row less above the cards) */
  private wideMq = window.matchMedia('(min-width: 1024px)');
  @state() private wide = this.wideMq.matches;
  private onWide = () => (this.wide = this.wideMq.matches);
  private qTimer = 0;
  private toastTimer = 0;
  private extraPages = 0;
  /** 2.5.4: cards (and the table, which polls itself) refetch every 20 s while visible, on focus and after every mutation */
  private live = new LiveRefresh(() => this.refreshQuiet());

  private refreshQuiet(): void {
    if (this.screen !== 'ready' || (this.view !== 'cards' && !this.cal) || this.extraPages > 0 || this.loadingMore) return;
    void this.loadPage(false);
  }
  private clock = 0;
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, ticketListFrameStyles, css`
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .search {
      min-inline-size: 260px;
    }
    .more {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): below the header (title, departments, scope, state,
       search, view) the numbers and the cards scroll in their own region - the page itself never scrolls and the controls stay in
       place. On a tablet and a phone the region is transparent (display: contents) and the page scrolls as before. */
    .scr {
      display: contents;
    }
    @media (min-width: 1024px) {
      :host {
        overflow: hidden;
      }
      .page {
        block-size: 100%;
        min-block-size: 0;
        box-sizing: border-box;
        padding-block-end: 0;
      }
      .scr {
        display: flex;
        flex-direction: column;
        gap: inherit;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        margin-inline: -36px;
        padding: 2px 36px 28px;
      }
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
    /* FIX2180-295: on a tablet the header keeps clear of the floating corner and its logos (--sw-float-reserve = the pill + the
       measured logo width), so with the drawer open the state filter's six buttons no longer fit one row (768-820 px): it becomes
       the phone's two rows of three, a whole row of its own, instead of spilling out of its track */
    @media (min-width: 768px) and (max-width: 1023px) {
      .dh-det .stf {
        order: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        inline-size: 100%;
        box-sizing: border-box;
        border-radius: var(--sw-r-xl);
      }
      .dh-det .stf button {
        padding-inline: 6px;
      }
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det {
        gap: 10px;
      }
      /* the state filter is two rows of three on a phone (nothing hidden behind a scroll) */
      .dh-det .stf {
        order: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        inline-size: 100%;
        box-sizing: border-box;
        border-radius: var(--sw-r-xl);
      }
      .dh-det .stf button {
        padding-inline: 6px;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 2;
        flex: 1 1 0;
        min-inline-size: 0;
      }
      .dh-det .newbtn {
        order: 2;
      }
      .dh-det .vsw {
        order: 2;
      }
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.wideMq.addEventListener('change', this.onWide);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    this.offNames = onTicketNames(() => this.requestUpdate());
    this.clock = window.setInterval(() => (this.now = new Date()), 60_000);
    this.live.start();
    void this.boot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.wideMq.removeEventListener('change', this.onWide);
    this.removeEventListener('scroll', this.onScroll);
    this.offNames?.();
    window.clearInterval(this.clock);
    this.live.stop();
    window.clearTimeout(this.qTimer);
    window.clearTimeout(this.toastTimer);
  }

  /** TKUI4: the large title compacts while the page scrolls (the schedules page's rule: a layer over the title row, never a change of height) */
  private onScroll = () => {
    // NOSCROLL-297: on a desktop the list scrolls inside its own region (.scr), on a phone / tablet the page itself
    const compact = Math.max(this.scrollTop, this.renderRoot.querySelector<HTMLElement>('.scr')?.scrollTop ?? 0) > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  protected updated(): void {
    measureHeaderBar(this.renderRoot, this.phone);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('route') && this.route) {
      this.r = parseTicketsRoute(this.route.segments, this.route.params);
      rememberScope(this.r.scope);
      if (this.r.ticketId) this.drawerUsed = true;
      // the search box keeps what is being typed when the address change is our own debounced write (a trailing space survives)
      if (this.pendingQ === null || this.r.filters.q !== this.pendingQ.trim()) {
        this.q = this.r.filters.q;
        this.pendingQ = null;
      }
      if (this.screen === 'ready' || this.screen === 'error') this.reloadIfNeeded();
    }
  }

  // ---------------------------------------------------------------- data

  private async boot(): Promise<void> {
    void boardPrefs().then((p) => (this.view = p.view === 'table' ? 'table' : 'cards')); // CR-038 S6b
    try {
      const m = await ticketsApi().module();
      this.module = m;
      setTicketNames(m.name);
      if (!m.enabled) {
        this.screen = 'off';
        return;
      }
      this.meta = await ticketsApi().meta();
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

  private key(): string {
    const f = this.r.filters;
    return `${this.r.scope}|${f.status}|${f.department}|${f.q.trim()}`;
  }

  private reloadIfNeeded(force = false): void {
    const k = this.key();
    if (!force && k === this.listKey) return;
    this.listKey = k;
    void this.loadPage(false);
  }

  private async loadPage(more: boolean): Promise<void> {
    const seq = ++this.seq;
    const f = this.r.filters;
    if (more) {
      this.loadingMore = true;
      this.extraPages++;
    } else {
      this.extraPages = 0;
      if (this.items === null) this.screen = 'loading';
    }
    try {
      const page: ListPage = await ticketsApi().list({ scope: this.r.scope, status: f.status, department_id: f.department || undefined, q: f.q, cursor: more ? this.next : null });
      if (seq !== this.seq) return;
      this.items = more ? [...(this.items ?? []), ...page.items.filter((x) => !(this.items ?? []).some((y) => y.id === x.id))] : page.items;
      this.next = page.next_cursor;
      this.screen = 'ready';
      if (!more) void this.loadCounts();
    } catch (e) {
      if (seq === this.seq) this.fail(e);
    } finally {
      if (seq === this.seq) this.loadingMore = false;
    }
  }

  /**
   * TKUI4: the numbers of the page frame - one read of `tickets/facets` per scope (under the current state, department and text), one over
   * every state of the current scope, and one for the department chips. A failed read leaves its numbers out; the list never waits for it.
   */
  /** SERVICEIA2-295: the scope segment is the ONLY place the scope is chosen now (the three level-1 tabs are gone), so it offers exactly the
   * scopes those tabs were offered for (TAB_PERMISSIONS: שלי tickets.view | tickets.create, המחלקה tickets.view, הכול tickets.all_departments),
   * and always the scope on screen (a direct link keeps showing where the user is). SERVICEIA3-295: minus the scopes the administrator hid in
   * the tabs editor (`ui.tabs` section `tickets.scopes`), in the order he set. */
  private scopes(): Array<(typeof SCOPES)[number]> {
    const allowed = ticketsScopesAllowed(isApi(), canNav);
    const shown = [...allowed];
    if (!shown.includes(this.r.scope)) shown.splice(SCOPES.indexOf(this.r.scope), 0, this.r.scope);
    return shown;
  }

  private async loadCounts(): Promise<void> {
    const seq = ++this.countSeq;
    const f = this.r.filters;
    const api = boardApi();
    const base = { q: f.q, department_id: f.department || undefined };
    const ok = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [mine, department, all, states, depts] = await Promise.all([
      ...SCOPES.map((scope) => (this.scopes().includes(scope) ? ok(api.facets({ ...base, scope, status: f.status })) : Promise.resolve(null))),
      ok(api.facets({ ...base, scope: this.r.scope, status: 'all' })),
      f.department ? ok(api.facets({ q: f.q, scope: this.r.scope, status: f.status })) : Promise.resolve(null),
    ]);
    if (seq !== this.countSeq) return;
    const cur = { mine, department, all }[this.r.scope];
    this.counts = foldCounts({ scopes: { mine, department, all }, states, departments: f.department ? depts : cur });
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.toast = { text, tone };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), tone === 'bad' ? 7000 : 3500);
  }

  // ---------------------------------------------------------------- navigation

  private setFilters(patch: Partial<ListFilters>, replace = false): void {
    const f = { ...this.r.filters, ...patch };
    writeHref(listHref(this.r.scope, f, { t: this.r.ticketId || undefined }), replace);
  }

  private onSearch(v: string): void {
    this.q = v;
    this.pendingQ = v;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => this.setFilters({ q: v }, true), 300);
  }

  private detailMode() {
    return this.module?.ui.detail ?? 'drawer_fullscreen';
  }

  private hrefOf(id: string, timeline = false): string {
    if (this.detailMode() === 'fullscreen') return ticketHref(id);
    const href = listHref(this.r.scope, this.r.filters, { t: id });
    return timeline ? `${href}${href.includes('?') ? '&' : '?'}view=timeline` : href;
  }

  private onCardAction = (e: CustomEvent<{ item: TicketItem; action: TicketCardAction }>) => {
    const { item, action } = e.detail;
    if (action === 'open') writeHref(this.hrefOf(item.id), false);
    else if (action === 'full') writeHref(ticketHref(item.id), false);
    else if (action === 'copy') {
      const url = `${location.origin}${location.pathname}${location.search}${ticketHref(item.id)}`;
      void navigator.clipboard?.writeText(url).then(() => this.say(tt('linkCopied'))).catch(() => this.say(url));
    }
  };

  private closeDrawer = () => this.isConnected && writeHref(listHref(this.r.scope, this.r.filters), false);

  /** Returned by a non-member handler, or deleted (owner 14.10): the drawer closes, the cards and the table drop it and reload. */
  private onTicketGone = (e: CustomEvent<{ id: string; deleted?: boolean }>) => {
    this.closeDrawer();
    if (e.detail?.deleted) this.say(dlt('deletedOne'));
    if (e.detail?.deleted && this.items) this.items = this.items.filter((x) => x.id !== e.detail.id);
    (this.renderRoot.querySelector('tickets-table') as TicketsTable | null)?.dropTicket(e.detail?.id ?? '');
    this.listKey = '';
    this.reloadIfNeeded(true);
  };

  private onTicketChanged = (e: CustomEvent<{ ticket: TicketDetail }>) => {
    const t = e.detail.ticket;
    if (!this.items) return;
    const { description, events: _e, attachments: _a, close_note: _c, closed_by_name: _n, duplicate_of: _d, reopen_until: _u, can: _x, transitions: _t, assignments: _s, ...rest } = t;
    const item: TicketItem = { ...rest, excerpt: description.slice(0, 240) };
    this.items = this.items.map((x) => (x.id === t.id ? item : x));
    (this.renderRoot.querySelector('tickets-table') as TicketsTable | null)?.patchTicket(t); // CR-038 S6b
    this.refreshQuiet(); // 2.5.4: a change can move the ticket between filters or reorder the list
    (this.renderRoot.querySelector('tickets-table') as TicketsTable | null)?.refresh();
  };

  /** CR-038 S6b (D24): the cards or the table, remembered per user. */
  private setView(v: BoardView): void {
    this.view = v;
    void saveBoardPrefs({ view: v });
  }

  private onCreated = (e: CustomEvent<{ ticket: TicketDetail | null; id: string; number: number; result: 'created' | 'absorbed'; failedPhotos: number; assignContact?: string }>) => {
    const d = e.detail;
    this.say(d.failedPhotos ? tt('photosFailed', { n: d.failedPhotos }) : tt(d.result === 'absorbed' ? 'absorbed' : 'created', { n: d.number }), d.failedPhotos ? 'bad' : 'ok');
    this.listKey = '';
    const href = this.detailMode() === 'fullscreen' ? ticketHref(d.id) : listHref(this.r.scope, this.r.filters, { t: d.id });
    // TKUI1: a vendor picked in the new-request sheet - the drawer opens with the external-assign dialog prefilled (step two)
    if (d.ticket && d.assignContact && d.result === 'created') writeHref(withAssign(href, d.assignContact), true);
    else if (d.ticket || d.result === 'absorbed') writeHref(href, true);
    else writeHref(listHref(this.r.scope, this.r.filters), true);
    void this.loadPage(false);
  };

  // ---------------------------------------------------------------- render

  private pickMode = (m: ListMode): void => {
    if (m === 'board') window.location.hash = BOARD_HREF;
    else if (m === 'calendar') {
      this.cal = true;
      setCalendarWanted(true);
    } else {
      this.cal = false;
      setCalendarWanted(false);
      this.setView(m);
    }
  };

  private header(): TemplateResult {
    const f = this.r.filters;
    const depts = this.meta?.departments ?? [];
    const showDepts = depts.length > 1 && this.screen !== 'off' && this.screen !== 'forbidden';
    const tools = this.screen === 'ready' || this.screen === 'loading';
    const canCreate = !!this.meta?.can.create;
    const c = this.counts;
    // UXFIX-A11Y-295: until the counts arrive, an invisible two-digit badge holds the place of each count, so the scope and state
    // segments do not widen afterwards (on a desktop the widening wrapped the view switch to a second row: CLS 0.37)
    const countsPending = this.counts === NO_COUNTS;
    const withDept = (n: number | undefined) => (n === undefined ? (countsPending ? html`<small aria-hidden="true" style="visibility:hidden">00</small>` : nothing) : html`<small>${countText(n)}</small>`);
    const total = Object.values(c.departments).reduce((a, x) => a + x, 0);
    const cards = this.view !== 'table' || this.cal; // the card filters (priority, handler, flags) also narrow the calendar
    const active = activeCardFilters(this.filters);
    // UXFIX-A11Y-295 (UX audit finding 7): the department row and the "new" key arrive with the meta, after the skeleton is on screen -
    // the header grew by 50 px and pushed the whole skeleton grid down (most of the measured CLS). While the meta is on its way their
    // places are held by invisible twins of the usual case (several departments, may create); an installation with one department or
    // without the create right gives the place back once.
    const pending = !this.meta && this.screen === 'loading';
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-tickets-header>
      <div class="dh-row">
        <h1 data-tickets-title>${tt('area')}</h1>
        ${showDepts ? html`<div class="rooms" role="group" aria-label=${tt('departmentsGroup')}>
          <button type="button" class="rc" aria-pressed=${String(!f.department)} data-dept="" @click=${() => this.setFilters({ department: '' })}>${tt('allDepartments')}${Object.keys(c.departments).length ? withDept(total) : nothing}</button>
          ${depts.map((d) => html`<button type="button" class="rc" aria-pressed=${String(f.department === d.id)} data-dept=${d.id} @click=${() => this.setFilters({ department: d.id })}>${bidi(d.name)}${Object.keys(c.departments).length ? withDept(c.departments[d.id] ?? 0) : nothing}</button>`)}
        </div>` : pending ? html`<div class="rooms" aria-hidden="true" data-rooms-pending style="visibility:hidden"><span class="rc">${tt('allDepartments')}</span></div>` : html`<span class="grow"></span>`}
        ${tools && this.wide ? listViewSwitch(this.cal ? 'calendar' : cards ? 'cards' : 'table', !!this.meta?.can.manage, this.pickMode) : nothing}
      </div>
      ${tools ? html`<div class="dh-det">
        <div class="seg sm scope" role="radiogroup" aria-label=${lt('lsScopeGroup')} data-scope-seg>
          ${this.scopes().map((sc) => html`<button type="button" role="radio" aria-checked=${String(this.r.scope === sc)} data-scope=${sc} @click=${() => writeHref(listHref(sc, f), false)}>${scopeLabel(sc)}${withDept(c.scopes[sc])}</button>`)}
        </div>
        <div class="seg sm stf" role="radiogroup" aria-label=${tt('stateFilter')}>
          ${STATUS_FILTERS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.status === s)} data-status-filter=${s} @click=${() => this.setFilters({ status: s })}>${filterLabel(s)}${withDept(c.states[s])}</button>`)}
        </div>
        <span class="grow"></span>
        <tickets-intake-chip @ticket-changed=${() => this.reloadIfNeeded(true)}></tickets-intake-chip>
        ${this.meta?.can.manage ? html`<tickets-inbound-chip manager @ticket-changed=${() => this.reloadIfNeeded(true)}></tickets-inbound-chip>` : nothing}
        <label class="search">${tIcon('search')}<span class="vh">${tt('searchShort')}</span><input type="search" data-search maxlength="80" placeholder=${this.phone ? tt('searchShort') : lt('lsSearchLong')} .value=${this.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
        ${cards ? filterButton(this.filterOpen, active, () => (this.filterOpen = !this.filterOpen)) : nothing}
        ${pending ? html`<span class="btn primary newbtn" aria-hidden="true" style="visibility:hidden">${tIcon('plus')}${tt('newShort')}</span>` : nothing}
        ${canCreate ? html`<button type="button" class="btn primary newbtn" data-new @click=${() => writeHref(listHref(this.r.scope, this.r.filters, { create: true }), false)}>${tIcon('plus')}${tt('newShort')}</button>` : nothing}
        ${this.wide ? nothing : listViewSwitch(this.cal ? 'calendar' : cards ? 'cards' : 'table', !!this.meta?.can.manage, this.pickMode)}
      </div>
      ${cards && this.filterOpen && this.screen === 'ready' ? filterRow((this.items ?? []) as CardItem[], this.filters, (next) => (this.filters = next)) : nothing}` : nothing}
    </header>`;
  }

  private stateBox(icon: Parameters<typeof tIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-tickets-state=${kind}><span class="ring">${tIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private body(): TemplateResult {
    switch (this.screen) {
      case 'loading': {
        const card = html`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:var(--sw-r-2xl)"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;
        // UXFIX-A11Y-295: the cards view waits on skeleton CARDS (ticket-card skeleton: the card's own anatomy, so the same height - the
        // old bars were shorter and the grid jumped, CLS 0.32-0.49) in the count a first page fills on the screen
        const skel = html`<ticket-card skeleton></ticket-card>`;
        if (this.cal) return html`<div data-tickets-state="loading" aria-busy="true" data-cal-loading><div class="cgrid">${Array.from({ length: this.phone ? 2 : 7 }, () => card)}</div></div>`;
        return html`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => skel)}</div></div>`;
      }
      case 'off':
        return this.stateBox('ticket', tt('moduleOff'), 'off', can('system.configure') ? html`<a class="btn sm" href="#/system/tickets" data-open-settings>${tIcon('settings')}${tt('toSettings')}</a>` : undefined);
      case 'forbidden':
        return this.stateBox('lock', tt('forbidden'), 'forbidden');
      case 'error':
        return this.stateBox('warning', tt('loadFailed'), 'error', html`${this.failed ? html`<span class="vh" data-error-detail>${this.failed}</span>` : nothing}<button type="button" class="btn sm" data-retry @click=${() => { this.screen = 'loading'; this.items = null; void this.boot(); }}>${tIcon('refresh')}${tt('retry')}</button>`);
      default:
        break;
    }
    if (this.view === 'table' && !this.cal) {
      // CR-038 S6b (D24): the table view - its own server-side sort / filters / pages over the same scope, state, department and text
      const f = this.r.filters;
      return html`<tickets-table .scope=${this.r.scope} .base=${{ status: f.status, department: f.department, q: f.q }} .meta=${this.meta} .hrefOf=${(id: string) => this.hrefOf(id)}
        .picked=${this.r.ticketId} @table-filters=${(e: CustomEvent<Partial<ListFilters>>) => this.setFilters(e.detail as Partial<ListFilters>)}></tickets-table>`;
    }
    const rows = this.items ?? [];
    const f = this.r.filters;
    if (!rows.length) {
      const filtered = f.q.trim() !== '' || f.department !== '' || f.status !== 'open';
      if (filtered) return this.stateBox('search', tt('emptyFiltered'), 'no-match', html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.setFilters({ ...NO_FILTERS })}>${tt('clearFilters')}</button>`);
      if (this.r.scope === 'department' && this.meta && !this.meta.departments.some((d) => d.my_role)) return this.stateBox('users', tt('noDepartments'), 'no-departments');
      const title = this.r.scope === 'mine' ? tt('emptyMine') : this.r.scope === 'department' ? tt('emptyDepartment') : tt('emptyAll');
      return this.stateBox('ticket', title, 'empty', this.meta?.can.create ? html`<button type="button" class="btn primary" data-new-empty @click=${() => writeHref(listHref(this.r.scope, this.r.filters, { create: true }), false)}>${tIcon('plus')}${tt('newTitle')}</button>` : undefined);
    }
    const fullScreen = this.detailMode() !== 'drawer';
    const shown = applyCardFilters(rows as CardItem[], this.filters);
    if (!shown.length) return html`${this.stateBox('search', lt('lfNoMatch'), 'no-match-filters', html`<button type="button" class="btn sm" data-clear-card-filters @click=${() => (this.filters = { ...NO_CARD_FILTERS })}>${tIcon('x')}${lt('lfClear')}</button>`)}
      ${this.next ? html`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${() => void this.loadPage(true)}>${tt('loadMore')}</button></div>` : nothing}`;
    if (this.cal) {
      // TKCAL: the weekly calendar over the same held list and the same card filters; "load more" brings the next page of the list
      return html`<tickets-calendar .items=${shown} .now=${this.now} .hrefOf=${(id: string) => this.hrefOf(id)} .roleOf=${(t: TicketItem) => roleFor(t, this.meta)}
        .hasMore=${!!this.next} .loadingMore=${this.loadingMore} .openId=${this.r.ticketId} @cal-load-more=${() => void this.loadPage(true)}></tickets-calendar>`;
    }
    return html`<div class="cgrid" data-tickets-grid>${repeat(shown, (t) => t.id, (t) => html`<ticket-card .item=${t} .role=${roleFor(t, this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id, true)} .fullScreen=${fullScreen} ?data-picked=${this.r.ticketId === t.id} @card-action=${this.onCardAction}></ticket-card>`)}</div>
      ${this.next ? html`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${() => void this.loadPage(true)}>${tt('loadMore')}</button></div>` : nothing}`;
  }

  render() {
    const ui = this.module?.ui;
    const drawerOpen = !!this.r.ticketId && this.screen === 'ready';
    return html`<div class="page" data-screen="tickets-list" data-scope=${this.r.scope}>
      ${this.header()}
      <div class="scr" data-tickets-scroll @scroll=${this.onScroll}>
        ${this.r.scope === 'mine' && this.screen === 'ready' ? html`<tickets-my-numbers .module=${this.module} .manager=${!!this.meta?.can.manage} .source=${this.items}></tickets-my-numbers>` : nothing}
        ${this.body()}
      </div>
    </div>
    ${this.drawerUsed && this.module?.enabled ? html`<ticket-detail mode="drawer" .open=${drawerOpen} .ticketId=${this.r.ticketId} .detailMode=${ui?.detail ?? 'drawer_fullscreen'} .scope=${this.r.scope} .focusTimeline=${this.route?.params.get('view') === 'timeline'} .initialTab=${this.route?.params.get('tab') ?? ''}
      .defaultTab=${ui?.detail_tab ?? ''} .sizeSetting=${ui?.drawer_size ?? ''} .sheetSetting=${ui?.phone_sheet ?? ''} .cameraViewfinder=${ui?.camera_viewfinder === true} .assignContact=${parseAssignParam(this.route?.params.get('assign'))}
      @assign-consumed=${() => writeHref(listHref(this.r.scope, this.r.filters, { t: this.r.ticketId }), true)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${this.onTicketChanged} @ticket-gone=${this.onTicketGone}></ticket-detail>` : nothing}
    ${this.module?.enabled && this.meta?.can.create ? html`<ticket-create .open=${this.r.creating && this.screen === 'ready'} .meta=${this.meta} .mode=${ui?.new_ticket ?? 'sheet'} .scope=${this.r.scope} .detailMode=${ui?.detail ?? 'drawer_fullscreen'}
      @close=${() => writeHref(listHref(this.r.scope, this.r.filters), false)} @created=${this.onCreated}></ticket-create>` : nothing}
    ${this.toast ? html`<div class=${`banner flt ${this.toast.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-tickets-toast>${tIcon(this.toast.tone === 'bad' ? 'warning' : 'check')}<div>${this.toast.text}</div></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-list': TicketsList;
  }
}
