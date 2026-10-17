import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError } from '../api/client';
import { portalRequestsApi, type PortalTechRequest } from '../api/tickets-portal-requests';
import { tt } from './text';

/**
 * VPORTALRFQ: "בקשות טכנאים מספקים" - the pending company technician requests vendors sent from the portal, on "מטפלים וספקים" ›
 * ספקים, for the directory's editors only (`tickets.configure`). Nothing is shown to anyone else, and nothing when no request waits
 * (clean operator screens). Approve creates the technician row (its number unconfirmed - confirmed by code from the contact card)
 * and, for a replacement, sets the old row inactive; reject changes nothing. Events: `notice` {ok | error}.
 */
@customElement('tickets-portal-requests')
export class TicketsPortalRequests extends LitElement {
  @state() private requests: PortalTechRequest[] = [];
  @state() private busy = '';

  static styles = css`
    :host {
      display: block;
    }
    .req {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .req:last-child {
      border-block-end: 0;
    }
    .who {
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tag {
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.requests = (await portalRequestsApi.list()).requests;
    } catch {
      this.requests = []; // not an editor (403) or the module off: the card is simply absent
    }
  }

  private async decide(r: PortalTechRequest, approve: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = r.id;
    try {
      if (approve) await portalRequestsApi.approve(r);
      else await portalRequestsApi.reject(r);
      this.dispatchEvent(new CustomEvent('notice', { detail: { ok: tt(approve ? 'ptrApproved' : 'ptrRejected') }, bubbles: true, composed: true }));
    } catch (e) {
      this.dispatchEvent(new CustomEvent('notice', { detail: { error: describeError(e) }, bubbles: true, composed: true }));
    } finally {
      this.busy = '';
      await this.load();
    }
  }

  render() {
    if (!this.requests.length) return nothing;
    return html`<sw-card heading=${tt('ptrTitle')} data-portal-requests>
      ${this.requests.map((r) => html`<div class="req" data-portal-request=${r.id}>
        <div class="who"><div dir="auto">${r.display_name} <bdi dir="ltr">${r.phone ?? ''}</bdi></div>
          <div class="sub" dir="auto">${r.vendor.name} · ${r.action === 'add' ? tt('ptrAdd') : tt('ptrReplace', { name: r.replaces?.name ?? '' })}</div>
          ${r.phone_known ? html`<div class="tag" data-portal-request-known>${tt('ptrKnown')}</div>` : nothing}</div>
        <sw-button size="sm" variant="primary" data-portal-request-approve ?disabled=${!!this.busy} @click=${() => void this.decide(r, true)}>${tt('ptrApprove')}</sw-button>
        <sw-button size="sm" data-portal-request-reject ?disabled=${!!this.busy} @click=${() => void this.decide(r, false)}>${tt('ptrReject')}</sw-button>
      </div>`)}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-portal-requests': TicketsPortalRequests;
  }
}
