import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../tickets/ticket-card';
import { parseAssignParam, withAssign } from '../tickets/create-assign-model'; // TKUI1: the new-request sheet's vendor flow
import '../tickets/ticket-detail';
import '../tickets/ticket-create';
import '../tickets/board-tree';
import './tickets-handlers'; // CR-DEPT-MANAGER-HANDLERS: the board's "מטפלים וספקים" pane
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
import { applyCardFilters, activeCardFilters, NO_CARD_FILTERS, type CardFilters } from '../tickets/list-filters';
import { filterButton, filterRow } from '../tickets/list-filter-row';
import { roleFor, avatarPair } from '../tickets/list-card-model';
import { loadMeter, todayEntries } from '../tickets/board-today';
import { lt } from '../tickets/list-text';
import { oldestOpenText } from '../tickets/elapsed-model';
import { ticketBoardV5Styles, ticketListFrameStyles } from '../tickets/list-styles';

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
  /** TKUI4: the filter row over the held cards, and the title that compacts while the page scrolls */
  @state() private filterRowOpen = false;
  @state() private filters: CardFilters = { ...NO_CARD_FILTERS };
  @state() private compactHeader = false;
  private pendingQ: string | null = null;
  private key = '';
  private seq = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private qTimer = 0;
  private live = new LiveRefresh(() => { this.now = new Date(); if (this.screen === 'ready') void this.load(true); }); // 2.5.4: shared poller
  private toastTimer = 0;
  private offNames: (() => void) | null = null;
  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, ticketListFrameStyles, ticketBoardV5Styles, css`
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
      inset-block-start: 12px;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .search {
      min-inline-size: 240px;
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
    .tools {
      display: inline-flex;
      align-items: center;
      gap: 8px;
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
    .fpanel {
      max-inline-size: 360px;
    }
    /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): below the header the board (the today row, the tree,
       the groups of cards) scrolls in its own region - the page itself never scrolls and the controls stay in place; the tree stays
       beside the cards (sticky inside the region). On a tablet and a phone the region is transparent and the page scrolls as before. */
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
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      /* the manager's "board / handlers" switch takes a whole row of its own: auto-placed, it fell into the float-reserve column (0 px
         wide) and its buttons spilled out of the track; it folds away with the floor chips while the header is compact */
      .dh-row > [data-board-pane] {
        grid-column: 1 / -1;
        justify-self: start;
      }
      .dh-row > .grow {
        display: none;
      }
      .dh.compact .dh-row > [data-board-pane] {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      .dh-det {
        gap: 10px;
      }
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
      /* the departments are two columns on a phone (nothing hidden behind a scroll, as the state filter) */
      .dh-det .depts {
        order: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        inline-size: 100%;
        box-sizing: border-box;
        border-radius: var(--sw-r-xl);
      }
      .dh-det .depts button {
        min-inline-size: 0;
        padding-inline: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    this.offNames = onTicketNames(() => this.requestUpdate());
    this.live.start();
    void this.boot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    this.offNames?.();
    this.live.stop();
    window.clearTimeout(this.qTimer);
    window.clearTimeout(this.toastTimer);
  }

  private onScroll = () => {
    // NOSCROLL-297: on a desktop the board scrolls inside its own region (.scr), on a phone / tablet the page itself
    const compact = Math.max(this.scrollTop, this.renderRoot.querySelector<HTMLElement>('.scr')?.scrollTop ?? 0) > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  protected updated(): void {
    measureHeaderBar(this.renderRoot, this.phone);
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
    }
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

  private header(): TemplateResult {
    const d = this.data;
    const ui = this.ui();
    const layout = floorsLayout(ui.board_floors, this.treeHidden, this.phone);
    const tools = this.screen === 'ready' || this.screen === 'loading';
    const depts = d?.departments ?? [];
    const canCreate = !!this.meta?.can.create;
    const chips = d && layout.chips ? floorChips(d.tree) : [];
    const handlersPane = this.r.pane === 'handlers';
    const deptSeg = depts.length > 1 ? html`<div class="seg sm depts" role="radiogroup" aria-label=${tt('departmentsGroup')} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.r.dept)} data-dept="" @click=${() => this.go({ dept: '' })}>${tt('allDepartments')}<small>${depts.reduce((s, x) => s + x.count, 0)}</small></button>
          ${depts.map((x) => html`<button type="button" role="radio" aria-checked=${String(this.r.dept === x.id)} data-dept=${x.id} @click=${() => this.go({ dept: x.id })}>${bidi(x.name)}<small>${x.count}</small></button>`)}
        </div>` : nothing;
    // GATEFIX2240-297: the departments and the view switch stay on the second row at every width. On the title row (NOSCROLL-297) they
    // clipped the board's header at 1024 px and left no room for the shell's dropdown chips in placement 3; the cards still scroll in
    // their own region (.scr) on a desktop, so the page does not scroll.
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-board-header>
      <div class="dh-row">
        <h1 data-tickets-title>${tt('area')}</h1>
        ${this.meta?.can.manage ? html`<div class="seg sm" role="radiogroup" aria-label=${tt('dmPaneGroup')} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!handlersPane)} data-pane="cards" @click=${() => this.go({ pane: 'cards' })}>${tt('area')}</button>
          <button type="button" role="radio" aria-checked=${String(handlersPane)} data-pane="handlers" @click=${() => this.go({ pane: 'handlers' })}>${tt('hdTitle')}</button>
        </div>` : nothing}
        ${chips.length ? html`<div class="rooms" role="group" aria-label=${bt('floors')} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${() => this.go({ place: '' })}>${bt('allFloors')}</button>
          ${chips.map((n) => html`<button type="button" class="rc" aria-pressed=${String(this.r.place === n.key)} data-place=${n.key} @click=${() => this.go({ place: n.key })}>${bidi(placeLabel(n))}<small>${n.count}</small></button>`)}
        </div>` : html`<span class="grow"></span>`}
        ${layout.toggle && tools ? html`<button type="button" class="btn sm" aria-pressed=${String(!this.treeHidden)} data-tree-toggle @click=${() => void this.setTreeHidden(!this.treeHidden)}>${tIcon('tree')}${this.treeHidden ? bt('treeShow') : bt('treeHide')}</button>` : nothing}
      </div>
      ${tools && !handlersPane ? html`<div class="dh-det">
        ${deptSeg}
        ${d ? html`<div class="seg sm stf" role="radiogroup" aria-label=${bt('stateStrip')} data-state-strip>
          ${stripItems(ui.closed_strip, d.counts).map((s) => html`<button type="button" role="radio" aria-checked=${String(this.r.state === s.id)} data-state=${s.id} title=${this.stripTip(s.id)} @click=${() => this.go({ state: s.id })}>${s.label}<small>${s.count}</small></button>`)}
        </div>` : nothing}
        ${this.r.assignee ? html`<button type="button" class="rc" aria-pressed="true" data-assignee-filter=${this.r.assignee} aria-label=${ot('clearHandler', { name: this.assigneeName() })} @click=${() => this.go({ assignee: undefined })}>${tIcon('x')}${bidi(this.assigneeName())}</button>` : nothing}
        <span class="grow"></span>
        ${layout.treeInFilter ? html`<button type="button" class="btn" aria-expanded=${String(this.filterOpen)} data-filter-btn @click=${() => (this.filterOpen = !this.filterOpen)}>${tIcon('filter')}${bt('filter')}</button>` : nothing}
        <label class="search">${tIcon('search')}<span class="vh">${tt('searchShort')}</span><input type="search" data-search maxlength="80" placeholder=${this.phone ? tt('searchShort') : tt('search')} .value=${this.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></label>
        ${filterButton(this.filterRowOpen, activeCardFilters(this.filters), () => (this.filterRowOpen = !this.filterRowOpen))}
        ${canCreate ? html`<button type="button" class="btn primary newbtn" data-new @click=${() => writeHref(boardHref(this.r, { create: true }), false)}>${tIcon('plus')}${tt('newShort')}</button>` : nothing}
        ${listViewSwitch('board', true, this.pickMode)}
      </div>
      ${this.filterRowOpen && d ? filterRow([...d.items, ...d.closed], this.filters, (next) => (this.filters = next)) : nothing}` : nothing}
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
  private handling(items: readonly BoardItem[]): TemplateResult {
    const d = this.data as BoardResponse;
    const groups = d.handling.filter((h) => items.some((i) => h.ids.includes(i.id)));
    if (groups.length <= 1) return this.grid(items, 'handling');
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
    const showTree = layout.tree || (layout.treeInFilter && this.filterOpen);
    const total = d.tree.reduce((s, n) => s + (n.parent ? 0 : n.count), 0);
    const banner = d.counts.stuck > 0 && this.r.state !== 'stuck'
      ? html`<div class="banner warn" role="status" data-stuck-banner>${tIcon('warning')}<div><b>${bt('banner', { n: d.counts.stuck })}</b></div><button type="button" class="btn sm" data-stuck-go @click=${() => this.go({ state: 'stuck' })}>${bt('bannerGo')}</button></div>`
      : nothing;
    const tree = html`<ticket-board-tree .nodes=${d.tree} .selected=${this.r.place} .total=${total} @place-pick=${(e: CustomEvent<{ key: string }>) => this.go({ place: e.detail.key })}></ticket-board-tree>`;
    return html`
      ${this.today(d)}
      ${layout.treeInFilter && this.filterOpen ? html`<div class="fpanel" data-filter-panel>${tree}</div>` : nothing}
      <div class=${`layout${layout.tree ? ' with-tree' : ''}`}>
        ${layout.tree && showTree ? html`<aside class="side">${tree}</aside>` : nothing}
        <div class="groups" data-board-main>
          ${banner}
          ${this.cards()}
          ${d.truncated ? html`<div class="note" data-truncated>${bt('truncated')}</div>` : nothing}
        </div>
      </div>`;
  }

  render() {
    const ui = this.module?.ui;
    const drawerOpen = !!this.r.ticketId && this.screen === 'ready';
    return html`<div class="page" data-screen="tickets-board">
      ${this.header()}
      <div class="scr" data-board-scroll @scroll=${this.onScroll}>${this.body()}</div>
    </div>
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
