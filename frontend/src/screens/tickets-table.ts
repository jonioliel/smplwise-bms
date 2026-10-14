import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../tickets/table-toolbar';
import '../tickets/table-bulk';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type Eligible, type Meta, type TicketDetail, type TicketStatus } from '../api/tickets';
import { boardPrefs, saveBoardPrefs, tableApi, type BulkAnswer, type ColumnKey, type SavedView, type TableRow } from '../api/tickets-table';
import { priorityTone, relTime, statusLabel, statusTone } from '../tickets/model';
import {
  activeExtraCount, ageText, applyView, ariaSort, bulkSummary, columnLabel, keepAfterBulk, layoutFromPrefs, nextIndex, NO_TABLE_FILTERS, pageState, queryParams,
  rangeSelect, slaText, sortMark, sortText, stuckText, tableFilters, toggleOne, togglePage, toggleSort, viewDoc, type BaseFilters, type ExtraFilters, type TableLayout,
} from '../tickets/table-model';
import { tbt } from '../tickets/table-text';
import { tbIcon } from '../tickets/table-icons';
import { tIcon } from '../tickets/icons';
import { onTicketNames } from '../tickets/naming';
import { ticketTableStyles } from '../tickets/table-styles';
import { ticketDetailStyles, ticketFormStyles } from '../tickets/styles';
import { ticketsLang } from '../tickets/text';
import { can, isApi } from '../api/session';
import { setCostColumns } from '../tickets/table-model';
import { costCell, costStatusTone } from '../tickets/cost-model';
import { ct, type CostTextKey } from '../tickets/cost-text';

type Screen = 'loading' | 'ready' | 'error';
type CellMenu = { id: string; kind: 'status' | 'assignee' } | null;
const POLL_MS = 30_000;

/**
 * CR-038 slice 6b (D24, section 13.6) `<tickets-table>`: the board's first-class TABLE view, hosted by the tickets area
 * (screens/tickets-list.ts renders it instead of the cards when the user's `tickets.board.view` is `table`).
 *
 * The rows are the server's (GET tickets/table: its sort, its filters, its keyset pages - every row passed the single visible()
 * rule); this element never filters for security. It adds: sortable headers (click; Shift+click adds a second key; aria-sort), a
 * sticky header, the column chooser, saved filters, the table's own filters, the density toggle and the CSV export (the toolbar),
 * multi-select with the bulk bar (Shift ranges, the page), inline status (the moves this caller may make) and handler changes
 * (slice 1's single-ticket routes, with the revision the row showed), the keyboard (↑ ↓ Home End move the row focus, Enter opens,
 * Space selects, Ctrl/Cmd+A selects the page, Esc clears, `/` goes to the search box), polling every 30 s while visible (selection
 * and scroll kept), and below 768 px a compact list (number, title, state, age; no selection). The columns, their order, the sort,
 * the density and the page size are the user's `tickets.board` preference; the default saved view is applied when the table opens.
 *
 * Properties: `scope`, `base` (state / department / text from the area's address), `meta`, `hrefOf` (the address that opens a ticket
 * per D18 - the host's), `picked` (the ticket open in the drawer). Events (bubble, composed): `table-filters` {status, department, q}
 * when a saved view changes the address filters.
 */
@customElement('tickets-table')
export class TicketsTable extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() scope: BaseFilters['scope'] = 'mine';
  @property({ attribute: false }) base: Omit<BaseFilters, 'scope'> = { status: 'open', department: '', q: '' };
  @property({ attribute: false }) meta: Meta | null = null;
  @property({ attribute: false }) hrefOf: (id: string) => string = (id) => `#/tickets/${id}`;
  @property() picked = '';
  @property({ reflect: true, attribute: 'data-density' }) density: 'comfortable' | 'compact' = 'comfortable';
  @state() private rows: TableRow[] | null = null;
  @state() private next: string | null = null;
  @state() private screen: Screen = 'loading';
  @state() private failed = '';
  @state() private loadingMore = false;
  @state() private layout: TableLayout = layoutFromPrefs(null);
  @state() private extra: ExtraFilters = { ...NO_TABLE_FILTERS };
  @state() private selected: Set<string> = new Set();
  @state() private focusIdx = -1;
  @state() private menu: CellMenu = null;
  @state() private eligible: Eligible[] | null = null;
  @state() private move: { id: string; to: TicketStatus } | null = null;
  @state() private moveNote = '';
  @state() private moveError = '';
  @state() private busy = false;
  @state() private toast: { head: string; rest?: string; tone: 'ok' | 'bad' } | null = null;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private now = new Date();
  @state() private exporting = false;
  @state() private defaultView = '';
  private anchor: string | null = null;
  private seq = 0;
  private pages = 0;
  private key = '';
  private booted = false;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private poll = 0;
  private toastTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, ticketTableStyles, css`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .statebox {
      padding-block: 40px;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.offNames = onTicketNames(() => this.requestUpdate());
    window.addEventListener('pointerdown', this.onOutside, true);
    this.poll = window.setInterval(() => this.tick(), POLL_MS);
    // CR-038 slice 9 (11A.9): the cost columns, sort and filter only for tickets.costs.view at the installation (the server's 403 rule)
    setCostColumns(!isApi() || can('tickets.costs.view'));
    void this.boot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.offNames?.();
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.clearInterval(this.poll);
    window.clearTimeout(this.toastTimer);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (this.booted && (changed.has('scope') || changed.has('base'))) this.reloadIfNeeded();
  }

  // ---------------------------------------------------------------- data

  private async boot(): Promise<void> {
    const prefs = await boardPrefs();
    this.layout = layoutFromPrefs(prefs);
    this.density = this.layout.density;
    if (prefs.default_view) {
      this.defaultView = prefs.default_view;
      try {
        const v = (await tableApi().views()).items.find((x) => x.id === prefs.default_view);
        if (v) {
          this.booted = true;
          this.applySaved(v);
          return;
        }
      } catch {
        /* the table opens with the layout alone */
      }
    }
    this.booted = true;
    this.reloadIfNeeded(true);
  }

  private filters() {
    return tableFilters({ scope: this.scope, ...this.base }, this.extra);
  }

  private reloadIfNeeded(force = false): void {
    const k = JSON.stringify([this.filters(), sortText(this.layout.sort), this.layout.limit]);
    if (!force && k === this.key) return;
    this.key = k;
    void this.load(false);
  }

  private async load(more: boolean, silent = false): Promise<void> {
    const seq = ++this.seq;
    if (more) this.loadingMore = true;
    else if (!silent) {
      this.screen = 'loading';
      this.rows = null;
      this.focusIdx = -1;
    }
    try {
      const page = await tableApi().page(queryParams(this.filters(), this.layout.sort, { limit: this.layout.limit, cursor: more ? this.next : null }));
      if (seq !== this.seq) return;
      const prev = more ? this.rows ?? [] : [];
      const seen = new Set(prev.map((r) => r.id));
      this.rows = [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      this.next = page.next_cursor;
      this.pages = more ? this.pages + 1 : 1;
      // the selection keeps what is still on the screen (a poll, a filter change)
      const ids = new Set(this.rows.map((r) => r.id));
      if ([...this.selected].some((id) => !ids.has(id))) this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
      this.screen = 'ready';
      // a short page with a cursor (the server's scan budget under the visibility check): keep loading until the page is full
      if (page.next_cursor && page.items.length < Math.min(10, this.layout.limit) && !silent) void this.load(true);
    } catch (e) {
      if (seq !== this.seq) return;
      if (!more && !silent) {
        this.failed = describeError(e);
        this.screen = 'error';
      } else if (!silent) this.say(describeError(e), undefined, 'bad');
    } finally {
      if (seq === this.seq) this.loadingMore = false;
    }
  }

  /** The 30 s refresh while the table is visible and nothing is open (one page loaded: it is re-read in place). */
  private tick(): void {
    this.now = new Date();
    if (document.visibilityState !== 'visible' || this.screen !== 'ready' || this.menu || this.move || this.pages > 1 || this.busy) return;
    if (this.renderRoot.querySelector('tickets-table-bulk')?.shadowRoot?.querySelector('sw-dialog[open]')) return;
    void this.load(false, true);
  }

  private say(head: string, rest?: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.toast = { head, rest, tone };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), tone === 'bad' ? 8000 : 4000);
  }

  /** A ticket changed elsewhere (the drawer): its row follows (the host calls this). */
  patchTicket(d: TicketDetail): void {
    if (!this.rows) return;
    this.rows = this.rows.map((r) => (r.id === d.id ? this.merged(r, d) : r));
  }

  private merged(r: TableRow, d: TicketDetail): TableRow {
    return {
      ...r, status: d.status, revision: d.revision, assignee: d.assignee, last_assignee_name: d.last_assignee_name, last_activity_at: d.last_activity_at,
      waiting_on: d.waiting_on, waiting_reason: d.waiting_reason, priority: d.priority, department: d.department, title: d.title, eta_at: d.eta_at, closed_at: d.closed_at,
      transitions: d.transitions, can: { ...r.can, manage: d.can.manage, assign: d.can.assign },
    };
  }

  // ---------------------------------------------------------------- layout, views, export

  private setLayout(layout: TableLayout, persist = true): void {
    const sortChanged = sortText(layout.sort) !== sortText(this.layout.sort) || layout.limit !== this.layout.limit;
    this.layout = layout;
    this.density = layout.density;
    if (persist) void saveBoardPrefs({ columns: layout.columns, sort: sortText(layout.sort), density: layout.density, limit: layout.limit });
    if (sortChanged) this.reloadIfNeeded();
  }

  private setExtra(extra: ExtraFilters): void {
    this.extra = extra;
    this.reloadIfNeeded();
  }

  private applySaved(v: SavedView): void {
    const next = applyView(v.view, this.layout);
    this.extra = next.extra;
    this.setLayout(next.layout);
    this.dispatchEvent(new CustomEvent('table-filters', { detail: next.base, bubbles: true, composed: true }));
    this.reloadIfNeeded(true);
  }

  private async exportCsv(): Promise<void> {
    this.exporting = true;
    try {
      const res = await tableApi().exportCsv(queryParams(this.filters(), this.layout.sort, { columns: this.layout.columns, lang: ticketsLang() }));
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.rel = 'noopener';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      this.say(tbt('exported', { n: res.rows ?? 0 }));
    } catch (e) {
      const code = e instanceof ApiError ? e.body.code : '';
      this.say(code === 'export_too_large' ? tbt('exportTooLarge') : code === 'export_rate' ? tbt('exportRate') : describeError(e), undefined, 'bad');
    } finally {
      this.exporting = false;
    }
  }

  // ---------------------------------------------------------------- selection, keyboard, opening

  private ids(): string[] {
    return (this.rows ?? []).map((r) => r.id);
  }

  private canSelect(): boolean {
    return !this.phone && !!this.meta?.can.manage;
  }

  private open(id: string): void {
    window.location.hash = this.hrefOf(id);
  }

  private onRowClick(e: MouseEvent, r: TableRow): void {
    const path = e.composedPath();
    if (path.some((n) => n instanceof HTMLElement && (n.matches('button, input, label, a, .pop') || n.classList.contains('ckb')))) return;
    this.open(r.id);
  }

  private onCheck(e: Event, id: string): void {
    const shift = (e as MouseEvent).shiftKey;
    this.selected = shift ? rangeSelect(this.ids(), this.selected, this.anchor, id) : toggleOne(this.selected, id);
    this.anchor = id;
  }

  private focusRow(i: number): void {
    this.focusIdx = i;
    void this.updateComplete.then(() => (this.renderRoot.querySelector(`tbody tr[data-row-index="${i}"]`) as HTMLElement | null)?.focus());
  }

  private onKey = (e: KeyboardEvent) => {
    const rows = this.rows ?? [];
    const inField = e.composedPath().some((n) => n instanceof HTMLElement && n.matches('input, textarea, select, .pop'));
    if (e.key === '/' && !inField) {
      const search = (this.getRootNode() as ShadowRoot | Document).querySelector?.('input[data-search]') as HTMLInputElement | null;
      if (search) {
        e.preventDefault();
        search.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (this.menu) {
        this.menu = null;
        e.stopPropagation();
      } else if (this.selected.size) {
        this.selected = new Set();
        e.stopPropagation();
      }
      return;
    }
    if (inField) return;
    if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey) && this.canSelect()) {
      e.preventDefault();
      this.selected = new Set(this.ids());
      return;
    }
    const rowEl = e.composedPath().find((n) => n instanceof HTMLElement && n.matches('tbody tr')) as HTMLElement | undefined;
    const onRow = !!rowEl && e.target === rowEl;
    const n = nextIndex(this.focusIdx, e.key, rows.length);
    if (n !== null && (onRow || e.composedPath().some((x) => x instanceof HTMLElement && x.matches('table')))) {
      e.preventDefault();
      this.focusRow(n);
      return;
    }
    if (!onRow || this.focusIdx < 0 || !rows[this.focusIdx]) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.open(rows[this.focusIdx].id);
    } else if (e.key === ' ' && this.canSelect()) {
      e.preventDefault();
      const id = rows[this.focusIdx].id;
      this.selected = e.shiftKey ? rangeSelect(this.ids(), this.selected, this.anchor, id) : toggleOne(this.selected, id);
      this.anchor = id;
    }
  };

  private onOutside = (e: PointerEvent) => {
    if (!this.menu) return;
    const pop = this.renderRoot.querySelector('td.cellmenu > .pop');
    const btn = this.renderRoot.querySelector(`[data-menu-for="${this.menu.kind}:${this.menu.id}"]`);
    const path = e.composedPath();
    if ((pop && path.includes(pop)) || (btn && path.includes(btn))) return;
    this.menu = null;
  };

  // ---------------------------------------------------------------- inline status and handler

  private async openMenu(r: TableRow, kind: 'status' | 'assignee'): Promise<void> {
    if (this.menu?.id === r.id && this.menu.kind === kind) {
      this.menu = null;
      return;
    }
    this.menu = { id: r.id, kind };
    void this.updateComplete.then(() => (this.renderRoot.querySelector('td.cellmenu > .pop button') as HTMLElement | null)?.focus());
    if (kind === 'assignee') {
      this.eligible = null;
      try {
        this.eligible = r.department ? (await ticketsApi().assignees(r.department.id, r.id)).users : [];
      } catch (e) {
        this.eligible = [];
        this.say(describeError(e), undefined, 'bad');
      }
    }
  }

  private async act(r: TableRow, fn: () => Promise<TicketDetail>): Promise<void> {
    this.busy = true;
    try {
      const d = await fn();
      this.patchTicket(d);
      this.say(tbt('changed'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body.code === 'ticket_stale') {
        try {
          this.patchTicket(await ticketsApi().get(r.id));
        } catch {
          /* the next poll reads it */
        }
        this.say(tbt('staleReloaded'), undefined, 'bad');
      } else this.say(describeError(e), undefined, 'bad');
    } finally {
      this.busy = false;
    }
  }

  private pickMove(r: TableRow, to: TicketStatus, noteRequired: boolean): void {
    this.menu = null;
    if (noteRequired) {
      this.move = { id: r.id, to };
      this.moveNote = '';
      this.moveError = '';
      return;
    }
    void this.act(r, () => ticketsApi().status(r.id, { to, revision: r.revision }));
  }

  private async submitMove(): Promise<void> {
    const m = this.move;
    const r = this.rows?.find((x) => x.id === m?.id);
    if (!m || !r) return;
    if (!this.moveNote.trim()) {
      this.moveError = tbt('required');
      return;
    }
    this.move = null;
    await this.act(r, () => ticketsApi().status(r.id, { to: m.to, note: this.moveNote.trim(), revision: r.revision }));
  }

  private pickAssignee(r: TableRow, u: Eligible): void {
    this.menu = null;
    if (r.assignee?.kind === 'user' && r.assignee.id === u.id) return;
    void this.act(r, () => ticketsApi().assign(r.id, { assignee: { kind: 'user', id: u.id }, revision: r.revision }));
  }

  private onBulkDone = (e: CustomEvent<{ answer: BulkAnswer }>) => {
    const a = e.detail.answer;
    const s = bulkSummary(a);
    this.say(s.head, s.rest || undefined, s.tone);
    this.selected = keepAfterBulk(a, this.ids());
    void this.load(false, true);
  };

  // ---------------------------------------------------------------- render: cells

  private statusChip(s: TicketStatus): TemplateResult {
    const tone = statusTone(s);
    return html`<span class=${`chip ${tone}`}><i class=${`dot ${tone === 'ok' ? 'ok' : tone === 'info' ? 'run' : ''}`}></i>${statusLabel(s)}</span>`;
  }

  private cell(r: TableRow, c: ColumnKey): TemplateResult {
    switch (c) {
      case 'number':
        return html`<td class="c-number">#${r.number}</td>`;
      case 'title':
        return html`<td class="c-title"><span class="cv" title=${r.title}>${r.title}</span>${r.category ? html`<span class="sub">${bidi(r.category.name)}</span>` : nothing}</td>`;
      case 'department':
        return html`<td><span class="cv">${r.department ? bidi(r.department.name) : ''}</span></td>`;
      case 'priority': {
        const tone = priorityTone(r.priority);
        return html`<td>${r.priority ? html`<span class=${`chip ${tone}`}><i class=${`dot ${tone === 'bad' ? 'bad' : tone === 'info' ? 'run' : ''}`}></i>${r.priority.name}</span>` : nothing}</td>`;
      }
      case 'status': {
        const open = this.menu?.id === r.id && this.menu.kind === 'status';
        if (!r.transitions.length) return html`<td>${this.statusChip(r.status)}</td>`;
        return html`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(open)} data-menu-for=${`status:${r.id}`}
            aria-label=${tbt('statusMenu', { status: statusLabel(r.status) })} ?disabled=${this.busy} @click=${() => void this.openMenu(r, 'status')}>${this.statusChip(r.status)}${tbIcon('chevron', 'chev')}</button>
          ${open ? html`<div class="pop" role="menu" aria-label=${tbt('statusMenu', { status: statusLabel(r.status) })}>
            ${r.transitions.map((m) => html`<button type="button" role="menuitem" data-move-to=${m.to} @click=${() => this.pickMove(r, m.to, m.note_required)}>${statusLabel(m.to)}</button>`)}
          </div>` : nothing}</td>`;
      }
      case 'assignee': {
        const name = r.assignee?.name || '';
        const who = html`<span class=${`who${name ? '' : ' none'}`}>${name ? bidi(name) : tbt('unassigned')}</span>`;
        if (!r.can.assign) return html`<td>${who}</td>`;
        const open = this.menu?.id === r.id && this.menu.kind === 'assignee';
        return html`<td class="cellmenu"><button type="button" class="cbtn" aria-haspopup="menu" aria-expanded=${String(open)} data-menu-for=${`assignee:${r.id}`}
            aria-label=${tbt('assigneeMenu', { name: name || tbt('unassigned') })} ?disabled=${this.busy} @click=${() => void this.openMenu(r, 'assignee')}>${who}${tbIcon('chevron', 'chev')}</button>
          ${open ? html`<div class="pop" role="menu" aria-label=${tbt('assigneeMenu', { name: name || tbt('unassigned') })}>
            ${this.eligible === null ? html`<span class="skl" style="block-size:44px"></span>` : this.eligible.length
              ? this.eligible.map((u) => html`<button type="button" role="menuitemradio" aria-checked=${String(r.assignee?.id === u.id)} data-assign-to=${u.id} @click=${() => this.pickAssignee(r, u)}>${tIcon('user')}${bidi(u.name)}</button>`)
              : html`<div class="note">${tbt('noAssignees')}</div>`}
          </div>` : nothing}</td>`;
      }
      case 'place':
        return html`<td><span class="cv">${r.place_text ? bidi(r.place_text) : ''}</span></td>`;
      case 'device':
        return html`<td><span class="cv">${r.device_name ? bidi(r.device_name) : ''}</span></td>`;
      case 'created':
        return html`<td class="c-created">${ageText(r, this.now)}</td>`;
      case 'activity':
        return html`<td class="c-activity">${relTime(r.last_activity_at, this.now)}</td>`;
      case 'stuck':
        return html`<td><span class=${`cv${r.stuck ? ' warn' : ''}`}>${stuckText(r.stuck, this.now)}</span></td>`;
      case 'sla': {
        const s = slaText(r.sla, this.now);
        return html`<td class="c-sla"><span class=${s.tone}>${s.text}</span></td>`;
      }
      case 'cost': {
        const k = costCell(r.cost, ticketsLang());
        return html`<td class="c-cost" data-cost=${r.cost ? (r.cost.approved ? 'approved' : 'submitted') : ''}><span class=${k.muted ? 'muted' : ''}>${k.text}</span></td>`;
      }
      case 'cost_status':
        return html`<td>${r.cost_status && r.cost_status !== 'not_required' ? html`<span class=${`chip ${costStatusTone(r.cost_status)}`} data-cost-status=${r.cost_status}>${ct(`cs_${r.cost_status}` as CostTextKey)}</span>` : nothing}</td>`;
    }
  }

  private header(): TemplateResult {
    const sort = this.layout.sort;
    const ids = this.ids();
    const ps = pageState(ids, this.selected);
    return html`<thead><tr>
      ${this.canSelect() ? html`<th class="ck" scope="col"><label class="ckb"><span class="vh">${tbt('selectPage')}</span><input type="checkbox" data-select-page .checked=${ps === 'all'} .indeterminate=${ps === 'some'}
        @change=${() => { this.selected = togglePage(ids, this.selected); }} /></label></th>` : nothing}
      ${this.layout.columns.map((c) => {
        const mark = sortMark(sort, c);
        return html`<th scope="col" aria-sort=${ariaSort(sort, c)} data-col=${c}>
          <button type="button" class=${`sh${mark && mark.order > 1 ? ' second' : ''}`} data-sort=${c} aria-label=${tbt('sortBy', { col: columnLabel(c) })}
            @click=${(e: MouseEvent) => this.setLayout({ ...this.layout, sort: toggleSort(sort, c, e.shiftKey) })}>${columnLabel(c)}${mark ? html`${tbIcon(mark.dir === 'asc' ? 'arrowUp' : 'arrowDown')}${sort.length > 1 ? html`<small>${mark.order}</small>` : nothing}` : nothing}</button>
        </th>`;
      })}
    </tr></thead>`;
  }

  private table(rows: TableRow[]): TemplateResult {
    const select = this.canSelect();
    return html`<div class="tw" data-table-wrap>
      <table class="tt" role="grid" aria-label=${tbt('tableLabel')} aria-rowcount=${rows.length + 1} aria-multiselectable=${String(select)} aria-describedby="kbhelp" data-tickets-table @keydown=${this.onKey}>
        ${this.header()}
        <tbody>${repeat(rows, (r) => r.id, (r, i) => {
          const sel = this.selected.has(r.id);
          return html`<tr data-row=${r.id} data-row-index=${i} data-status=${r.status} aria-rowindex=${i + 2} aria-selected=${select ? String(sel) : nothing} ?data-picked=${this.picked === r.id}
              tabindex=${this.focusIdx === i || (this.focusIdx < 0 && i === 0) ? '0' : '-1'} @focus=${() => (this.focusIdx = i)} @click=${(e: MouseEvent) => this.onRowClick(e, r)}>
            ${select ? html`<td class="ck"><label class="ckb"><span class="vh">${tbt('selectRow', { n: r.number })}</span><input type="checkbox" tabindex="-1" data-select=${r.id} .checked=${sel}
              @click=${(e: MouseEvent) => this.onCheck(e, r.id)} /></label></td>` : nothing}
            ${this.layout.columns.map((c) => this.cell(r, c))}
          </tr>`;
        })}</tbody>
      </table>
      <span class="vh" id="kbhelp">${tbt('keyboardHelp')}</span>
      ${this.next ? html`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${() => void this.load(true)}>${tbt('loadMore')}</button></div>` : nothing}
    </div>`;
  }

  private compact(rows: TableRow[]): TemplateResult {
    return html`<nav class="cl" aria-label=${tbt('compactList')} data-compact-list>
      ${repeat(rows, (r) => r.id, (r) => html`<a class="ci" href=${this.hrefOf(r.id)} data-row=${r.id} data-status=${r.status}>
        <span class="ci-t">${r.title}</span>
        <span class="ci-s">${this.statusChip(r.status)}</span>
        <span class="ci-m">#${r.number}${r.assignee?.name ? html` · ${bidi(r.assignee.name)}` : nothing}</span>
        <span class="ci-a">${ageText(r, this.now)}</span>
      </a>`)}
    </nav>
    ${this.next ? html`<div class="more"><button type="button" class="btn" data-load-more ?disabled=${this.loadingMore} @click=${() => void this.load(true)}>${tbt('loadMore')}</button></div>` : nothing}`;
  }

  private skeleton(): TemplateResult {
    const cols = this.layout.columns;
    return html`<div class="tw" aria-busy="true" data-table-state="loading"><table class="tt"><thead><tr>${cols.map((c) => html`<th scope="col">${columnLabel(c)}</th>`)}</tr></thead>
      <tbody>${Array.from({ length: this.phone ? 4 : 8 }, () => html`<tr class="sk">${cols.map(() => html`<td><span class="skl"></span></td>`)}</tr>`)}</tbody></table></div>`;
  }

  private body(): TemplateResult {
    if (this.screen === 'loading') return this.skeleton();
    if (this.screen === 'error') {
      return html`<div class="statebox glass" role="status" data-table-state="error"><span class="ring">${tIcon('warning')}</span><b>${tbt('loadFailed')}</b>
        <span class="vh" data-error-detail>${this.failed}</span><button type="button" class="btn sm" data-retry @click=${() => this.reloadIfNeeded(true)}>${tIcon('refresh')}${tbt('retry')}</button></div>`;
    }
    const rows = this.rows ?? [];
    if (!rows.length) {
      const filtered = activeExtraCount(this.extra) > 0;
      return html`<div class="statebox glass" role="status" data-table-state=${filtered ? 'no-match' : 'empty'}><span class="ring">${tIcon(filtered ? 'search' : 'ticket')}</span><b>${filtered ? tbt('emptyFiltered') : tbt('empty')}</b>
        ${filtered ? html`<button type="button" class="btn sm" data-clear-extra @click=${() => this.setExtra({ ...NO_TABLE_FILTERS })}>${tbt('fClear')}</button>` : nothing}</div>`;
    }
    return this.phone ? this.compact(rows) : this.table(rows);
  }

  render() {
    const rows = this.rows ?? [];
    const picked = rows.filter((r) => this.selected.has(r.id));
    const showBulk = this.canSelect() && picked.length > 0;
    return html`<div data-screen="tickets-table" data-view="table">
      ${showBulk
        ? html`<tickets-table-bulk .rows=${picked} .meta=${this.meta} @bulk-done=${this.onBulkDone} @bulk-clear=${() => (this.selected = new Set())}></tickets-table-bulk>`
        : html`<tickets-table-toolbar .layout=${this.layout} .extra=${this.extra} .meta=${this.meta} .current=${viewDoc({ scope: this.scope, ...this.base }, this.extra, this.layout)}
            .count=${this.screen === 'ready' ? rows.length : null} ?more=${!!this.next} ?phone=${this.phone} ?canExport=${!!this.meta?.can.manage} ?exporting=${this.exporting} .defaultView=${this.defaultView}
            @layout-change=${(e: CustomEvent<{ layout: TableLayout }>) => this.setLayout(e.detail.layout)} @extra-change=${(e: CustomEvent<{ extra: ExtraFilters }>) => this.setExtra(e.detail.extra)}
            @view-apply=${(e: CustomEvent<{ view: SavedView }>) => this.applySaved(e.detail.view)} @default-view=${(e: CustomEvent<{ id: string | null }>) => (this.defaultView = e.detail.id ?? '')}
            @export-csv=${() => void this.exportCsv()}></tickets-table-toolbar>`}
      ${this.toast ? html`<div class=${`banner toast ${this.toast.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-table-toast>${tIcon(this.toast.tone === 'bad' ? 'warning' : 'check')}<div><b>${this.toast.head}</b>${this.toast.rest ? html`<small>${this.toast.rest}</small>` : nothing}</div></div>` : nothing}
      ${this.body()}
    </div>
    ${this.move ? html`<sw-dialog open heading=${tbt('moveTitle', { status: statusLabel(this.move.to) })} data-dialog="table-move" @close=${() => (this.move = null)}>
      <div class="form"><label class="fld"><span>${tbt('moveReason')} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-move-note .value=${this.moveNote} @input=${(e: Event) => { this.moveNote = (e.target as HTMLTextAreaElement).value; this.moveError = ''; }}></textarea></label>
        ${this.moveError ? html`<div class="err" role="alert">${this.moveError}</div>` : nothing}</div>
      <div slot="footer" class="sheetfoot"><button type="button" class=${`btn ${this.move.to === 'cancelled' ? 'danger' : 'primary'}`} data-move-ok @click=${() => void this.submitMove()}>${tbt('confirm')}</button>
        <button type="button" class="btn" @click=${() => (this.move = null)}>${tbt('cancel')}</button></div>
    </sw-dialog>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-table': TicketsTable;
  }
}
