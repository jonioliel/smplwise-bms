import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-state-panel';
import { bidi } from '../i18n/bidi';
import type { EntityTickets, TicketItem } from '../api/tickets';
import { FINAL, lastScope, listHref, shortDateTime, chipLabel, statusTone } from './model';
import { dt } from './device-text';
import { onTicketNames } from './naming';

export type TabStatus = 'loading' | 'ready' | 'error' | 'no_device';

/**
 * CR-038 slice 3 `<device-tickets-tab>`: the last tab of the device window (section 12.1) - this device's tickets the user may see (open
 * ones first, newest first: status chip, number, date, handler) and "{ticket} {f:חדשה|m:חדש}" when the server says the user may open one.
 * The data is the window's (GET tickets/by-entity/{id}, fetched once per opening by `<device-activity>`, which also shows the open count on
 * the tab). Clean operator screen: one count line, the rows, no explanations. Events: `create`, `retry`, `leave` (a ticket was opened).
 */
@customElement('device-tickets-tab')
export class DeviceTicketsTab extends LitElement {
  @property({ attribute: false }) data: EntityTickets | null = null;
  @property() status: TabStatus = 'loading';
  private offNames: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.offNames?.();
  }

  private fire(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private row(t: TicketItem) {
    const who = t.assignee?.name ?? t.last_assignee_name ?? '';
    const closed = (FINAL as readonly string[]).includes(t.status);
    return html`<a class="tr ${closed ? 'closed' : ''}" role="listitem" href=${listHref(lastScope(), undefined, { t: t.id })} data-device-ticket=${t.id} @click=${() => this.fire('leave', { id: t.id })}>
      <span class="tt"><b>${t.title}</b><small><bdi>#${t.number}</bdi> · ${shortDateTime(t.created_at)}${who ? html` · ${bidi(who)}` : nothing}</small></span>
      <span class=${`chip ${statusTone(t.status)}`} data-status=${t.status}><i class="dot" aria-hidden="true"></i>${chipLabel(t.status)}</span>
    </a>`;
  }

  render() {
    if (this.status === 'loading') {
      return html`<div class="skels" role="status" aria-busy="true" data-tickets-state="loading">${[0, 1].map(() => html`<span class="skel"></span>`)}</div>`;
    }
    if (this.status === 'no_device') return html`<sw-state-panel state="forbidden" heading=${dt('noDevice')} compact data-tickets-state="no-device"></sw-state-panel>`;
    if (this.status === 'error' || !this.data) {
      return html`<sw-state-panel state="error" heading=${dt('loadFailed')} actionLabel=${dt('retry')} compact data-tickets-state="error" @action=${() => this.fire('retry')}></sw-state-panel>`;
    }
    const d = this.data;
    const head = html`<div class="hd">
      <span class="cnt" data-tickets-open=${d.open_count}>${d.items.length ? dt('openCount', { n: d.open_count }) : nothing}</span>
      ${d.can_create ? html`<sw-button size="sm" variant="primary" icon="plus" data-tickets-new @click=${() => this.fire('create')}>${dt('newBtn')}</sw-button>` : nothing}
    </div>`;
    if (!d.items.length) return html`${head}<sw-state-panel state="empty" heading=${dt('empty')} compact data-tickets-state="empty"></sw-state-panel>`;
    return html`${head}<div class="list" role="list" data-tickets-state="ready">${repeat(d.items, (t) => t.id, (t) => this.row(t))}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hd { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-2); padding-block: var(--sw-s-1h) var(--sw-s-2); min-block-size: 40px; }
    .cnt { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .list { display: grid; gap: var(--sw-s-2); }
    .tr {
      display: flex; align-items: center; gap: var(--sw-s-3); min-block-size: 56px; padding: var(--sw-s-2) var(--sw-s-3); border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border); background: var(--sw-surface-2); color: var(--sw-text); text-decoration: none;
    }
    .tr:hover { background: var(--sw-surface-3); }
    .tr:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .tr.closed .tt b { color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .tt { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
    .tt b { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tt small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip {
      flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap;
    }
    .chip .dot { inline-size: 6px; block-size: 6px; border-radius: 50%; background: currentColor; }
    .chip.info { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .chip.ok { background: var(--sw-success-soft); color: var(--sw-success); }
    .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .skels { display: grid; gap: var(--sw-s-2); padding-block: var(--sw-s-2); }
    .skel { display: block; block-size: 52px; border-radius: var(--sw-r-lg); background: var(--sw-surface-3); animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'device-tickets-tab': DeviceTicketsTab;
  }
}
