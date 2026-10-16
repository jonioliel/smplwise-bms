import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../tickets/contacts-directory';
import '../tickets/handlers-members';
import type { TicketsContacts } from '../tickets/contacts-directory';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { replaceRoute } from '../router';
import { ticketsApi, type Meta } from '../api/tickets';
import { ticketsS4Api, type Readiness } from '../api/tickets-s4';
import { boardApi } from '../api/tickets-board';
import { ApiError } from '../api/client';
import { onTicketNames } from '../tickets/naming';
import { HANDLERS_SEGMENTS, missingItems, type HandlersSegment } from '../tickets/readiness-model';
import { handlersGlass } from '../tickets/handlers-glass';
import type { MemberLoad } from '../tickets/handlers-members';
import { tIcon } from '../tickets/icons';
import { tt } from '../tickets/text';

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
 */
@customElement('tickets-handlers')
export class TicketsHandlersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private seg: HandlersSegment = 'handlers';
  @state() private readiness: Readiness | null = null;
  @state() private meta: Meta | null = null;
  @state() private dept = '';
  @state() private q = '';
  @state() private counts: Partial<Record<HandlersSegment, number>> = {};
  @state() private loads: Map<string, MemberLoad> | null = null;
  @state() private adding = false;
  @state() private ok = '';
  @state() private error = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  private okTimer = 0;
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, handlersGlass, css`
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
    .dh-det .rooms {
      flex: 0 1 auto;
    }
    .dh-det .rc {
      block-size: 34px;
      padding-inline: 14px;
      font-size: var(--sw-fs-base);
    }
    .newbtn {
      flex: none;
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det {
        gap: 10px;
      }
      .dh-det .seg {
        inline-size: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        overflow: visible;
      }
      .dh-det .rooms {
        order: 2;
        inline-size: 100%;
        flex: 1 1 100%;
        margin-inline: -14px;
        padding-inline: 14px;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 0;
        min-inline-size: 0;
      }
      .dh-det .newbtn {
        order: 3;
      }
      .banner {
        flex-wrap: wrap;
      }
      .rdy {
        margin-inline-start: 0;
      }
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.readSeg();
    window.addEventListener('hashchange', this.onHash);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.offNames = onTicketNames(() => this.requestUpdate());
    void ticketsS4Api().readiness().then((r) => (this.readiness = r)).catch(() => undefined);
    void ticketsApi().meta().then((m) => { this.meta = m; void this.loadLoads(); }).catch(() => undefined);
    void this.loadCounts();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    this.phoneMq.removeEventListener('change', this.onPhone);
    window.clearTimeout(this.okTimer);
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    // a department chip that left the list (or a viewer who sees fewer departments) never leaves the page filtered by nothing
    if (changed.has('meta') && this.dept && !this.meta?.departments.some((d) => d.id === this.dept)) this.dept = '';
  }

  private onHash = () => {
    if (window.location.hash.startsWith('#/tickets/handlers')) this.readSeg();
  };

  private readSeg(): void {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('seg') as HandlersSegment | null;
    this.seg = q && HANDLERS_SEGMENTS.includes(q) ? q : 'handlers';
  }

  private setSeg(id: HandlersSegment): void {
    this.seg = id;
    this.adding = false;
    replaceRoute('/tickets/handlers', this.seg === 'handlers' ? undefined : new URLSearchParams({ seg: this.seg }));
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
    this.counts = next;
  }

  /**
   * The load of the handlers - open / waiting for them / stuck - from the manager board (the same server rule decides which requests the
   * viewer sees). Owner decision (TKUI6): ONLY a department manager sees it; everybody else reads the cards without numbers.
   */
  private async loadLoads(): Promise<void> {
    if (!(this.meta?.departments ?? []).some((d) => d.can_manage)) {
      this.loads = null;
      return;
    }
    try {
      const b = await boardApi().board({});
      const m = new Map<string, MemberLoad>();
      for (const it of b.items) {
        if (it.assignee_key === 'none') continue;
        const l = m.get(it.assignee_key) ?? { open: 0, waiting: 0, stuck: 0 };
        l.open += 1;
        if (it.waiting_on === 'assignee') l.waiting += 1;
        if (it.stuck) l.stuck += 1;
        m.set(it.assignee_key, l);
      }
      this.loads = m;
    } catch {
      this.loads = null; // the board is the manager's: any failure leaves the cards without numbers (never an error line on this page)
    }
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

  private body(): TemplateResult {
    if (this.seg === 'vendors') return html`<tickets-contacts kind="vendor" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`;
    if (this.seg === 'contacts') return html`<tickets-contacts kind="person" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`;
    return html`<div class="body" data-handlers-segment>
      <tickets-handlers-members .dept=${this.dept} .query=${this.q} .loads=${this.loads} .managed=${(this.meta?.departments ?? []).filter((d) => d.can_manage).map((d) => d.id)}
        ?adding=${this.adding} @add-done=${this.onAddDone} @notice=${this.onNotice}></tickets-handlers-members>
      <tickets-contacts kind="employee" head newbtn .loads=${this.loads} .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>
    </div>`;
  }

  render() {
    const depts = this.meta?.departments ?? [];
    const canAdd = this.seg !== 'handlers' || (this.meta?.can.configure ?? true);
    return html`<div class="page" data-tickets-handlers data-seg=${this.seg}>
      <header class="dh" data-tickets-header>
        <div class="dh-row">
          <div class="titles"><div class="crumbs">${tt('area')}</div><h1 data-handlers-title>${tt('hdTitle')}</h1></div>
          <span class="grow"></span>
        </div>
        <div class="dh-det">
          <div class="seg sm" role="radiogroup" aria-label=${tt('hdTitle')} data-handlers-tabs>
            ${HANDLERS_SEGMENTS.map((id) => html`<button type="button" role="radio" aria-checked=${String(this.seg === id)} data-seg=${id} @click=${() => this.setSeg(id)}>${tt(`hdSeg_${id}` as 'hdSeg_handlers')}${this.counts[id] === undefined ? nothing : html`<small>${this.counts[id]}</small>`}</button>`)}
          </div>
          ${depts.length > 1 ? html`<div class="rooms" role="group" aria-label=${tt('departmentsGroup')} data-handlers-depts>
            <button type="button" class="rc" aria-pressed=${String(!this.dept)} data-handlers-dept="" @click=${() => (this.dept = '')}>${tt('allDepartments')}</button>
            ${depts.map((d) => html`<button type="button" class="rc" aria-pressed=${String(this.dept === d.id)} data-handlers-dept=${d.id} @click=${() => (this.dept = d.id)}>${bidi(d.name)}</button>`)}
          </div>` : nothing}
          <span class="grow"></span>
          <label class="search">${tIcon('search')}<span class="vh">${tt('u6SearchPh')}</span><input type="search" data-handlers-search maxlength="80" placeholder=${this.phone ? tt('searchShort') : tt('u6SearchPh')}
            .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
          ${canAdd ? html`<button type="button" class="btn primary newbtn" data-handlers-new aria-expanded=${this.seg === 'handlers' ? String(this.adding) : nothing} @click=${() => this.onAdd()}>${tIcon('plus')}${this.addLabel()}</button>` : nothing}
        </div>
      </header>
      ${this.strip()}
      ${this.error ? html`<div class="msg err" role="alert" data-handlers-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-handlers-ok>${this.ok}</div>` : nothing}
      ${this.body()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-handlers': TicketsHandlersPage;
  }
}
