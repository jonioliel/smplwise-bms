import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { messagesApi, type InboundItem } from '../api/tickets-messages';
import { ticketDetailStyles } from './styles';
import { mtt } from './messages-text';
import { tIcon } from './icons';
import { when } from './ticket-messages';

/**
 * CR-038 slice 5b (9.6 step 4, review T13-2): the WhatsApp replies that could not be matched to one ticket. A manager of a candidate
 * department sees the sender's directory name and the time only; "זה שלי" claims the reply and reveals its text to that manager alone
 * (audited); then it is attached to one of the candidate tickets (a note marked "via WhatsApp, unverified sender") or dismissed.
 * `<tickets-inbound-chip>` is the list screen's entry: nothing at all while the queue is empty (clean operator screens), else one chip
 * that opens the dialog. Event: `ticket-changed` {ticket} after an attach (the list refreshes).
 */
@customElement('tickets-inbound-chip')
export class TicketsInboundChip extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** the list screen passes whether the caller manages anything (the route answers [] otherwise) */
  @property({ type: Boolean }) manager = false;
  @state() private items: InboundItem[] = [];
  @state() private open = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private pick: Record<string, string> = {};
  private timer = 0;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, css`
    :host {
      display: contents;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      min-inline-size: min(28rem, 80vw);
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .item .txt {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .item .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
      align-items: center;
    }
    .chipin .n {
      font-variant-numeric: tabular-nums;
    }
    /* the list header's phone layout (tickets-list.ts, < 768 px) orders the search row 2: the chip sits there too (the host is
       display: contents, so the button is the header's flex item) */
    @media (max-width: 767px) {
      .chipin {
        order: 2;
      }
    }
    /* a narrow phone keeps that row to one line: the icon and the count (the full words stay in aria-label) */
    @media (max-width: 599px) {
      .chipin .lbl {
        display: none;
      }
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  async refresh(): Promise<void> {
    if (!this.manager || !isApi()) {
      this.items = [];
      return;
    }
    try {
      this.items = (await messagesApi().inbound()).items;
    } catch {
      this.items = [];
    }
  }

  private async act(fn: () => Promise<unknown>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'events' in (r as Record<string, unknown>)) {
        this.dispatchEvent(new CustomEvent('ticket-changed', { detail: { ticket: r }, bubbles: true, composed: true }));
      }
      await this.refresh();
      if (!this.items.length) this.open = false;
    } catch (e) {
      this.error = describeError(e);
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private async claim(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const it = await messagesApi().claim(id);
      this.items = this.items.map((x) => (x.id === id ? it : x));
    } catch (e) {
      this.error = describeError(e);
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!this.items.length) return nothing;
    return html`<button type="button" class="btn sm chipin" data-inbound-chip aria-label=${mtt('inbChip', { n: this.items.length })} @click=${() => (this.open = true)}>
        ${tIcon('note')}<span class="lbl">${mtt('inbTitle')}</span><b class="n">${this.items.length}</b></button>
      ${this.open ? html`<sw-dialog open heading=${mtt('inbTitle')} data-dialog="inbound" @close=${() => (this.open = false)}>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
        <div class="list">${this.items.map((it) => html`<div class="item" data-inbound=${it.id}>
          <small>${mtt('inbFrom', { sender: bidi(it.sender || '-'), when: when(it.received_at) })}</small>
          ${it.claimed_by_me ? html`<div class="txt" data-inbound-text>${it.text ?? ''}</div>
            <div class="row">
              <select class="inp" data-inbound-ticket @change=${(e: Event) => (this.pick = { ...this.pick, [it.id]: (e.target as HTMLSelectElement).value })}>
                ${it.tickets.map((t) => html`<option value=${t.id} ?selected=${(this.pick[it.id] ?? it.tickets[0]?.id) === t.id}>#${t.number} · ${bidi(t.title)}</option>`)}
              </select>
              <button type="button" class="btn sm primary" data-inbound-attach ?disabled=${this.busy || !it.tickets.length}
                @click=${() => void this.act(() => messagesApi().attach(it.id, this.pick[it.id] ?? it.tickets[0]?.id ?? ''))}>${tIcon('check')}${mtt('inbAttach', { number: it.tickets.find((t) => t.id === (this.pick[it.id] ?? it.tickets[0]?.id))?.number ?? '' })}</button>
              <button type="button" class="btn sm quiet" data-inbound-dismiss ?disabled=${this.busy} @click=${() => void this.act(() => messagesApi().dismiss(it.id))}>${tIcon('x')}${mtt('inbDismiss')}</button>
            </div>`
          : it.claimed ? html`<small data-inbound-claimed>${mtt('inbClaimedBy', { name: bidi(it.claimed_by_name ?? '') })}</small>`
          : html`<div class="row"><button type="button" class="btn sm" data-inbound-claim ?disabled=${this.busy} @click=${() => void this.claim(it.id)}>${tIcon('user')}${mtt('inbClaim')}</button></div>`}
        </div>`)}</div>
        <div slot="footer" class="sheetfoot"><button type="button" class="btn" @click=${() => (this.open = false)}>${mtt('inbClose')}</button></div>
      </sw-dialog>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-inbound-chip': TicketsInboundChip;
  }
}
