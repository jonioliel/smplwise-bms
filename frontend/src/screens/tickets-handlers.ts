import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { liftRef } from '../components/top-layer';
import '../components/sw-page'; // AUDIT30-C-TICKETS (#6): the one page frame
import { customElement, property, state } from 'lit/decorators.js';
import '../tickets/contacts-directory';
import '../tickets/handlers-members';
import '../tickets/portal-requests';
import '../tickets/needs-review';
import { needsReviewApi } from '../api/tickets-needs-review';
import type { TicketsContacts } from '../tickets/contacts-directory';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { t } from '../i18n/he';
import { replaceRoute } from '../router';
import { ticketsApi, type Meta } from '../api/tickets';
import { ticketsS4Api, type Readiness } from '../api/tickets-s4';
import { boardApi } from '../api/tickets-board';
import { ApiError } from '../api/client';
import { onTicketNames } from '../tickets/naming';
import { REVIEW_SEGMENTS, handlersSegments, missingItems, type HandlersSegment } from '../tickets/readiness-model';
import { handlersGlass } from '../tickets/handlers-glass';
import { asHandledDays, HANDLED_DEFAULT, HANDLED_PERIODS, loadsFromBoard, managedDepartments, readStoredPeriod, storePeriod, withHandled, type HandledDays, type MemberLoad } from '../tickets/handler-load';
import { rovingIndex } from '../tickets/settings-tabs';
import { tIcon } from '../tickets/icons';
import { tt } from '../tickets/text';
import { handlerDepartments } from '../tickets/dept-handlers-model';
import { activeChips, filterPanel, filterToggle, FilterPanelController, panelSection, ticketToolbarStyles, type ActiveChip } from '../tickets/list-toolbar';
import { ticketChipSelected } from '../tickets/chip-selected'; // AUDIT30-C-TICKETS: one selected chip look (#4)

/**
 * CR-038 owner request 2026-10-14: "מטפלים וספקים" (#/tickets/handlers[?seg=vendors|contacts]) - the fifth entry of the area's view
 * menu, the one place to manage who can handle a ticket. TKUI6 (2.6.0): restyled exactly per the approved mock-up v5 - the page frame of
 * the automations / multimedia / schedules pages (large title, segments with counts, department chips, search, "+"), handler cards with
 * the load counts (department managers only), vendor cards with the channel selector and the code chip, contact rows, and the readiness
 * strip ONLY when something is missing. Three segments:
 *   מטפלים     the department members with an account (tickets/handlers-members.ts: the member routes, unchanged rules) and the
 *              employees WITHOUT an account (the directory locked to the kind "employee": they get the handler link like a vendor);
 *   ספקים      the vendors (the directory locked to "vendor");
 *   אנשי קשר   the contacts (persons; one may work for a vendor).
 * The directory component and its API are slice 4's (tickets/contacts-directory.ts): create / edit / deactivate / erase / export need
 * tickets.configure; a department manager reads the rows of his departments with masked phones. The strip of what sending outside
 * still needs (GET tickets/readiness) lists each item with a link to its setting. Settings keeps a link card to this page and redirects
 * the old `?tab=contacts`.
 * CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): a department manager with the capability adds / removes handlers and vendors of HIS
 * departments here (the server's dept-handlers routes). `embedded`: the same page inside the manager board (#/tickets/board?pane=handlers) -
 * no page title, the department chips narrowed to the departments he manages, the segment kept in the element (the board owns the address).
 */
@customElement('tickets-handlers')
export class TicketsHandlersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** inside the manager board: no title, his departments only, the address is the board's */
  @property({ type: Boolean }) embedded = false;
  @state() private seg: HandlersSegment = 'handlers';
  @state() private readiness: Readiness | null = null;
  @state() private meta: Meta | null = null;
  @state() private dept = '';
  @state() private q = '';
  @state() private counts: Partial<Record<HandlersSegment, number>> = {};
  @state() private loads: Map<string, MemberLoad> | null = null;
  /** HANDLERLOAD: the viewer's own period (remembered in the browser; null = follow the installation default), the default the server
   * answered, the handled counts of the period actually shown (null = not available) */
  @state() private period: HandledDays | null = readStoredPeriod();
  @state() private installDefault: HandledDays = HANDLED_DEFAULT;
  @state() private handled: { days: HandledDays; counts: Record<string, number> } | null = null;
  private handledSeq = 0;
  @state() private adding = false;
  @state() private ok = '';
  @state() private error = '';
  /** the department filter's panel (the list's "סינון" dialect) */
  @state() private filterOpen = false;
  readonly panelCtl = new FilterPanelController(this, () => this.filterOpen, (open) => (this.filterOpen = open));
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  private okTimer = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, handlersGlass, ticketToolbarStyles, css`
    .crumbs {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin-block-end: 2px;
    }
    .titles {
      min-inline-size: 0;
    }
    .rdy {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-inline-start: auto;
    }
    .rdy .btn {
      text-decoration: none;
    }
    .banner > div:not(.rdy) {
      min-inline-size: 0;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 22px;
      min-inline-size: 0;
    }
    .dh-det .seg small {
      margin-inline-start: 4px;
    }
    /* WP3 (POLISH-4): the toolbar is the list's (tickets/list-toolbar.ts); the period and the "new" key keep their places at its end, and
       the row wraps when the department filter, the period and the search do not share one line (a tablet) */
    .dh-det.tb {
      flex-wrap: wrap;
    }
    .dh-det.tb > .grow {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .newbtn {
      flex: none;
    }
    /* the receipt and the error: a toast in view (the TKSET dialect) instead of an inline line under the header, out of sight when the
       card that was changed is far below it; the error stays until it is dismissed or the next action starts */
    .toast .tx {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .toast .x {
      display: inline-grid;
      place-items: center;
      flex: none;
      inline-size: 32px;
      block-size: 32px;
      margin-inline: 4px -8px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: inherit;
      cursor: pointer;
      position: relative;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .toast .x::after {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .toast .x:active {
      transform: scale(var(--sw-press-scale));
    }
    .toast .x:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (hover: hover) and (pointer: fine) {
      .toast .x:hover {
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
    }
    .page.embedded {
      padding: 0;
      min-block-size: 0;
    }
    /* AUDIT30-C-TICKETS (#6): sw-page is the frame; the controls row under its header neither sticks nor compacts */
    sw-page.page .dh {
      position: static;
      padding-block-start: 0;
    }
    @media (max-width: 767px) {
      .dh-det {
        gap: 10px;
      }
      .dh-det.tb > .seg {
        grid-template-columns: repeat(var(--segs, 3), minmax(0, 1fr));
        grid-auto-flow: row;
        overflow: visible;
      }
      .dh-det .grow {
        display: none;
      }
      /* the search, the filter and the "new" key share one 44 px row; "new" keeps its name for assistive tech and shows the plus */
      .dh-det .newbtn {
        order: 1;
        min-inline-size: 44px;
        min-block-size: 44px;
        justify-content: center;
      }
      .dh-det .newbtn .lbl {
        display: none;
      }
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 14px);
      }
      .banner {
        flex-wrap: wrap;
      }
      .rdy {
        margin-inline-start: 0;
      }
    }
  `, ticketChipSelected];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    if (!this.embedded) this.readSeg();
    window.addEventListener('hashchange', this.onHash);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.offNames = onTicketNames(() => this.requestUpdate());
    void ticketsS4Api().readiness().then((r) => (this.readiness = r)).catch(() => undefined);
    void ticketsApi().meta().then((m) => { this.meta = m; void this.loadLoads(); void this.loadReviewCount(); }).catch(() => undefined);
    void this.loadCounts();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    this.phoneMq.removeEventListener('change', this.onPhone);
    window.clearTimeout(this.okTimer);
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues): void {
    // a department chip that left the list (or a viewer who sees fewer departments) never leaves the page filtered by nothing
    if (changed.has('meta' as never) && this.dept && !this.meta?.departments.some((d) => d.id === this.dept)) this.dept = '';
    // NEEDSREVIEW: a `?seg=review` address opened by someone who is not a directory editor lands on the first segment
    if (changed.has('meta' as never) && this.meta && this.seg === 'review' && !this.meta.can.configure) this.seg = 'handlers';
  }

  private onHash = () => {
    if (!this.embedded && window.location.hash.startsWith('#/tickets/handlers')) this.readSeg();
  };

  private readSeg(): void {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('seg') as HandlersSegment | null;
    this.seg = q && REVIEW_SEGMENTS.includes(q) ? q : 'handlers';
  }

  private setSeg(id: HandlersSegment): void {
    this.seg = id;
    this.adding = false;
    this.filterOpen = false;
    if (!this.embedded) replaceRoute('/tickets/handlers', this.seg === 'handlers' ? undefined : new URLSearchParams({ seg: this.seg }));
    this.ok = '';
    this.error = '';
  }

  /** The numbers of the segments' pills: members (with an account) + employees, vendors, persons. A failed read leaves the pill bare. */
  private async loadCounts(): Promise<void> {
    const n = async (kind: 'vendor' | 'person' | 'employee'): Promise<number | null> => {
      try {
        return (await ticketsS4Api().contacts({ kind })).contacts.length;
      } catch {
        return null;
      }
    };
    const [vendors, persons, employees] = await Promise.all([n('vendor'), n('person'), n('employee')]);
    let members: number | null = 0;
    try {
      const r = await ticketsApi().departments();
      const ids = new Set<string>();
      for (const d of r.departments.filter((x) => x.active)) for (const m of d.members) if (m.kind === 'user') ids.add(m.id);
      members = ids.size;
    } catch (e) {
      members = e instanceof ApiError && (e.status === 403 || e.status === 404) ? 0 : null;
    }
    const next: Partial<Record<HandlersSegment, number>> = {};
    if (members !== null || employees !== null) next.handlers = (members ?? 0) + (employees ?? 0);
    if (vendors !== null) next.vendors = vendors;
    if (persons !== null) next.contacts = persons;
    if (this.counts.review !== undefined) next.review = this.counts.review;
    this.counts = next;
  }

  /** NEEDSREVIEW: the segments this viewer sees ("דורש בחינה" for the directory's editors only). */
  private segments(): readonly HandlersSegment[] {
    return handlersSegments(!!this.meta?.can.configure);
  }

  /** NEEDSREVIEW: the number on the "דורש בחינה" pill (editors only; a failure leaves the pill bare). */
  private async loadReviewCount(): Promise<void> {
    if (!this.meta?.can.configure) return;
    try {
      const r = await needsReviewApi.report();
      this.counts = { ...this.counts, review: r.pending.length + r.idle.length };
    } catch {
      /* the pill stays bare */
    }
  }

  private onReviewCount = (e: CustomEvent<{ n: number }>) => {
    this.counts = { ...this.counts, review: e.detail.n };
  };

  /**
   * The load of the handlers - open / waiting for them / stuck - from the manager board (the same server rule decides which requests the
   * viewer sees). Owner decision (TKUI6): ONLY a department manager sees it; everybody else reads the cards without numbers.
   */
  private async loadLoads(): Promise<void> {
    if (!managedDepartments(this.meta?.departments ?? []).length) {
      this.loads = null;
      void this.loadHandled();
      return;
    }
    void this.loadHandled();
    try {
      this.loads = loadsFromBoard((await boardApi().board({})).items);
    } catch {
      this.loads = null; // the board is the manager's: any failure leaves the cards without numbers (never an error line on this page)
    }
  }

  /** HANDLERLOAD: the "handled" counts of the chosen period - a count per handler, from the board's gate (department managers only). A
   * failure leaves the fourth number out; it never shows an error on this page. */
  private async loadHandled(): Promise<void> {
    const seq = ++this.handledSeq;
    if (!this.managed().length) {
      this.handled = null;
      return;
    }
    try {
      const r = await boardApi().handlerLoad(this.period ?? undefined);
      if (seq !== this.handledSeq) return;
      this.installDefault = asHandledDays(r.default_days) ?? HANDLED_DEFAULT;
      const days = asHandledDays(r.days);
      this.handled = days ? { days, counts: r.handled } : null;
    } catch {
      if (seq === this.handledSeq) this.handled = null;
    }
  }

  private onPeriod = (e: Event) => {
    const d = asHandledDays((e.target as HTMLSelectElement).value);
    if (!d) return;
    this.period = d;
    storePeriod(d);
    void this.loadHandled();
  };

  private deptChips(depts: readonly { id: string; name: string }[]): ActiveChip[] {
    const d = depts.find((x) => x.id === this.dept);
    return d ? [{ key: 'department', label: bidi(d.name), remove: () => (this.dept = '') }] : [];
  }

  /** The department filter's panel (the list's panel dialect): the chips with their `data-handlers-dept` hooks inside it. */
  private deptPanel(depts: readonly { id: string; name: string }[]) {
    const chips = html`<div class="fchips" role="group" aria-label=${tt('departmentsGroup')} data-handlers-depts>
      <button type="button" class="rc" aria-pressed=${String(!this.dept)} data-handlers-dept="" @click=${() => (this.dept = '')}>${tt('allDepartments')}</button>
      ${depts.map((d) => html`<button type="button" class="rc" aria-pressed=${String(this.dept === d.id)} data-handlers-dept=${d.id} @click=${() => (this.dept = d.id)}>${bidi(d.name)}</button>`)}
    </div>`;
    return filterPanel(panelSection(tt('departmentsGroup'), chips), this.dept ? 1 : 0, () => (this.dept = ''), () => (this.filterOpen = false));
  }

  private onNotice = (e: CustomEvent<{ ok?: string; error?: string }>) => {
    window.clearTimeout(this.okTimer);
    if (e.detail.error) {
      this.ok = '';
      this.error = e.detail.error;
    } else if (e.detail.ok) {
      this.error = '';
      this.ok = e.detail.ok;
      this.okTimer = window.setTimeout(() => (this.ok = ''), 3000);
      void this.loadCounts();
      void this.loadLoads();
    }
  };

  private onAddDone = () => {
    this.adding = false;
  };

  private addLabel(): string {
    return this.seg === 'vendors' ? tt('u6AddVendor') : this.seg === 'contacts' ? tt('u6AddContact') : tt('u6AddHandler');
  }

  private onAdd(): void {
    if (this.seg === 'handlers') {
      this.adding = !this.adding;
      return;
    }
    (this.renderRoot.querySelector(`tickets-contacts[kind="${this.seg === 'vendors' ? 'vendor' : 'person'}"]`) as TicketsContacts | null)?.startNew();
  }

  private managed(): string[] {
    return managedDepartments(this.meta?.departments ?? []);
  }

  /** The segments are a radio group: the arrow keys move between them (the visual order follows the text direction). */
  private onSegKey = (e: KeyboardEvent) => {
    const segs = this.segments();
    const i = segs.indexOf(this.seg);
    const n = rovingIndex(e.key, i, segs.length, getComputedStyle(this).direction === 'rtl');
    if (n === null) return;
    e.preventDefault();
    this.setSeg(segs[n]);
    void this.updateComplete.then(() => (this.renderRoot.querySelector(`[data-handlers-tabs] [data-seg="${this.seg}"]`) as HTMLElement | null)?.focus());
  };

  /** What sending outside still needs - shown only when something is missing (clean operator screens). */
  private strip(): TemplateResult | typeof nothing {
    const items = missingItems(this.readiness);
    if (!items.length) return nothing;
    return html`<div class="banner warn" role="status" data-readiness>
      ${tIcon('warning')}
      <div><b>${tt('u6NotReady')}</b><small>${tt('rdyStrip')}: ${items.map((i) => tt(i.text)).join(' · ')}</small></div>
      <div class="rdy">${items.map((i) => html`<a class="btn sm" href=${i.href} data-readiness-item=${i.key}>${tt(i.text)}</a>`)}</div>
    </div>`;
  }

  /** The loads with the handled count merged in, and the label of its period (null = no fourth number). */
  private shownLoads(): { loads: Map<string, MemberLoad> | null; label: string | null } {
    if (!this.handled) return { loads: this.loads, label: null };
    return { loads: withHandled(this.loads, this.handled.counts), label: tt(`u6HandledP${this.handled.days}` as 'u6HandledP7') };
  }

  /** HANDLERLOAD: the period selector of the "handled" number - for department managers, on the people segment only. */
  private periodPicker(): TemplateResult | typeof nothing {
    if (this.seg !== 'handlers' || !this.loads) return nothing;
    const cur = this.period ?? this.installDefault;
    return html`<label class="hperiod" data-handled-period-wrap><span class="vh">${tt('u6HandledPeriodLabel')}</span>
      <select class="in" data-handled-period aria-label=${tt('u6HandledPeriodLabel')} @change=${this.onPeriod}>
        ${HANDLED_PERIODS.map((d) => html`<option value=${String(d)} ?selected=${cur === d}>${tt('u6Handled')} · ${tt(`u6HandledP${d}` as 'u6HandledP7')}</option>`)}
      </select></label>`;
  }

  private body(): TemplateResult {
    const { loads, label } = this.shownLoads();
    if (this.seg === 'vendors') {
      // VPORTALRFQ: the vendors' technician requests from the portal - directory editors and tickets.technician_requests holders
      // (their departments' vendors only, decided by the server); never a denied call for anyone else
      return html`${this.meta?.can.configure || this.meta?.can.technician_requests ? html`<tickets-portal-requests @notice=${this.onNotice}></tickets-portal-requests>` : nothing}
        <tickets-contacts kind="vendor" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`;
    }
    if (this.seg === 'review') {
      // never a denied call: the report mounts only once the server said this viewer edits the directory
      return this.meta?.can.configure ? html`<tickets-needs-review @notice=${this.onNotice} @review-count=${this.onReviewCount}></tickets-needs-review>` : html``;
    }
    if (this.seg === 'contacts') return html`<tickets-contacts kind="person" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`;
    return html`<div class="body" data-handlers-segment>
      <tickets-handlers-members .dept=${this.dept} .query=${this.q} .loads=${loads} .handledLabel=${label} .managed=${this.managed()}
        ?adding=${this.adding} @add-done=${this.onAddDone} @notice=${this.onNotice}></tickets-handlers-members>
      <tickets-contacts kind="employee" head newbtn .loads=${loads} .handledLabel=${label} .managed=${this.managed()} .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>
    </div>`;
  }

  render() {
    const all = this.meta?.departments ?? [];
    // embedded in the manager board: only the departments he manages (never another department's name)
    const depts = this.embedded ? all.filter((d) => d.can_manage) : all;
    const mine = handlerDepartments(all);
    const review = this.seg === 'review';
    const segs = this.segments();
    const canAdd = !review && (this.seg !== 'handlers' || (this.meta?.can.configure ?? true) || mine.length > 0);
    const canFilter = depts.length > 1 && !review;
    const chips = canFilter ? this.deptChips(depts) : [];
    const panel = canFilter && this.filterOpen ? this.deptPanel(depts) : nothing;
    // AUDIT30-C-TICKETS (#6): standalone, the page is sw-page (the title and its crumb in the frame's header, this header the controls
    // row under it); embedded in the manager board it stays a plain block without a title
    const inner = html`
      <header class="dh" data-tickets-header>
        <div class="dh-det tb" role="group" aria-label=${tt('hdTitle')} data-toolbar>
          <div class="seg sm" role="radiogroup" aria-label=${tt('hdTitle')} data-handlers-tabs style=${`--segs:${segs.length}`} @keydown=${this.onSegKey}>
            ${segs.map((id) => html`<button type="button" role="radio" aria-checked=${String(this.seg === id)} tabindex=${this.seg === id ? '0' : '-1'} data-seg=${id} @click=${() => this.setSeg(id)}>${tt(`hdSeg_${id}` as 'hdSeg_handlers')}${this.counts[id] === undefined ? nothing : html`<small>${this.counts[id]}</small>`}</button>`)}
          </div>
          ${canFilter ? html`<span class="fanchor">
            ${filterToggle(this.filterOpen, chips.length, () => (this.filterOpen = !this.filterOpen))}
            ${this.phone ? nothing : panel}
          </span>${activeChips(chips, () => (this.dept = ''))}` : nothing}
          <span class="grow"></span>
          ${this.periodPicker()}
          ${review ? nothing : html`<label class="search">${tIcon('search')}<span class="vh">${tt('u6SearchPh')}</span><input type="search" data-handlers-search maxlength="80" placeholder=${this.phone ? tt('searchShort') : tt('u6SearchPh')}
            .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>`}
          ${canAdd ? html`<button type="button" class="btn primary newbtn" data-handlers-new aria-label=${this.addLabel()} aria-expanded=${this.seg === 'handlers' ? String(this.adding) : nothing} @click=${() => this.onAdd()}>${tIcon('plus')}<span class="lbl">${this.addLabel()}</span></button>` : nothing}
          ${canFilter && this.phone ? panel : nothing}
        </div>
      </header>
      ${this.strip()}
      ${this.error ? html`<div class="toast bad" role="alert" data-handlers-error ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${tIcon('warning')}<span class="tx">${this.error}</span>
        <button type="button" class="x" aria-label=${t('actions.close')} data-handlers-error-close @click=${() => (this.error = '')}>${tIcon('x')}</button></div>`
        : this.ok ? html`<div class="toast" role="status" data-handlers-ok ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${tIcon('check')}<span class="tx">${this.ok}</span></div>` : nothing}
      ${this.body()}`;
    return this.embedded
      ? html`<div class="page embedded" data-tickets-handlers data-seg=${this.seg} data-embedded>${inner}</div>`
      : html`<sw-page wide class="page" data-tickets-handlers data-seg=${this.seg} heading=${tt('hdTitle')} crumbs=${tt('area')} data-handlers-title=${tt('hdTitle')}>${inner}</sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-handlers': TicketsHandlersPage;
  }
}
