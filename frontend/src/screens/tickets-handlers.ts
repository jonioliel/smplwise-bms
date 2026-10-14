import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-tabs';
import '../tickets/contacts-directory';
import '../tickets/handlers-members';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { replaceRoute } from '../router';
import { ticketsS4Api, type Readiness } from '../api/tickets-s4';
import { onTicketNames } from '../tickets/naming';
import { HANDLERS_SEGMENTS, missingItems, type HandlersSegment } from '../tickets/readiness-model';
import { ticketSettingsCss } from '../tickets/settings-styles';
import { tt } from '../tickets/text';

/**
 * CR-038 owner request 2026-10-14: "מטפלים וספקים" (#/tickets/handlers[?seg=vendors|contacts]) - the fifth entry of the area's view
 * menu, the one place to manage who can handle a ticket (it was a tab of Settings › the module, and the handlers with an account had no
 * page at all: the owner could not assign anyone). Three segments:
 *   מטפלים     the department members with an account (tickets/handlers-members.ts: slice 2's member routes, unchanged rules) and the
 *              employees WITHOUT an account (the directory locked to the kind "employee": they get the handler link like a vendor);
 *   ספקים      the vendors (the directory locked to "vendor");
 *   אנשי קשר   the contacts (persons; one may work for a vendor).
 * The directory component and its API are slice 4's (tickets/contacts-directory.ts): create / edit / deactivate / erase / export need
 * tickets.configure; a department manager reads the rows of his departments with masked phones. A strip of what sending outside still
 * needs (the handler page, its address, the WhatsApp switch and account - GET tickets/readiness) is shown ONLY when something is missing,
 * each item a link to its setting. Settings › the module keeps a link card to this page and redirects the old `?tab=contacts`.
 */
@customElement('tickets-handlers')
export class TicketsHandlersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private seg: HandlersSegment = 'handlers';
  @state() private readiness: Readiness | null = null;
  @state() private ok = '';
  @state() private error = '';
  private okTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
    }
    sw-tabs {
      margin-block-end: var(--sw-s-3);
    }
    .rdy {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      margin-block-end: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .rdy .lbl {
      color: var(--sw-text-3);
    }
    .rdy a {
      display: inline-flex;
      align-items: center;
      min-block-size: 32px;
      padding-inline: 12px;
      border-radius: var(--sw-r-pill, 999px);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .rdy a:hover {
      border-color: var(--sw-accent);
    }
    .rdy a::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      margin-inline-end: 8px;
      border-radius: 50%;
      background: var(--sw-warning, var(--sw-text-3));
      flex: none;
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    this.readSeg();
    window.addEventListener('hashchange', this.onHash);
    this.offNames = onTicketNames(() => this.requestUpdate());
    void ticketsS4Api().readiness().then((r) => (this.readiness = r)).catch(() => undefined);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    window.clearTimeout(this.okTimer);
    this.offNames?.();
  }

  private onHash = () => {
    if (window.location.hash.startsWith('#/tickets/handlers')) this.readSeg();
  };

  private readSeg(): void {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('seg') as HandlersSegment | null;
    this.seg = q && HANDLERS_SEGMENTS.includes(q) ? q : 'handlers';
  }

  private setSeg(id: string): void {
    this.seg = HANDLERS_SEGMENTS.includes(id as HandlersSegment) ? (id as HandlersSegment) : 'handlers';
    replaceRoute('/tickets/handlers', this.seg === 'handlers' ? undefined : new URLSearchParams({ seg: this.seg }));
    this.ok = '';
    this.error = '';
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
    }
  };

  /** What sending outside still needs - shown only when something is missing (clean operator screens). */
  private strip(): TemplateResult | typeof nothing {
    const items = missingItems(this.readiness);
    if (!items.length) return nothing;
    return html`<div class="rdy" role="status" data-readiness>
      <span class="lbl">${tt('rdyStrip')}</span>
      ${items.map((i) => html`<a href=${i.href} data-readiness-item=${i.key}>${tt(i.text)}</a>`)}
    </div>`;
  }

  private body(): TemplateResult {
    if (this.seg === 'vendors') return html`<tickets-contacts kind="vendor" @notice=${this.onNotice}></tickets-contacts>`;
    if (this.seg === 'contacts') return html`<tickets-contacts kind="person" @notice=${this.onNotice}></tickets-contacts>`;
    return html`<div class="stack" data-handlers-segment>
      <tickets-handlers-members @notice=${this.onNotice}></tickets-handlers-members>
      <tickets-contacts kind="employee" @notice=${this.onNotice}></tickets-contacts>
    </div>`;
  }

  render() {
    const items = HANDLERS_SEGMENTS.map((id) => ({ id, label: tt(`hdSeg_${id}` as 'hdSeg_handlers') }));
    return html`<sw-page crumbs=${tt('area')} heading=${tt('hdTitle')} data-tickets-handlers data-seg=${this.seg}>
      ${this.strip()}
      <sw-tabs variant="underline" data-handlers-tabs .items=${items} .active=${this.seg} @change=${(e: CustomEvent<{ id: string }>) => this.setSeg(e.detail.id)}></sw-tabs>
      ${this.error ? html`<div class="msg err" role="alert" data-handlers-error>${this.error}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-handlers-ok>${this.ok}</div>` : nothing}
      ${this.body()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-handlers': TicketsHandlersPage;
  }
}
